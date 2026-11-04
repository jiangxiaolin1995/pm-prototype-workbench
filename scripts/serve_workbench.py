#!/usr/bin/env python3
"""Local autosave for one explicitly selected workbench HTML. Standard library only."""
import argparse
import contextlib
import hashlib
import json
import os
import re
import secrets
import subprocess
import sys
import tempfile
import threading
import time
import webbrowser
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import urlopen

DATA = re.compile(r'(<script\b[^>]*\bid=["\']prototype-data["\'][^>]*>)(.*?)(</script\s*>)', re.S | re.I)
BOOTSTRAP = re.compile(r'<script\b[^>]*\bid=["\']workbench-local-save["\'][^>]*>.*?</script\s*>', re.S | re.I)


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False).replace('<', r'\u003c').replace('>', r'\u003e').replace('&', r'\u0026')


def read_payload(source):
    match = DATA.search(source)
    if not match:
        raise ValueError('没有找到工作台内容，请选择可编辑工作 HTML')
    data = json.loads(match[2])
    if not isinstance(data.get('model'), dict) or not data.get('artifactId') or not data.get('snapshotId'):
        raise ValueError('工作台文件格式不完整')
    return data


def with_payload(source, data):
    return DATA.sub(lambda m: m[1] + encode(data) + m[3], source, count=1)


def revision(raw):
    return hashlib.sha256(raw).hexdigest()


def state_paths(target):
    directory = target.parent / '.workbench'
    directory.mkdir(exist_ok=True, mode=0o700)
    key = hashlib.sha256(target.name.encode()).hexdigest()[:16]
    return directory, key


@contextlib.contextmanager
def file_lock(path):
    with path.open('a+b') as stream:
        if os.name == 'nt':
            import msvcrt
            if stream.tell() == 0:
                stream.write(b'0')
                stream.flush()
            stream.seek(0)
            msvcrt.locking(stream.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(stream, fcntl.LOCK_EX)
        try:
            yield
        finally:
            if os.name == 'nt':
                stream.seek(0)
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream, fcntl.LOCK_UN)


def atomic_write(path, raw, mode=0o600):
    descriptor, temporary = tempfile.mkstemp(prefix='.workbench-write-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


class Conflict(ValueError):
    pass


class WorkbenchStore:
    def __init__(self, target):
        self.target = Path(target).expanduser().resolve(strict=True)
        if self.target.suffix.lower() not in ('.html', '.htm'):
            raise ValueError('请选择 HTML 工作文件')
        payload = read_payload(self.target.read_text(encoding='utf-8'))
        if payload.get('readOnly'):
            raise ValueError('只读 HTML 不能作为编辑工作台打开')
        directory, key = state_paths(self.target)
        self.lock = directory / (key + '.write.lock')
        self.backup = directory / (key + '.previous.html')
        self.mutex = threading.Lock()

    def save(self, request):
        allowed = {'revision', 'artifactId', 'snapshotId', 'model', 'cacheReview'}
        if not isinstance(request, dict) or set(request) != allowed:
            raise ValueError('保存请求不完整；只能保存当前工作文件')
        if not isinstance(request['model'], dict) or not isinstance(request['model'].get('notes'), list) or not isinstance(request['cacheReview'], dict):
            raise ValueError('正文或说明格式不完整，原文件未修改')
        with self.mutex, file_lock(self.lock):
            raw = self.target.read_bytes()
            if request['revision'] != revision(raw):
                raise Conflict('文件已被其他窗口或 Codex 更新，已停止覆盖；请保存可编辑副本后重新打开工作台')
            source = raw.decode('utf-8')
            payload = read_payload(source)
            if payload.get('readOnly') or any(request[k] != payload[k] for k in ('artifactId', 'snapshotId')):
                raise Conflict('工作文件身份已改变，原文件未修改')
            saved_at = datetime.now(timezone.utc).isoformat()
            payload.update(model=request['model'], cacheReview=request['cacheReview'], savedAt=saved_at)
            output = with_payload(source, payload).encode('utf-8')
            # Keep one previous on-disk version. Never rewrite page code from browser DOM.
            atomic_write(self.backup, raw)
            if self.target.read_bytes() != raw:
                raise Conflict('文件刚被其他程序更新，已停止覆盖')
            atomic_write(self.target, output, self.target.stat().st_mode & 0o777)
            if self.target.read_bytes() != output:
                raise Conflict('写入后文件又发生变化，请核对其他窗口')
            return {'ok': True, 'revision': revision(output), 'savedAt': saved_at}


def create_server(target, token=None, port=0):
    store = WorkbenchStore(target)
    token = token or secrets.token_urlsafe(24)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def reply(self, status, value, mime='application/json; charset=utf-8'):
            raw = value if isinstance(value, bytes) else encode(value).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(raw)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.end_headers()
            self.wfile.write(raw)

        def permitted(self):
            expected_host = '127.0.0.1:' + str(self.server.server_port)
            if self.headers.get('Host') != expected_host or self.headers.get('Sec-Fetch-Site') == 'cross-site':
                self.reply(403, {'error': '仅限本机工作台访问'})
                return False
            return True

        def do_GET(self):
            if not self.permitted():
                return
            route = self.path.split('?', 1)[0]
            if route == '/' + token + '/health':
                self.server.last_activity = time.monotonic()
                self.reply(200, {'ok': True, 'kind': 'workbench-local-save', 'file': str(store.target), 'pid': os.getpid()})
            elif route == '/' + token + '/index.html':
                try:
                    raw = store.target.read_bytes()
                    source = BOOTSTRAP.sub('', raw.decode('utf-8'))
                    if read_payload(source).get('readOnly'):
                        raise ValueError('此文件已改为只读，请重新打开工作文件')
                    config = {'endpoint': '/' + token + '/save', 'heartbeat': '/' + token + '/health',
                              'revision': revision(raw), 'filename': store.target.name}
                    script = '<script type="application/json" id="workbench-local-save">' + encode(config) + '</script>'
                    source = source.replace('</head>', script + '</head>', 1)
                    self.server.last_activity = time.monotonic()
                    self.reply(200, source.encode('utf-8'), 'text/html; charset=utf-8')
                except (OSError, ValueError) as error:
                    self.reply(500, {'error': str(error)})
            else:
                self.reply(404, {'error': '此入口只提供当前工作文件'})

        def do_POST(self):
            if not self.permitted():
                return
            origin = 'http://127.0.0.1:' + str(self.server.server_port)
            if self.headers.get('Origin') != origin:
                self.reply(403, {'error': '保存必须来自当前本机工作台'})
                return
            if self.path != '/' + token + '/save':
                self.reply(404, {'error': '保存地址不匹配'})
                return
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 32 * 1024 * 1024 or self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                    raise ValueError('保存请求格式或大小不正确')
                def reject_constant(value):
                    raise ValueError('不支持的 JSON 数值：' + value)
                request = json.loads(self.rfile.read(length), parse_constant=reject_constant)
                result = store.save(request)
                self.server.last_activity = time.monotonic()
                self.reply(200, result)
            except Conflict as error:
                self.reply(409, {'error': str(error)})
            except (ValueError, KeyError, TypeError) as error:
                self.reply(400, {'error': str(error)})
            except OSError as error:
                self.reply(500, {'error': '保存失败，原内容仍可在页面中保留：' + str(error)})

    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    server.daemon_threads = True
    server.store = store
    server.token = token
    server.url = 'http://127.0.0.1:' + str(server.server_port) + '/' + token + '/index.html'
    server.last_activity = time.monotonic()
    return server


def read_state(path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {}


def live_state(state, target):
    if state.get('file') != str(target) or not isinstance(state.get('port'), int) or not re.fullmatch(r'[A-Za-z0-9_-]+', state.get('token', '')):
        return False
    try:
        url = 'http://127.0.0.1:' + str(state['port']) + '/' + state['token'] + '/health'
        with urlopen(url, timeout=0.5) as response:
            info = json.loads(response.read())
        return info.get('kind') == 'workbench-local-save' and info.get('file') == str(target) and info.get('pid') == state.get('pid')
    except (OSError, ValueError):
        return False


def serve(target, idle_seconds):
    directory, key = state_paths(target)
    state_file = directory / (key + '.server.json')
    previous = read_state(state_file)
    preferred = previous.get('port', 0) if previous.get('file') == str(target) else 0
    try:
        server = create_server(target, port=preferred)
    except OSError:
        server = create_server(target)
    state = {'file': str(target), 'port': server.server_port, 'token': server.token, 'pid': os.getpid(), 'url': server.url}
    atomic_write(state_file, encode(state).encode())
    print(encode(state), flush=True)
    server.timeout = min(1, idle_seconds)
    try:
        while time.monotonic() - server.last_activity < idle_seconds:
            server.handle_request()
    finally:
        server.server_close()


def launch(target, open_browser=True, idle_seconds=1800):
    target = Path(target).expanduser().resolve(strict=True)
    WorkbenchStore(target)  # Validate before launching anything.
    directory, key = state_paths(target)
    state_file = directory / (key + '.server.json')
    with file_lock(directory / (key + '.launch.lock')):
        state = read_state(state_file)
        if not live_state(state, target):
            with (directory / (key + '.server.log')).open('ab') as log:
                child = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), '--serve', str(target), '--idle-seconds', str(idle_seconds)],
                                         stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
            deadline = time.monotonic() + 12
            while time.monotonic() < deadline:
                state = read_state(state_file)
                if state.get('pid') == child.pid and live_state(state, target):
                    break
                if child.poll() is not None:
                    raise RuntimeError('工作台未能启动，请查看 .workbench 中的 server.log')
                time.sleep(0.05)
            else:
                child.terminate()
                child.wait(timeout=5)
                raise RuntimeError('本地工作台启动超时')
    if open_browser:
        webbrowser.open(state['url'], new=2)
    return state


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--launch', type=Path, help='Open or resume a bound local workspace')
    group.add_argument('--serve', type=Path, help='Run the local helper in the foreground')
    parser.add_argument('--no-open', action='store_true', help='Print the URL without opening a browser')
    parser.add_argument('--idle-seconds', type=float, default=1800)
    args = parser.parse_args()
    if args.idle_seconds <= 0:
        parser.error('idle-seconds must be positive')
    target = (args.launch or args.serve).expanduser().resolve(strict=True)
    if args.launch:
        print(encode(launch(target, not args.no_open, args.idle_seconds)))
    else:
        serve(target, args.idle_seconds)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
