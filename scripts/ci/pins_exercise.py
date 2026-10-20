#!/usr/bin/env python3
"""Throwaway exercise of the real Python code paths under the pins in the environment.

Runs in a workflow_dispatch CI job only. Posts nothing, calls no provider API, and needs no
secrets. Images are served from a local HTTP server, so requests is exercised offline.
Prints one JSON line per step: status (ran / skipped / error), reason, and output hashes.
"""
import hashlib
import http.server
import io
import json
import os
import socketserver
import sys
import tempfile
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'social-automation'))
sys.path.insert(0, str(ROOT / 'scripts' / 'shareables'))

results = []


def report(name, status, reason='', outputs=None):
    row = {'step': name, 'status': status, 'reason': reason, 'outputs': outputs or {}}
    results.append(row)
    print(json.dumps(row, sort_keys=True))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()[:16]


def make_png(colour, size=(800, 600)):
    from PIL import Image
    buf = io.BytesIO()
    Image.new('RGB', size, colour).save(buf, format='PNG')
    return buf.getvalue()


# Local image server: serves a few PNGs so requests and Image.open run without the network.
tmpdir = Path(tempfile.mkdtemp(prefix='pins-exercise-'))
PNGS = {f'/img{i}.png': make_png(((i * 37) % 255, (i * 91) % 255, (i * 13) % 255)) for i in range(10)}


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = PNGS.get(self.path)
        if body is None:
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header('Content-Type', 'image/png')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


server = socketserver.TCPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{server.server_address[1]}'

# 1. requests + Pillow: the feed image path (download, scale, paste, watermark, save).
try:
    import media_processor as mp
    mp.OUT_DIR = tmpdir
    set_data = {'set_num': '99001', 'name': 'Exercise Set', 'theme': 'Technic', 'year': 2026,
                'num_parts': 1234, 'image_url': f'{BASE}/img1.png', 'india_price': '₹12,999',
                'source': 'lego_coming_soon', 'gallery_images': [f'{BASE}/img{i}.png' for i in range(10)]}
    if not (ROOT / 'social-automation' / 'assets' / 'watermark.png').exists():
        report('process_image', 'skipped', 'watermark asset missing')
    else:
        out = mp.process_image(set_data)
        report('process_image (requests + Pillow + watermark)', 'ran', '', {'feed_jpg_sha16': sha(out), 'bytes': os.path.getsize(out)})
except Exception as e:  # noqa: BLE001
    report('process_image (requests + Pillow + watermark)', 'error', f'{type(e).__name__}: {e}')
    mp = None

# 2. Pillow: the text overlays and the stats card (no network).
if mp is not None:
    try:
        ov = mp._make_shorts_text_overlay(1080, 1920, set_data, False)
        report('_make_shorts_text_overlay (product slide)', 'ran', '', {'shape': list(ov.shape), 'sha16': hashlib.sha256(ov.tobytes()).hexdigest()[:16]})
    except Exception as e:  # noqa: BLE001
        report('_make_shorts_text_overlay (product slide)', 'error', f'{type(e).__name__}: {e}')
    try:
        card = mp._make_stats_card(set_data)
        p = tmpdir / 'stats_card.png'
        card.save(p)
        report('_make_stats_card', 'ran', '', {'png_sha16': sha(p), 'size': list(card.size)})
    except Exception as e:  # noqa: BLE001
        report('_make_stats_card', 'error', f'{type(e).__name__}: {e}')
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(PNGS['/img2.png'])).convert('RGBA')
        a = mp._scale_to_contain(img.copy(), 900, 900)
        b = mp._scale_to_fill(img.copy(), 1080, 1920)
        report('_scale_to_contain / _scale_to_fill', 'ran', '', {'contain': list(a.size), 'fill': list(b.size)})
    except Exception as e:  # noqa: BLE001
        report('_scale_to_contain / _scale_to_fill', 'error', f'{type(e).__name__}: {e}')
else:
    report('_make_shorts_text_overlay / _make_stats_card / scale helpers', 'skipped', 'media_processor did not import')

# 3. python-dotenv: load a throwaway .env file (no real secrets).
try:
    from dotenv import load_dotenv, dotenv_values
    envf = tmpdir / '.env'
    envf.write_text('PINS_EXERCISE_VALUE=ok\n', encoding='utf-8')
    load_dotenv(envf, override=True)
    vals = dotenv_values(envf)
    ok = os.environ.get('PINS_EXERCISE_VALUE') == 'ok' and vals.get('PINS_EXERCISE_VALUE') == 'ok'
    report('python-dotenv load_dotenv / dotenv_values', 'ran' if ok else 'error', '' if ok else 'value not loaded', {'loaded': ok})
except Exception as e:  # noqa: BLE001
    report('python-dotenv load_dotenv / dotenv_values', 'error', f'{type(e).__name__}: {e}')

# 4. shareables: the placeholder renderers (Pillow, moviepy frame) with no inputs from the network.
try:
    import make_public_placeholders as mpp
    png = tmpdir / 'placeholder.png'
    mpp.render_placeholder_png(png)
    report('make_public_placeholders.render_placeholder_png', 'ran', '', {'png_sha16': sha(png)})
except Exception as e:  # noqa: BLE001
    report('make_public_placeholders.render_placeholder_png', 'error', f'{type(e).__name__}: {e}')

try:
    import postprocess as pp
    clip = pp.make_caption_clip('Exercise caption', 1.0)
    frame = clip.get_frame(0)
    report('postprocess.make_caption_clip (frame 0)', 'ran', '', {'frame_shape': list(frame.shape)})
except Exception as e:  # noqa: BLE001
    report('postprocess.make_caption_clip (frame 0)', 'error', f'{type(e).__name__}: {e}')

# 5. Not exercised here, with the reason: anything that posts or needs a live provider.
report('post_prepared / brick_rush_auto posting', 'skipped',
       'posts to Instagram/YouTube; covered by the unit tests (test_post_prepared, test_brick_rush_auto) with mocks, run in the workflow')
report('postprocess.main (full clip render)', 'skipped', 'needs an input video clip and ffmpeg render time; not run in CI')
report('pipeline / publisher / notifier / scraper', 'skipped', 'call live APIs or post; not exercised')

server.shutdown()
errors = [r for r in results if r['status'] == 'error']
print(json.dumps({'summary': {'ran': sum(r['status'] == 'ran' for r in results),
                              'skipped': sum(r['status'] == 'skipped' for r in results),
                              'errors': len(errors)}}, sort_keys=True))
sys.exit(1 if errors else 0)
