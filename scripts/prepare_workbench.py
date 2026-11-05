#!/usr/bin/env python3
"""Start or reuse autosave for an existing work HTML and return its local edit URL."""
import argparse
import hashlib
import json
import os
import shlex
import shutil
import subprocess
import sys
from pathlib import Path
from serve_workbench import launch, read_payload


def launcher_script(filename, app=False):
    parent = '/../../..' if app else ''
    return ('#!/bin/zsh\nset -e\n'
            'workbench_dir="$(cd -- "$(dirname -- "$0")' + parent + '" && pwd)"\n'
            'exec /usr/bin/env python3 "$workbench_dir/.workbench/serve_workbench.py" --launch "$workbench_dir"/' + shlex.quote(filename) + '\n')


def write_owned(path, content):
    if path.exists() and path.read_text() != content:
        raise ValueError('启动入口已有不同内容，未覆盖：' + str(path))
    path.write_text(content)
    path.chmod(0o755)


def prepare(target, make_app=None):
    """Open by URL by default. Explicit legacy launcher requests keep their file output."""
    if make_app is not None:
        return prepare_launcher(target, make_app)
    state = launch(target, open_browser=False)
    return {'file': state['file'], 'editEntry': state['url'], 'launcher': None,
            'helper': str(Path(__file__).with_name('serve_workbench.py').resolve())}


def prepare_launcher(target, make_app):
    target = Path(target).expanduser().resolve(strict=True)
    payload = read_payload(target.read_text(encoding='utf-8'))
    if payload.get('readOnly'):
        raise ValueError('只读 HTML 不需要编辑启动器')
    directory = target.parent / '.workbench'
    directory.mkdir(exist_ok=True, mode=0o700)
    helper = directory / 'serve_workbench.py'
    source = Path(__file__).with_name('serve_workbench.py').read_bytes()
    if helper.exists() and helper.read_bytes() != source:
        old = helper.read_bytes()
        if b'Local autosave for one explicitly selected workbench HTML' not in old[:250]:
            raise ValueError('保存程序已有其他内容，未覆盖：' + str(helper))
        backup = directory / ('serve_workbench.' + hashlib.sha256(old).hexdigest()[:12] + '.py')
        if not backup.exists():
            backup.write_bytes(old)
    helper.write_bytes(source)
    helper.chmod(0o700)
    result = {'file': str(target), 'helper': str(helper)}
    if sys.platform == 'darwin' and make_app and shutil.which('osacompile'):
        app = target.with_name(target.stem + '-打开工作台.app')
        resource = app / 'Contents/Resources/launch.command'
        if not app.exists():
            script = 'on run\nset entryPath to POSIX path of (path to resource "launch.command")\ndo shell script "/bin/zsh " & quoted form of entryPath\nend run\n'
            subprocess.run(['osacompile', '-o', str(app), '-e', script], check=True, capture_output=True, text=True)
        if not resource.parent.exists():
            raise ValueError('已有同名应用不属于工作台，未覆盖：' + str(app))
        write_owned(resource, launcher_script(target.name, app=True))
        # osacompile signs the bundle before our bound launcher exists.
        # Seal the final resources so Launch Services can open the local app.
        # Finder metadata can be attached on Desktop/iCloud. Only remove the
        # two attributes prohibited by codesign; preserve all security metadata.
        for node in [app, *app.rglob('*')]:
            attributes = subprocess.check_output(['xattr', str(node)], text=True).splitlines()
            for attribute in ('com.apple.FinderInfo', 'com.apple.ResourceFork'):
                if attribute in attributes:
                    subprocess.run(['xattr', '-d', attribute, str(node)], check=True, capture_output=True, text=True)
        subprocess.run(['codesign', '--force', '--sign', '-', '--timestamp=none', str(app)],
                       check=True, capture_output=True, text=True)
        subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)],
                       check=True, capture_output=True, text=True)
        result['launcher'] = str(app)
    else:
        command = target.with_name(target.stem + '-打开工作台.command')
        write_owned(command, launcher_script(target.name))
        result['launcher'] = str(command)
    result['editEntry'] = result['launcher']
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', type=Path)
    legacy = parser.add_mutually_exclusive_group()
    legacy.add_argument('--app', dest='make_app', action='store_true', help='Explicitly create the legacy native launcher')
    legacy.add_argument('--command', '--no-app', dest='make_app', action='store_false', help='Explicitly create the legacy shell launcher')
    parser.set_defaults(make_app=None)
    args = parser.parse_args()
    print(json.dumps(prepare(args.file, args.make_app), ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        if isinstance(error, subprocess.CalledProcessError) and error.stderr:
            print(error.stderr.strip(), file=sys.stderr)
        sys.exit(1)
