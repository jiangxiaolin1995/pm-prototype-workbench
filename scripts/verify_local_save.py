#!/usr/bin/env python3
"""Real HTTP/file tests in temporary directories; never touch a user's work HTML."""
import copy
import json
import tempfile
import threading
import unittest
import os
import signal
import shutil
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from unittest.mock import patch

import serve_workbench as service

SOURCE = (Path(__file__).resolve().parents[1] / 'assets/workbench.html').read_text()


class LocalSaveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='workbench-save-test-')
        self.file = Path(self.temp.name) / '中文 空格 工作台.html'
        self.file.write_text(SOURCE)
        self.server = service.create_server(self.file, token='isolated-test-token')
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.origin = 'http://127.0.0.1:' + str(self.server.server_port)
        self.url = self.origin + '/isolated-test-token'
        self.seed = service.read_payload(SOURCE)

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(3)
        self.assertFalse(self.thread.is_alive())
        self.temp.cleanup()

    def post(self, body, origin=None, endpoint='/save'):
        request = Request(self.url + endpoint, data=json.dumps(body).encode(), method='POST',
                          headers={'Content-Type': 'application/json', 'Origin': origin or self.origin})
        try:
            response = urlopen(request, timeout=3)
        except HTTPError as error:
            response = error
        with response:
            return response.status, json.loads(response.read())

    def change(self, text='正文 <script>纯文字</script>\n继续填写'):
        model = copy.deepcopy(self.seed['model'])
        model['globalContent'] = text
        return {'revision': service.revision(self.file.read_bytes()), 'artifactId': self.seed['artifactId'],
                'snapshotId': self.seed['snapshotId'], 'model': model, 'cacheReview': {'pending': [], 'resolved': []}}

    def test_open_injects_bound_file_and_does_not_modify_source(self):
        with urlopen(self.url + '/index.html', timeout=3) as response:
            html = response.read().decode()
            self.assertIn('workbench-local-save', html)
            self.assertIn('Cache-Control', response.headers)
        self.assertEqual(self.file.read_text(), SOURCE)
        with self.assertRaises(HTTPError):
            urlopen(self.url + '/../private.txt', timeout=3)

    def test_save_readback_and_reopen_preserve_code_identity_and_drafts(self):
        body = self.change()
        body['model']['drafts']['channels'] = {'dirty': True, 'values': {'body': '待完成草稿'}}
        status, result = self.post(body)
        self.assertEqual(status, 200)
        saved = self.file.read_text()
        data = service.read_payload(saved)
        self.assertEqual(data['model'], body['model'])
        self.assertEqual(data['snapshotId'], self.seed['snapshotId'])
        self.assertEqual(service.DATA.sub('', saved), service.DATA.sub('', SOURCE))
        self.assertEqual(result['revision'], service.revision(self.file.read_bytes()))
        self.assertTrue(self.server.store.backup.exists())
        with urlopen(self.url + '/index.html', timeout=3) as response:
            self.assertEqual(service.read_payload(response.read().decode())['model'], body['model'])

    def test_stale_browser_cannot_overwrite_latest(self):
        first, stale = self.change('第一份'), self.change('第二份')
        self.assertEqual(self.post(first)[0], 200)
        self.assertEqual(self.post(stale)[0], 409)
        self.assertEqual(service.read_payload(self.file.read_text())['model']['globalContent'], '第一份')

    def test_external_code_update_is_preserved(self):
        body = self.change()
        newer = SOURCE.replace('</head>', '<meta name="updated-by-codex" content="yes"></head>')
        self.file.write_text(newer)
        self.assertEqual(self.post(body)[0], 409)
        self.assertEqual(self.file.read_text(), newer)

    def test_other_sites_wrong_identity_and_readonly_cannot_write(self):
        self.assertEqual(self.post(self.change(), origin='https://other.test')[0], 403)
        body = self.change()
        body['artifactId'] = 'another-file'
        self.assertEqual(self.post(body)[0], 409)
        body = self.change()
        body['path'] = '/tmp/another-file.html'
        self.assertEqual(self.post(body)[0], 400)
        self.assertEqual(self.file.read_text(), SOURCE)
        readonly = copy.deepcopy(self.seed)
        readonly['readOnly'] = True
        self.file.write_text(service.with_payload(SOURCE, readonly))
        with self.assertRaises(ValueError):
            service.WorkbenchStore(self.file)

    def test_failed_atomic_replace_keeps_original_file(self):
        with patch.object(service.os, 'replace', side_effect=OSError('disk failure')):
            self.assertEqual(self.post(self.change())[0], 500)
        self.assertEqual(self.file.read_text(), SOURCE)

    def test_launcher_binds_unicode_filename_without_changing_html(self):
        from prepare_workbench import prepare
        result = prepare(self.file, make_app=False)
        self.assertEqual(result['editEntry'], result['launcher'])
        self.assertTrue(Path(result['launcher']).exists())
        self.assertIn("'中文 空格 工作台.html'", Path(result['launcher']).read_text())
        self.assertEqual(self.file.read_text(), SOURCE)
        self.assertEqual(Path(result['helper']).read_bytes(), Path(service.__file__).read_bytes())

    def test_default_generation_and_reopen_return_live_urls_without_launchers(self):
        scripts = Path(__file__).resolve().parent

        def run(script, *args):
            result = subprocess.check_output([sys.executable, str(scripts / script), *args], text=True)
            return json.loads(result)

        for name, generator in [('new', ['init_prototype.py', '--title', '编辑链接']),
                                ('example', ['build_example.py', 'h5'])]:
            with self.subTest(name=name):
                target = self.file.parent / name / '中文 工作文件.html'
                try:
                    entry = run(*generator, '--output', str(target))
                    self.assertTrue(entry['editEntry'].startswith('http://127.0.0.1:'))
                    self.assertIsNone(entry.get('launcher'))
                    self.assertEqual(Path(entry['file']), target.resolve())
                    visible = [p.name for p in target.parent.iterdir() if not p.name.startswith('.')]
                    self.assertEqual(visible, [target.name])
                    with urlopen(entry['editEntry'], timeout=3) as response:
                        self.assertIn(b'id="workbench-local-save"', response.read())
                    original = target.read_bytes()
                    reopened = run('prepare_workbench.py', str(target))
                    self.assertEqual(reopened['editEntry'], entry['editEntry'])
                    self.assertEqual(target.read_bytes(), original)
                finally:
                    if target.is_file():
                        directory, key = service.state_paths(target)
                        state = service.read_state(directory / (key + '.server.json'))
                        if service.live_state(state, target.resolve()):
                            os.kill(state['pid'], signal.SIGTERM)
                            deadline = time.monotonic() + 5
                            while service.live_state(state, target.resolve()):
                                self.assertLess(time.monotonic(), deadline, 'Test helper did not stop')
                                time.sleep(0.05)

    @unittest.skipUnless(sys.platform == 'darwin' and shutil.which('osacompile'), 'macOS app packaging')
    def test_native_app_remains_valid_after_adding_launcher_and_repreparing(self):
        from prepare_workbench import prepare
        result = prepare(self.file, make_app=True)
        app = Path(result['editEntry'])
        self.assertEqual(app.suffix, '.app')
        self.assertTrue((app / 'Contents/Resources/launch.command').is_file())
        for _ in range(2):
            checked = subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], capture_output=True, text=True)
            self.assertEqual(checked.returncode, 0, checked.stderr)
            self.assertEqual(prepare(self.file, make_app=True)['editEntry'], str(app))
        self.assertEqual(self.file.read_text(), SOURCE)

    @unittest.skipUnless(sys.platform == 'darwin' and shutil.which('osacompile'), 'macOS app packaging')
    def test_reprepare_removes_only_signature_incompatible_finder_metadata(self):
        from prepare_workbench import prepare
        app = Path(prepare(self.file, make_app=True)['editEntry'])
        subprocess.run(['xattr', '-wx', 'com.apple.FinderInfo', '4150504c6170706c' + '00' * 24, str(app)], check=True)
        subprocess.run(['xattr', '-w', 'org.example.workbench-test', 'preserve', str(app)], check=True)
        self.assertIn('com.apple.FinderInfo', subprocess.check_output(['xattr', str(app)], text=True).splitlines())
        prepare(self.file, make_app=True)
        attributes = subprocess.check_output(['xattr', str(app)], text=True).splitlines()
        self.assertNotIn('com.apple.FinderInfo', attributes)
        self.assertEqual(subprocess.check_output(['xattr', '-p', 'org.example.workbench-test', str(app)], text=True).strip(), 'preserve')
        checked = subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], capture_output=True, text=True)
        self.assertEqual(checked.returncode, 0, checked.stderr)

    def test_reopen_reuses_helper_and_idle_helper_exits(self):
        state = service.launch(self.file, open_browser=False, idle_seconds=1.5)
        try:
            again = service.launch(self.file, open_browser=False, idle_seconds=1.5)
            self.assertEqual(state['pid'], again['pid'])
            self.assertEqual(state['url'], again['url'])
            deadline = time.monotonic() + 6
            exited = False
            while time.monotonic() < deadline:
                try:
                    pid, _status = os.waitpid(state['pid'], os.WNOHANG)
                    if pid:
                        exited = True
                        break
                except ChildProcessError:
                    exited = True
                    break
                time.sleep(0.1)
            self.assertTrue(exited, 'An idle helper must stop after its page closes')
        finally:
            try:
                os.kill(state['pid'], signal.SIGTERM)
                os.waitpid(state['pid'], 0)
            except (ProcessLookupError, ChildProcessError):
                pass


if __name__ == '__main__':
    unittest.main()
