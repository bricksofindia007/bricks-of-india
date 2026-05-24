"""
media_processor.py — Image and video generation for the social pipeline.

process_image:           1080x1080 feed image (main shot, white canvas)
process_carousel_images: returns [img1, img2, img3] — main shot, fill-crop, stats card
process_video:           1080x1920 Reels/Shorts with Ken Burns + background music at 15%
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


# ── Helpers ───────────────────────────────────────────────────────────────────

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
    """Scale image to cover target dimensions (centre-crops to exact size)."""
    img_w, img_h = image.size
    scale = max(target_w / img_w, target_h / img_h)
    new_w, new_h = int(img_w * scale), int(img_h * scale)
    img_scaled = image.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return img_scaled.crop((left, top, left + target_w, top + target_h))


def _apply_watermark(canvas: Image.Image) -> Image.Image:
    """Overlays watermark bottom-right at 15% opacity. Returns RGBA canvas."""
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
    wm_x = 1080 - wm.width - 20
    wm_y = 1080 - wm.height - 20
    canvas.paste(wm, (wm_x, wm_y), wm)
    return canvas


def _try_font(size: int) -> ImageFont.ImageFont:
    """Loads a bold system font at the given size, falls back to PIL default."""
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


# ── Image 3 helper: stats card ────────────────────────────────────────────────

def _make_stats_card(set_data: dict) -> Image.Image:
    """
    1080x1080 dark card showing set name, piece count, theme, set number.
    Used as the third carousel image.
    """
    canvas = Image.new('RGB', (1080, 1080), (13, 17, 23))
    draw = ImageDraw.Draw(canvas)

    # Top and bottom orange accent bars
    draw.rectangle([(0, 0), (1080, 8)], fill=(255, 165, 0))
    draw.rectangle([(0, 1072), (1080, 1080)], fill=(255, 165, 0))

    # ── Set name (centred, word-wrapped) ─────────────────────────────────────
    font_title = _try_font(58)
    name = set_data.get('name', 'Unknown Set')
    words = name.split()
    lines, line = [], ''
    for word in words:
        test = (line + ' ' + word).strip()
        bbox = draw.textbbox((0, 0), test, font=font_title)
        if bbox[2] - bbox[0] > 900 and line:
            lines.append(line)
            line = word
        else:
            line = test
    if line:
        lines.append(line)
    lines = lines[:3]  # cap at 3 lines

    y = 110
    for ln in lines:
        bbox = draw.textbbox((0, 0), ln, font=font_title)
        w = bbox[2] - bbox[0]
        draw.text(((1080 - w) // 2, y), ln, font=font_title, fill=(255, 255, 255))
        y += (bbox[3] - bbox[1]) + 14
    y += 30

    # Divider
    draw.rectangle([(140, y), (940, y + 2)], fill=(255, 165, 0))
    y += 44

    # ── Stats ─────────────────────────────────────────────────────────────────
    font_label = _try_font(34)
    font_value = _try_font(50)

    num_parts = set_data.get('num_parts') or 0
    theme = set_data.get('theme', '') or 'N/A'
    set_num = set_data.get('set_num', '')
    year = set_data.get('year', '')

    stats = [
        ('PIECES', f'{num_parts:,}' if num_parts else 'N/A'),
        ('THEME', str(theme)),
        ('SET NO.', set_num),
        ('YEAR', str(year)),
    ]

    for label, value in stats:
        if y + 120 > 1040:
            break
        draw.text((140, y), label, font=font_label, fill=(160, 160, 160))
        y += 42
        # Truncate long values so they don't overflow
        while value and draw.textbbox((0, 0), value, font=font_value)[2] > 900:
            value = value[:-1]
        draw.text((140, y), value, font=font_value, fill=(255, 255, 255))
        y += 62 + 14

    # ── Branding ──────────────────────────────────────────────────────────────
    font_brand = _try_font(30)
    brand = 'bricksofindia.com'
    bbox = draw.textbbox((0, 0), brand, font=font_brand)
    bw = bbox[2] - bbox[0]
    draw.text(((1080 - bw) // 2, 1030), brand, font=font_brand, fill=(255, 165, 0))

    return _apply_watermark(canvas)


# ── Module 3a: Single image (used by process_video + backwards compat) ────────

def process_image(set_data: dict) -> str:
    """
    Downloads set image, builds 1080x1080 feed image with watermark.
    Returns local path to {set_num}_feed.jpg.
    """
    set_num = set_data['set_num']
    image_url = set_data.get('image_url', '')

    if not image_url:
        raise ValueError(f'No image_url for set {set_num}')

    print(f'[media] Downloading set image for {set_num}...')
    raw = _download_image(image_url)

    # 1080x1080 white canvas, set image contained within 900x900
    canvas = Image.new('RGBA', (1080, 1080), (255, 255, 255, 255))
    set_img = _scale_to_contain(raw.copy(), 900, 900)
    offset_x = (1080 - set_img.width) // 2
    offset_y = (1080 - set_img.height) // 2
    canvas.paste(set_img, (offset_x, offset_y), set_img if set_img.mode == 'RGBA' else None)

    canvas = _apply_watermark(canvas)

    out_path = str(OUT_DIR / f'{set_num}_feed.jpg')
    canvas.convert('RGB').save(out_path, 'JPEG', quality=95)
    print(f'[media] Feed image saved: {out_path}')
    return out_path


# ── Module 3a-carousel: Three images for IG carousel ─────────────────────────

def process_carousel_images(set_data: dict) -> list:
    """
    Generates 3 carousel images for Instagram Feed.

    Image 1 ({set_num}_feed_1.jpg): main product shot — centred on white canvas
    Image 2 ({set_num}_feed_2.jpg): fill-crop variant — image fills full 1080x1080
    Image 3 ({set_num}_feed_3.jpg): stats card — dark background with set details

    Returns list of 3 local file paths.
    """
    set_num = set_data['set_num']
    image_url = set_data.get('image_url', '')
    if not image_url:
        raise ValueError(f'No image_url for set {set_num}')

    print(f'[media] Generating carousel images for {set_num}...')
    raw = _download_image(image_url)

    paths = []

    # ── Image 1: main product shot ────────────────────────────────────────────
    canvas1 = Image.new('RGBA', (1080, 1080), (255, 255, 255, 255))
    img1 = _scale_to_contain(raw.copy(), 900, 900)
    ox = (1080 - img1.width) // 2
    oy = (1080 - img1.height) // 2
    canvas1.paste(img1, (ox, oy), img1 if img1.mode == 'RGBA' else None)
    canvas1 = _apply_watermark(canvas1)
    path1 = str(OUT_DIR / f'{set_num}_feed_1.jpg')
    canvas1.convert('RGB').save(path1, 'JPEG', quality=95)
    print(f'[media] Carousel 1/3 saved: {path1}')
    paths.append(path1)

    # ── Image 2: fill-crop (editorial close-up) ───────────────────────────────
    img2 = _scale_to_fill(raw.convert('RGB'), 1080, 1080)
    canvas2 = _apply_watermark(img2)
    path2 = str(OUT_DIR / f'{set_num}_feed_2.jpg')
    canvas2.convert('RGB').save(path2, 'JPEG', quality=95)
    print(f'[media] Carousel 2/3 saved: {path2}')
    paths.append(path2)

    # ── Image 3: stats card ───────────────────────────────────────────────────
    canvas3 = _make_stats_card(set_data)
    path3 = str(OUT_DIR / f'{set_num}_feed_3.jpg')
    canvas3.convert('RGB').save(path3, 'JPEG', quality=95)
    print(f'[media] Carousel 3/3 saved: {path3}')
    paths.append(path3)

    return paths


# ── Module 3b: Video ──────────────────────────────────────────────────────────

def process_video(set_data: dict, image_path: str = None) -> str:
    """
    Builds a 1080x1920 Reels/Shorts video with Ken Burns effect and background
    music at 15% volume (from assets/background_music.mp4).
    Returns local path to {set_num}_reels.mp4.
    """
    from moviepy.editor import VideoClip, AudioFileClip
    import moviepy.audio.fx.all as afx

    set_num = set_data['set_num']
    if image_path is None:
        image_path = process_image(set_data)

    print(f'[media] Building video for {set_num}...')

    fg_pil = Image.open(image_path).convert('RGB')
    fg_array = np.array(fg_pil)

    raw = _download_image(set_data['image_url'])
    bg_pil = _scale_to_fill(raw.convert('RGB'), 1080, 1920)
    bg_pil = bg_pil.filter(ImageFilter.GaussianBlur(radius=20))
    bg_pil = ImageEnhance.Brightness(bg_pil).enhance(0.40)
    bg_array = np.array(bg_pil)

    DURATION = 5.0
    FPS = 30
    W, H = 1080, 1920
    FG_W, FG_H = 1080, 1080
    FG_Y = (H - FG_H) // 2

    # Ken Burns: scale 1.0 -> 1.08 over 5 seconds, centre crop
    def fg_frame(t: float) -> np.ndarray:
        scale = 1.0 + 0.08 * (t / DURATION)
        new_w = int(FG_W * scale)
        new_h = int(FG_H * scale)
        img = Image.fromarray(fg_array)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        left = (new_w - FG_W) // 2
        top = (new_h - FG_H) // 2
        cropped = np.array(img.crop((left, top, left + FG_W, top + FG_H)))
        frame = bg_array.copy()
        frame[FG_Y:FG_Y + FG_H, 0:FG_W] = cropped
        return frame

    video = VideoClip(fg_frame, duration=DURATION)

    # Background music at 15% volume
    has_audio = False
    if MUSIC_PATH.exists():
        try:
            audio = AudioFileClip(str(MUSIC_PATH))
            if audio.duration > DURATION:
                audio = audio.subclip(0, DURATION)
            else:
                audio = afx.audio_loop(audio, duration=DURATION)
            audio = audio.volumex(0.15)
            video = video.set_audio(audio)
            has_audio = True
            print('[media] Background music added at 15% volume')
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
    print('Step 3 — Testing media processor (carousel + music)...\n')
    test_set = {
        'set_num': 'test-71861',
        'name': 'The Old Town 15th Anniversary',
        'theme': 'Ninjago',
        'num_parts': 4852,
        'year': 2025,
        'image_url': 'https://cdn.rebrickable.com/media/sets/71861-1/165505.jpg',
        'usd_price': None,
    }

    # Test 1: carousel images
    print('--- Test 1: Carousel images ---')
    try:
        paths = process_carousel_images(test_set)
        for i, p in enumerate(paths, 1):
            print(f'  Image {i}: {p}')
        print('Carousel PASSED. Open all 3 images to verify watermarks.\n')
    except Exception as exc:
        print(f'Carousel FAILED: {exc}')
        import traceback; traceback.print_exc()
        sys.exit(1)

    # Test 2: video with music
    print('--- Test 2: Video with background music ---')
    confirm = input('Generate video with music? (~30s) [y/N]: ').strip().lower()
    if confirm == 'y':
        try:
            vid_path = process_video(test_set, paths[0])
            print(f'  Video: {vid_path}')
            print('Video PASSED. Play the file to confirm music is audible at low volume.')
        except Exception as exc:
            print(f'Video FAILED: {exc}')
            import traceback; traceback.print_exc()
            sys.exit(1)
