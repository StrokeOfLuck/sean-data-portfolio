"""Capture the preserved article only after its visible rental map is ready."""
import base64
import functools
import http.server
import json
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

folder = Path('projects/assets/housing-affordability')
marker = folder / 'snapshot-map-ready.json'
if marker.exists():
    print('Map-complete snapshot already saved')
    raise SystemExit(0)

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(Path.cwd())))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--max-active-webgl-contexts=64'])
        page = browser.new_page(viewport={'width':1280, 'height':900}, device_scale_factor=2)
        page.goto(f'http://127.0.0.1:{server.server_port}/{folder}/article.html', wait_until='load', timeout=120000)
        map_frame = None
        for _ in range(120):
            for frame in page.frames:
                if '/graphics/index.html' not in frame.url:
                    continue
                parent = frame.parent_frame
                grandparent = parent.parent_frame if parent else None
                if grandparent and 'figure=map' in grandparent.url:
                    map_frame = frame
                    break
            if map_frame:
                break
            page.wait_for_timeout(500)
        assert map_frame, 'Visible article map frame missing'
        map_frame.wait_for_function("typeof map !== 'undefined' && map && map.isStyleLoaded() && map.areTilesLoaded() && map.getCanvas().width > 0", timeout=120000)
        map_frame.evaluate('map.resize()')
        map_frame.wait_for_function('map.isStyleLoaded() && map.areTilesLoaded()', timeout=120000)
        page.evaluate('document.fonts.ready')
        # Trigger any remaining lazy photos before taking a full-page capture.
        page.evaluate("document.querySelectorAll('img').forEach(i => i.loading = 'eager')")
        page.wait_for_timeout(3000)
        page.mouse.move(0, 0)
        map_frame.locator('#map').screenshot(path=str(folder / 'snapshot-map-check.png'))
        page.screenshot(path=str(folder / 'publication-snapshot.png'), full_page=True, timeout=120000)
        path = folder / 'publication-snapshot.png'
        path.with_suffix('.png.b64').write_text(base64.b64encode(path.read_bytes()).decode('ascii') + '\n')
        marker.write_text(json.dumps({'source':'article.html with preserved repo graphics', 'viewport_width':1280, 'device_scale_factor':2, 'map_style_loaded':True, 'map_tiles_loaded':True}, indent=2) + '\n')
        browser.close()
finally:
    server.shutdown()
