#!/usr/bin/env python3
"""Create a fresh editable PRD workbench from this skill's portable template."""

import argparse
import html
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from workbench_source import assemble, payload, with_payload


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--title', required=True, help='New project display name')
    parser.add_argument('--output', required=True, type=Path, help='New working .html file; never overwritten')
    parser.add_argument('--version', default='v1.0')
    parser.add_argument('--product', help='Confirmed product name for the starter pages')
    parser.add_argument('--platform', help='Confirmed platform, for example CMS, App, H5, or Web')
    parser.add_argument('--config', type=Path, help='Project payload JSON with requirements, pages, navigation and model')
    parser.add_argument('--adapter', type=Path, help='Business adapter JavaScript, inlined into the single HTML')
    parser.add_argument('--style', type=Path, help='Business CSS to inline')
    args = parser.parse_args()
    title = args.title.strip()
    if not title or len(title) > 100:
        parser.error('title must contain 1–100 characters')
    target = args.output.expanduser().resolve()
    if target.suffix.lower() != '.html':
        parser.error('output must end in .html')
    if target.exists():
        parser.error('output already exists; edit the existing working file instead')

    source = assemble(adapter=args.adapter.read_text() if args.adapter else None, style=args.style.read_text() if args.style else None)
    seed = payload(source)
    if args.config:
        supplied = json.loads(args.config.read_text())
        if not isinstance(supplied, dict):
            parser.error('config must contain a project object')
        seed.update(supplied)
    if not seed.get('pages') or not seed.get('requirements'):
        parser.error('config needs at least one page and its requirement')
    requirements = {item['id'] for item in seed['requirements']}
    for page_id, page in seed['pages'].items():
        if page.get('req') not in requirements or not page.get('states') or page_id not in seed.get('model', {}).get('views', {}):
            parser.error('page requires a known requirement, states and its initial view: ' + page_id)
    now = datetime.now(timezone.utc).isoformat()
    seed.update(projectTitle=title, artifactId='prototype-' + uuid4().hex,
                snapshotId='work-' + uuid4().hex, version=args.version,
                savedAt=now, readOnly=False)
    seed['model']['updatedAt'] = now
    if args.product or args.platform:
        for binding in seed['navigation']['pageScopes'].values():
            if args.product:
                seed['navigation']['products'][binding['product']]['name'] = args.product.strip()
            if args.platform:
                seed['navigation']['platforms'][binding['platform']]['name'] = args.platform.strip()
    source = with_payload(source, seed)
    source = re.sub(r'<title>.*?</title>', lambda _: '<title>' + html.escape(title) + ' · PRD 原型工作台</title>', source, count=1, flags=re.S)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('x', encoding='utf-8') as stream:
        stream.write(source)
    print(json.dumps({'file': str(target), 'projectTitle': title, 'readOnly': False,
                      'next': 'Configure pages and the business adapter for the requested scope. Explicitly supplied text is retained; unspecified text stays empty.'}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
