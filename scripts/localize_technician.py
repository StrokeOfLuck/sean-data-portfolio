"""Use captured article assets; never fetch publication styles during a build."""
import hashlib
import html
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

ASSETS = Path(__file__).resolve().parents[1] / 'projects/assets/park-it-here'

def localize(document):
    manifest = json.loads((ASSETS / 'vendor/manifest.json').read_text())
    by_path = {}
    for asset in manifest['assets']:
        path = ASSETS / 'vendor' / asset['file']
        if hashlib.sha256(path.read_bytes()).hexdigest() != asset['sha256']:
            raise ValueError(f'Captured asset changed: {path}')
        parsed = urlsplit(asset['url'])
        by_path[(parsed.netloc, parsed.path)] = 'vendor/' + asset['file']

    def replace_tag(match):
        tag = match[0]
        def replace_url(attr):
            parsed = urlsplit(html.unescape(attr[2]))
            local = by_path.get((parsed.netloc, parsed.path))
            return f'{attr[1]}="{local}"' if local else attr[0]
        updated = re.sub(r'(href|src)="([^"]+)"', replace_url, tag)
        if updated != tag:
            updated = re.sub(r'\s+(?:integrity|crossorigin)="[^"]*"', '', updated)
        if updated.startswith('<link') and 'stylesheet' in updated and re.search(r'href="https?://', updated):
            raise ValueError(f'Uncaptured stylesheet: {updated}')
        return updated
    return re.sub(r'<(?:link|img)\b[^>]*>', replace_tag, document)

if __name__ == '__main__':
    import sys
    for arg in sys.argv[1:]:
        path = Path(arg)
        path.write_text(localize(path.read_text(encoding='utf-8')), encoding='utf-8')
