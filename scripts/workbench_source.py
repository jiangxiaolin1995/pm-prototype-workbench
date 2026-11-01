"""Assemble one offline HTML from the shared shell and an optional business adapter."""
import json
import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = re.compile(r'(<script type="application/json" id="prototype-data">)(.*?)(</script>)', re.S)

def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', r'\u003c').replace('>', r'\u003e').replace('&', r'\u0026')

def payload(source):
    match = DATA.search(source)
    if not match:
        raise ValueError('Missing prototype-data')
    return json.loads(match[2])

def with_payload(source, seed):
    return DATA.sub(lambda m: m[1] + encode(seed) + m[3], source, count=1)

def assemble(seed=None, adapter=None, style=None):
    source = (ROOT / 'assets/workbench.html').read_text()
    if seed is not None:
        source = with_payload(source, seed)
        source = re.sub(r'<title>.*?</title>', lambda _: '<title>'+html.escape(seed.get('projectTitle','项目原型'))+' · PRD 原型工作台</title>', source, count=1, flags=re.S)
    if adapter is not None:
        if re.search(r'</script\b', adapter, re.I):
            raise ValueError('Adapter must escape script closing tags in string literals')
        source, count = re.subn(r'(/\* BUSINESS_ADAPTER_START \*/).*?(/\* BUSINESS_ADAPTER_END \*/)', lambda m: m[1]+'\n'+adapter+'\n'+m[2], source, count=1, flags=re.S)
        if count != 1:
            raise ValueError('Missing business adapter slot')
    if style is not None:
        if re.search(r'</style\b', style, re.I):
            raise ValueError('Invalid style closing tag')
        source = source.replace('<style id="business-style"></style>', '<style id="business-style">\n'+style+'\n</style>')
    return source

def example_source(name):
    if name not in ('channel-review', 'h5'):
        raise ValueError('Unknown example')
    directory = ROOT / 'examples' / name
    return assemble(json.loads((directory/'project.json').read_text()), (directory/'business.js').read_text(), (directory/'business.css').read_text())
