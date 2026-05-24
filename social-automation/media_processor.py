"""
media_processor.py — Image and video generation for the social pipeline.

process_image:           1080x1080 main product shot (white canvas, centred)
process_carousel_images: 3-5 images — main shot, middle variant(s), stats card
process_video:           1080x1920, 8 s, Ken Burns 1.0->1.12, music at 15%
"""

import os
import sys
import tempfile
import requests
import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageFont
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent / '.env.local')

ASSETS_DIR = Path(__file__).parent / 'assets'
WATERMARK_PATH = ASSETS_DIR / 'watermark.png'
MUSIC_PATH = ASSETS_DIR / 'background_music.mp4'
OUT_DIR = Path(__file__).parent / 'tmp'
OUT_DIR.mkdir(exist_ok=True)

# BOI brand palette
NAVY    = (15, 45, 107)     # #0F2D6B
SAFFRON = (247, 168, 0)     # #F7A800
WHITE   = (255, 255, 255)
GREY    = (180, 190, 210)   # muted blue-grey for secondary labels


# ── Low-level helpers ─────────────────────────────────────────────────────────

def _download_image(url: str) -> Image.Image:
    resp = requests.get(url, timeout=20)
    resp.raise_for_status()
    tmp = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
    tmp.write(resp.content)
    tmp.close()
    return Image.open(tmp.name).convert('RGBA')


def _scale_to_contain(image: Image.Image, max_w: int, max_h: int) -> Image.Image:
    image.thumbnail((max_w, max_h), Image.LANCZOS)
    return image


def _scale_to_fill(image: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Scale to cover target dimensions, centre-crop to exact size."""
    img_w, img_h = image.size
    scale = max(target_w / img_w, target_h / img_h)
    new_w, new_h = int(img_w * scale), int(img_h * scale)
    img_scaled = image.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top  = (new_h - target_h) // 2
    return img_scaled.crop((left, top, left + target_w, top + target_h))


def _apply_watermark(canvas: Image.Image) -> Image.Image:
    """Overlays watermark bottom-right at 15% opacity. Returns RGBA image."""
    if not WATERMARK_PATH.exists():
        print(f'[media] WARNING: watermark not found at {WATERMARK_PATH}')
        return canvas
    canvas = canvas.convert('RGBA')
    wm = Image.open(WATERMARK_PATH).convert('RGBA')
    max_wm_w = int(1080 * 0.20)
    if wm.width > max_wm_w:
        ratio = max_wm_w / wm.width
        wm = wm.resize((max_wm_w, int(wm.height * ratio)), Image.LANCZOS)
    r, g, b, a = wm.split()
    a = ImageEnhance.Brightness(a).enhance(0.15)
    wm.putalpha(a)
    canvas.paste(wm, (1080 - wm.width - 20, 1080 - wm.height - 20), wm)
    return canvas


def _try_font(size: int) -> ImageFont.ImageFont:
    """Loads a truetype font at the given size, falls back to PIL default."""
    candidates = [
        'C:/Windows/Fonts/arialbd.ttf',
        'C:/Windows/Fonts/arial.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/System/Library/Fonts/Helvetica.ttc',
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except (IOError, OSError):
            continue
    return ImageFont.load_default()


def _wrap_text(draw: ImageDraw.ImageDraw, text: str,
               font: ImageFont.ImageFont, max_width: int) -> list:
    """Word-wraps text into lines that fit within max_width pixels."""
    words = text.split()
    lines, line = [], ''
    for word in words:
        test = (line + ' ' + word).strip()
        if draw.textbbox((0, 0), test, font=font)[2] > max_width and line:
            lines.append(line)
            line = word
        else:
            line = test
    if line:
        lines.append(line)
    return lines


def _truncate_to_fit(draw: ImageDraw.ImageDraw, text: str,
                     font: ImageFont.ImageFont, max_width: int) -> str:
    """Truncates text with ellipsis to fit within max_width pixels."""
    if draw.textbbox((0, 0), text, font=font)[2] <= max_width:
        return text
    while len(text) > 1:
        text = text[:-1]
        if draw.textbbox((0, 0), text + '...', font=font)[2] <= max_width:
            return text + '...'
    return '...'


# ── Stats card (last carousel image) ─────────────────────────────────────────

def _make_stats_card(set_data: dict) -> Image.Image:
    """
    1080x1080 BOI-branded stats card.
    Navy background, saffron accents, India Price shown as '??' with
    'Price TBA - Coming Soon' subtitle.
    """
    canvas = Image.new('RGB', (1080, 1080), NAVY)
    draw = ImageDraw.Draw(canvas)

    # Top and bottom saffron accent bars
    draw.rectangle([(0, 0), (1080, 12)], fill=SAFFRON)
    draw.rectangle([(0, 1068), (1080, 1080)], fill=SAFFRON)

    # ── Brand header ──────────────────────────────────────────────────────────
    f_brand  = _try_font(30)
    f_domain = _try_font(22)

    txt = 'BRICKS OF INDIA'
    bw = draw.textbbox((0, 0), txt, font=f_brand)[2]
    draw.text(((1080 - bw) // 2, 28), txt, font=f_brand, fill=SAFFRON)

    txt = 'bricksofindia.com'
    bw = draw.textbbox((0, 0), txt, font=f_domain)[2]
    draw.text(((1080 - bw) // 2, 68), txt, font=f_domain, fill=GREY)

    # Thin saffron rule under header
    draw.rectangle([(80, 106), (1000, 109)], fill=SAFFRON)

    # ── Set name (centred, wrapped, max 3 lines) ──────────────────────────────
    f_name = _try_font(54)
    name   = set_data.get('name', 'Unknown Set')
    lines  = _wrap_text(draw, name, f_name, 900)[:3]

    y = 128
    for ln in lines:
        bbox = draw.textbbox((0, 0), ln, font=f_name)
        w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text(((1080 - w) // 2, y), ln, font=f_name, fill=WHITE)
        y += h + 14
    y += 22

    # Second saffron rule
    draw.rectangle([(80, y), (1000, y + 3)], fill=SAFFRON)
    y += 30

    # ── Stats: 2-column grid ──────────────────────────────────────────────────
    f_label = _try_font(28)
    f_value = _try_font(50)

    num_parts = set_data.get('num_parts') or 0
    theme     = str(set_data.get('theme') or 'N/A')
    set_num   = set_data.get('set_num', '')
    year      = str(set_data.get('year', ''))

    col_left, col_right = 90, 570
    col_max_w = 440  # max value width per column

    rows = [
        [('PIECES',     f'{num_parts:,}' if num_parts else 'N/A'),
         ('SET NUMBER', _truncate_to_fit(draw, set_num, f_value, col_max_w))],
        [('THEME',      _truncate_to_fit(draw, theme, f_value, col_max_w)),
         ('YEAR',       year)],
    ]

    for row in rows:
        for col_idx, (label, value) in enumerate(row):
            cx = col_left if col_idx == 0 else col_right
            draw.text((cx, y),      label, font=f_label, fill=GREY)
            draw.text((cx, y + 36), value, font=f_value, fill=WHITE)
        y += 36 + 58 + 22  # label height + value height + gap

    y += 16  # breathing room before price box

    # ── India Price box ───────────────────────────────────────────────────────
    box_h    = 250
    box_top  = y
    box_bot  = y + box_h
    box_pad  = 80  # horizontal inset from canvas edge

    draw.rounded_rectangle(
        [(box_pad, box_top), (1080 - box_pad, box_bot)],
        radius=18,
        fill=SAFFRON,
    )

    f_price_lbl = _try_font(28)
    f_price_val = _try_font(90)
    f_price_sub = _try_font(26)

    lbl = 'INDIA PRICE'
    bw = draw.textbbox((0, 0), lbl, font=f_price_lbl)[2]
    draw.text(((1080 - bw) // 2, box_top + 20), lbl, font=f_price_lbl, fill=NAVY)

    val = '??'
    bbox = draw.textbbox((0, 0), val, font=f_price_val)
    bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((1080 - bw) // 2, box_top + 60), val, font=f_price_val, fill=NAVY)

    sub = 'Price TBA - Coming Soon'
    bw = draw.textbbox((0, 0), sub, font=f_price_sub)[2]
    draw.text(((1080 - bw) // 2, box_top + 168), sub, font=f_price_sub, fill=NAVY)

    # ── Footer ────────────────────────────────────────────────────────────────
    f_footer = _try_font(28)
    footer   = 'bricksofindia.com'
    bw = draw.textbbox((0, 0), footer, font=f_footer)[2]
    footer_y = min(box_bot + 28, 1036)
    draw.text(((1080 - bw) // 2, footer_y), footer, font=f_footer, fill=SAFFRON)

    return _apply_watermark(canvas)


# ── Module 3a: Single image (main product shot) ───────────────────────────────

def process_image(set_data: dict) -> str:
    """
    Downloads set image, builds 1080x1080 white-canvas product shot.
    Returns local path to {set_num}_feed.jpg.
    """
    set_num   = set_data['set_num']
    image_url = set_data.get('image_url', '')
    if not image_url:
        raise ValueError(f'No image_url for set {set_num}')

    print(f'[media] Downloading set image for {set_num}...')
    raw = _download_image(image_url)

    canvas = Image.new('RGBA', (1080, 1080), (255, 255, 255, 255))
    img    = _scale_to_contain(raw.copy(), 900, 900)
    canvas.paste(img,
                 ((1080 - img.width) // 2, (1080 - img.height) // 2),
                 img if img.mode == 'RGBA' else None)
    canvas = _apply_watermark(canvas)

    out_path = str(OUT_DIR / f'{set_num}_feed.jpg')
    canvas.convert('RGB').save(out_path, 'JPEG', quality=95)
    print(f'[media] Feed image saved: {out_path}')
    return out_path


# ── Module 3a-carousel: 3-5 images ───────────────────────────────────────────

def process_carousel_images(set_data: dict) -> list:
    """
    Generates 3-5 carousel images for Instagram Feed.

    Image 1  ({set_num}_feed_1.jpg): main product shot — white canvas, centred [ALWAYS]
    Images 2+ ({set_num}_feed_2.jpg ...): middle variants
        - Uses additional image URLs from set_data['extra_image_urls'] if present
        - Falls back to a fill-crop (editorial) variant of the main image
        - Max 3 middle images (images 2-4)
    Last image ({set_num}_feed_{n}.jpg): BOI stats card [ALWAYS]

    Minimum 3 total (main + one middle + stats card).
    Maximum 5 total (main + three middles + stats card).

    Returns list of local file paths in order.
    """
    set_num   = set_data['set_num']
    image_url = set_data.get('image_url', '')
    if not image_url:
        raise ValueError(f'No image_url for set {set_num}')

    print(f'[media] Generating carousel images for {set_num}...')
    raw = _download_image(image_url)
    paths = []

    # ── Image 1: main product shot (white canvas, contain 900x900) ────────────
    canvas1 = Image.new('RGBA', (1080, 1080), (255, 255, 255, 255))
    img1    = _scale_to_contain(raw.copy(), 900, 900)
    canvas1.paste(img1,
                  ((1080 - img1.width) // 2, (1080 - img1.height) // 2),
                  img1 if img1.mode == 'RGBA' else None)
    canvas1  = _apply_watermark(canvas1)
    path1    = str(OUT_DIR / f'{set_num}_feed_1.jpg')
    canvas1.convert('RGB').save(path1, 'JPEG', quality=95)
    print(f'[media] Carousel 1 saved: {path1}')
    paths.append(path1)

    # ── Middle images (2 to 4) ────────────────────────────────────────────────
    # extra_image_urls: additional angles from future scraper enrichment
    extra_urls = set_data.get('extra_image_urls') or []
    extra_urls = extra_urls[:3]  # cap at 3 middle images

    if extra_urls:
        for idx, url in enumerate(extra_urls, start=2):
            try:
                extra_raw = _download_image(url)
                canvas_e  = Image.new('RGBA', (1080, 1080), (255, 255, 255, 255))
                img_e     = _scale_to_contain(extra_raw, 900, 900)
                canvas_e.paste(img_e,
                               ((1080 - img_e.width) // 2, (1080 - img_e.height) // 2),
                               img_e if img_e.mode == 'RGBA' else None)
                canvas_e  = _apply_watermark(canvas_e)
                path_e    = str(OUT_DIR / f'{set_num}_feed_{idx}.jpg')
                canvas_e.convert('RGB').save(path_e, 'JPEG', quality=95)
                print(f'[media] Carousel {idx} saved (extra angle): {path_e}')
                paths.append(path_e)
            except Exception as exc:
                print(f'[media] WARNING: could not load extra image {url}: {exc}')
    else:
        # Fallback: fill-crop (editorial close-up of the same image)
        img2   = _scale_to_fill(raw.convert('RGB'), 1080, 1080)
        canvas2 = _apply_watermark(img2)
        path2   = str(OUT_DIR / f'{set_num}_feed_2.jpg')
        canvas2.convert('RGB').save(path2, 'JPEG', quality=95)
        print(f'[media] Carousel 2 saved (fill-crop fallback): {path2}')
        paths.append(path2)

    # ── Last image: stats card ────────────────────────────────────────────────
    n         = len(paths) + 1
    canvas_s  = _make_stats_card(set_data)
    path_s    = str(OUT_DIR / f'{set_num}_feed_{n}.jpg')
    canvas_s.convert('RGB').save(path_s, 'JPEG', quality=95)
    print(f'[media] Carousel {n} saved (stats card): {path_s}')
    paths.append(path_s)

    print(f'[media] Carousel complete: {len(paths)} images')
    return paths


# ── Module 3b: Video (8 s, Ken Burns 1.0->1.12, music at 15%) ────────────────

def process_video(set_data: dict, image_path: str = None) -> str:
    """
    Builds a 1080x1920 Reels/Shorts video.
    - Duration: 8 seconds
    - Ken Burns zoom: 1.0 -> 1.12 over 8 seconds
    - Background music from assets/background_music.mp4 at 15% volume
    Returns local path to {set_num}_reels.mp4.
    """
    from moviepy.editor import VideoClip, AudioFileClip
    import moviepy.audio.fx.all as afx

    set_num = set_data['set_num']
    if image_path is None:
        image_path = process_image(set_data)

    print(f'[media] Building video for {set_num}...')

    fg_pil   = Image.open(image_path).convert('RGB')
    fg_array = np.array(fg_pil)

    raw    = _download_image(set_data['image_url'])
    bg_pil = _scale_to_fill(raw.convert('RGB'), 1080, 1920)
    bg_pil = bg_pil.filter(ImageFilter.GaussianBlur(radius=20))
    bg_pil = ImageEnhance.Brightness(bg_pil).enhance(0.40)
    bg_array = np.array(bg_pil)

    DURATION = 8.0
    FPS      = 30
    FG_W     = 1080
    FG_H     = 1080
    FG_Y     = (1920 - FG_H) // 2   # vertically centred in 1920

    # Ken Burns: smooth zoom 1.0 -> 1.12 over 8 seconds
    def fg_frame(t: float) -> np.ndarray:
        scale = 1.0 + 0.12 * (t / DURATION)
        new_w = int(FG_W * scale)
        new_h = int(FG_H * scale)
        img   = Image.fromarray(fg_array).resize((new_w, new_h), Image.LANCZOS)
        left  = (new_w - FG_W) // 2
        top   = (new_h - FG_H) // 2
        cropped  = np.array(img.crop((left, top, left + FG_W, top + FG_H)))
        frame    = bg_array.copy()
        frame[FG_Y:FG_Y + FG_H, 0:FG_W] = cropped
        return frame

    video     = VideoClip(fg_frame, duration=DURATION)
    has_audio = False

    if MUSIC_PATH.exists():
        try:
            audio = AudioFileClip(str(MUSIC_PATH))
            # Trim to exactly 8 seconds (first 8s of track)
            if audio.duration > DURATION:
                audio = audio.subclip(0, DURATION)
            else:
                audio = afx.audio_loop(audio, duration=DURATION)
            audio     = audio.volumex(0.15)
            video     = video.set_audio(audio)
            has_audio = True
            print('[media] Background music added at 15% volume (8 s)')
        except Exception as exc:
            print(f'[media] WARNING: could not load background music: {exc}')
    else:
        print(f'[media] No background music at {MUSIC_PATH} — exporting silent')

    out_path = str(OUT_DIR / f'{set_num}_reels.mp4')
    video.write_videofile(
        out_path,
        fps=FPS,
        codec='libx264',
        audio_codec='aac' if has_audio else None,
        audio=has_audio,
        logger=None,
    )
    print(f'[media] Video saved: {out_path}')
    return out_path


if __name__ == '__main__':
    print('Step 3 — Testing carousel (3 images) + 8s video with music...\n')
    test_set = {
        'set_num':   'test-11377',
        'name':      'The Lord of the Rings: Minas Tirith',
        'theme':     'LEGO Exclusive',
        'num_parts': 8278,
        'year':      2026,
        'image_url': 'https://cdn.rebrickable.com/media/sets/11377-1/172481.jpg',
        'usd_price': None,
    }

    # Test 1: carousel
    print('--- Test 1: Carousel images (3) ---')
    try:
        paths = process_carousel_images(test_set)
        for i, p in enumerate(paths, 1):
            size = Path(p).stat().st_size
            print(f'  Image {i}: {Path(p).name}  ({size:,} bytes)')
        print(f'Total images: {len(paths)} (expected 3 minimum)')
        print('Open all images to verify watermarks and stats card layout.\n')
    except Exception as exc:
        import traceback; traceback.print_exc()
        sys.exit(1)

    # Test 2: video with music
    print('--- Test 2: 8-second video with background music ---')
    confirm = input('Generate 8-second video with music? (~45s render) [y/N]: ').strip().lower()
    if confirm == 'y':
        try:
            vid = process_video(test_set, paths[0])
            size = Path(vid).stat().st_size
            print(f'  Video: {Path(vid).name}  ({size:,} bytes)')
            print('Play the file — confirm 8 seconds, music audible at low volume.\n')
        except Exception as exc:
            import traceback; traceback.print_exc()
            sys.exit(1)
