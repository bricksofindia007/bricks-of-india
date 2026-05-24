"""
media_processor.py — Image and video generation for the social pipeline.

process_image: 1080x1080 feed image with watermark
process_video: 1080x1920 Reels/Shorts vertical video with Ken Burns effect
"""

import os
import sys
import tempfile
import requests
import numpy as np
from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent / '.env.local')

ASSETS_DIR = Path(__file__).parent / 'assets'
WATERMARK_PATH = ASSETS_DIR / 'watermark.png'
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
    """Scale image to cover target dimensions (may crop)."""
    img_w, img_h = image.size
    scale = max(target_w / img_w, target_h / img_h)
    new_w, new_h = int(img_w * scale), int(img_h * scale)
    img_scaled = image.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return img_scaled.crop((left, top, left + target_w, top + target_h))


# ── Module 3a: Image ──────────────────────────────────────────────────────────

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

    # 1080x1080 white canvas
    canvas = Image.new('RGBA', (1080, 1080), (255, 255, 255, 255))

    # Resize set image to fit within 900x900
    set_img = raw.copy()
    set_img = _scale_to_contain(set_img, 900, 900)

    # Center on canvas
    offset_x = (1080 - set_img.width) // 2
    offset_y = (1080 - set_img.height) // 2
    canvas.paste(set_img, (offset_x, offset_y), set_img if set_img.mode == 'RGBA' else None)

    # Overlay watermark bottom-right at 15% opacity
    if WATERMARK_PATH.exists():
        wm = Image.open(WATERMARK_PATH).convert('RGBA')
        # Scale watermark to max 20% of canvas width
        max_wm_w = int(1080 * 0.20)
        if wm.width > max_wm_w:
            ratio = max_wm_w / wm.width
            wm = wm.resize((max_wm_w, int(wm.height * ratio)), Image.LANCZOS)
        # Apply 15% opacity
        r, g, b, a = wm.split()
        a = ImageEnhance.Brightness(a).enhance(0.15)
        wm.putalpha(a)
        # Bottom-right with 20px margin
        wm_x = 1080 - wm.width - 20
        wm_y = 1080 - wm.height - 20
        canvas.paste(wm, (wm_x, wm_y), wm)
    else:
        print(f'[media] WARNING: watermark not found at {WATERMARK_PATH}')

    # Save as JPEG
    out_path = str(OUT_DIR / f'{set_num}_feed.jpg')
    canvas.convert('RGB').save(out_path, 'JPEG', quality=95)
    print(f'[media] Feed image saved: {out_path}')
    return out_path


# ── Module 3b: Video ──────────────────────────────────────────────────────────

def process_video(set_data: dict, image_path: str = None) -> str:
    """
    Builds a 1080x1920 Reels/Shorts video with Ken Burns effect.
    image_path: pre-processed 1080x1080 feed image. If None, process_image is called.
    Returns local path to {set_num}_reels.mp4.
    """
    # Import MoviePy here to avoid startup cost when only process_image is needed
    from moviepy.editor import VideoClip, CompositeVideoClip, ImageClip

    set_num = set_data['set_num']
    if image_path is None:
        image_path = process_image(set_data)

    print(f'[media] Building video for {set_num}...')

    # Load processed feed image as numpy array
    fg_pil = Image.open(image_path).convert('RGB')
    fg_array = np.array(fg_pil)

    # Build background: original set image, fill 1080x1920, blur + darken
    raw = _download_image(set_data['image_url'])
    bg_pil = _scale_to_fill(raw.convert('RGB'), 1080, 1920)
    bg_pil = bg_pil.filter(ImageFilter.GaussianBlur(radius=20))
    bg_pil = ImageEnhance.Brightness(bg_pil).enhance(0.40)  # 60% dark overlay
    bg_array = np.array(bg_pil)

    DURATION = 5.0
    FPS = 30
    W, H = 1080, 1920
    FG_W, FG_H = 1080, 1080
    FG_Y = (H - FG_H) // 2  # vertically centered

    # Ken Burns: scale 1.0 → 1.08 over 5 seconds, center crop
    def fg_frame(t: float) -> np.ndarray:
        scale = 1.0 + 0.08 * (t / DURATION)
        new_w = int(FG_W * scale)
        new_h = int(FG_H * scale)
        img = Image.fromarray(fg_array)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        left = (new_w - FG_W) // 2
        top = (new_h - FG_H) // 2
        cropped = np.array(img.crop((left, top, left + FG_W, top + FG_H)))
        # Composite onto 1080x1920 frame
        frame = bg_array.copy()
        frame[FG_Y:FG_Y + FG_H, 0:FG_W] = cropped
        return frame

    video = VideoClip(fg_frame, duration=DURATION)
    out_path = str(OUT_DIR / f'{set_num}_reels.mp4')
    video.write_videofile(
        out_path,
        fps=FPS,
        codec='libx264',
        audio=False,
        logger=None,
    )
    print(f'[media] Video saved: {out_path}')
    return out_path


if __name__ == '__main__':
    print('Step 3 — Testing media processor...\n')
    test_set = {
        'set_num': 'test-71861',
        'name': 'The Old Town 15th Anniversary',
        'theme': 'Ninjago',
        'num_parts': 4852,
        'image_url': 'https://cdn.rebrickable.com/media/sets/71861-1/165505.jpg',
        'usd_price': None,
    }
    try:
        img_path = process_image(test_set)
        print(f'\nFeed image: {img_path}')
        print('Open this file to verify watermark is visible bottom-right.')

        confirm = input('\nGenerate video too? This takes ~30s. [y/N]: ').strip().lower()
        if confirm == 'y':
            vid_path = process_video(test_set, img_path)
            print(f'Video: {vid_path}')
        print('\nStep 3 PASSED.')
    except Exception as exc:
        print(f'ERROR: {exc}')
        import traceback
        traceback.print_exc()
        sys.exit(1)
