#!/usr/bin/env python3
"""Create a fresh editable workbench from this skill's portable template."""

import argparse
import html
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--title', required=True, help='New project display name')
    parser.add_argument('--output', required=True, type=Path, help='New working .html file; never overwritten')
    parser.add_argument('--version', default='v1.0')
    parser.add_argument('--product', help='Confirmed product name for the starter pages')
    parser.add_argument('--platform', help='Confirmed platform, for example CMS, App, H5, or Web')
    args = parser.parse_args()
    title = args.title.strip()
    if not title or len(title) > 100:
        parser.error('title must contain 1–100 characters')
    target = args.output.expanduser().resolve()
    if target.suffix.lower() != '.html':
        parser.error('output must end in .html')
    if target.exists():
        parser.error('output already exists; edit the existing working file instead')

    template = Path(__file__).resolve().parents[1] / 'assets/workbench.html'
    source = template.read_text(encoding='utf-8')
    match = re.search(r'(<script type="application/json" id="prototype-data">)(.*?)(</script>)', source, re.S)
    if match is None:
        raise ValueError('template has no prototype-data payload')
    seed = json.loads(match[2])
    now = datetime.now(timezone.utc).isoformat()
    seed.update(projectTitle=title, artifactId='prototype-' + uuid4().hex,
                snapshotId='work-' + uuid4().hex, version=args.version,
                savedAt=now, readOnly=False)
    seed['model']['drafts'] = {}
    seed['model']['updatedAt'] = now
    # These names identify the starter pages, not new business rules.
    seed['navigation']['products']['example']['name'] = (args.product or '').strip() or '产品未标明'
    seed['navigation']['platforms']['cms']['name'] = (args.platform or '').strip() or '端未标明'
    encoded = json.dumps(seed, ensure_ascii=False, separators=(',', ':'))
    encoded = encoded.replace('<', r'\u003c').replace('>', r'\u003e').replace('&', r'\u0026')
    source = source[:match.start(2)] + encoded + source[match.end(2):]
    source = re.sub(r'<title>.*?</title>', lambda _: '<title>' + html.escape(title) + ' · 原型工作台</title>', source, count=1, flags=re.S)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('x', encoding='utf-8') as stream:
        stream.write(source)
    print(json.dumps({'file': str(target), 'projectTitle': title, 'readOnly': False,
                      'next': 'Configure products/platforms/pageScopes and replace sample requirements, business pages, data, and notes before delivery.'}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
