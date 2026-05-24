"""
media_processor.py — Image and video generation for the social pipeline.

process_carousel_images: 8 images — 7 gallery photos + stats card (1080x1080, 40% watermark)
process_reels_video:     8 s Reels — 3 images (gallery[0], gallery[1], stats card),
                         0.3 s crossfades, music 8 s at 20%
process_shorts_video:    45 s Shorts — 10 images (gallery[0-8] + stats card),
                         0.5 s crossfades, Ken Burns 1.0->1.08, music 45 s at 20%

Watermark: 40% opacity, bottom-right, applied at image generation time.
Gallery images: from set_data['gallery_images'] (LEGO.com high-res, >= 10 required).
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
    a = ImageEnhance.Brightness(a).enhance(0.40)
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


# ── Module 3a: Carousel images (8 = 7 gallery photos + stats card) ────────────

def _process_gallery_image(url: str, idx: int, set_num: str) -> str | None:
    """
    Download one gallery image URL, centre-contain on white 1080x1080, watermark.
    Returns saved path or None on failure.
    """
    try:
        raw    = _download_image(url)
        canvas = Image.new('RGBA', (1080, 1080), (255, 255, 255, 255))
        img    = _scale_to_contain(raw.copy(), 960, 960)
        canvas.paste(img,
                     ((1080 - img.width) // 2, (1080 - img.height) // 2),
                     img if img.mode == 'RGBA' else None)
        canvas    = _apply_watermark(canvas)
        out_path  = str(OUT_DIR / f'{set_num}_feed_{idx}.jpg')
        canvas.convert('RGB').save(out_path, 'JPEG', quality=95)
        return out_path
    except Exception as exc:
        print(f'[media] WARNING: gallery image {idx} failed ({url[:60]}): {exc}')
        return None


def process_carousel_images(set_data: dict) -> list:
    """
    Generates 10 product images: 9 gallery photos + stats card (last).

    Source: set_data['gallery_images'] — list of LEGO.com high-res URLs.
    Requires at least 9 gallery images. Each image: 1080x1080, white canvas,
    contained, watermarked at 40% opacity.

    Returns 10 local file paths — callers slice as needed:
      Instagram carousel (8): paths[:7] + [paths[-1]]
      YouTube Shorts   (10): paths          (all)
      Instagram Reels   (3): [paths[0], paths[1], paths[-1]]
    """
    set_num        = set_data['set_num']
    gallery_images = set_data.get('gallery_images') or []

    if len(gallery_images) < 9:
        raise ValueError(
            f'Need >= 9 gallery images for {set_num}, got {len(gallery_images)}. '
            f'Run scraper with LEGO.com gallery enrichment first.'
        )

    print(f'[media] Generating 10 product images for {set_num} '
          f'({len(gallery_images)} gallery URLs available)...')

    paths = []

    # ── Images 1-9: gallery photos ────────────────────────────────────────────
    # Try URLs in order; if one fails (network error / bad image), skip it and
    # try the next. We have 20-50 URLs available so failures are recoverable.
    slot = 1
    for url in gallery_images:
        if slot > 9:
            break
        path = _process_gallery_image(url, slot, set_num)
        if path:
            paths.append(path)
            print(f'[media] Image {slot}/10 saved: {Path(path).name}')
            slot += 1
        else:
            print(f'[media] Image slot {slot} FAILED for {url[:60]}... -- trying next URL')

    if len(paths) < 9:
        raise ValueError(
            f'Only {len(paths)}/9 gallery images from {len(gallery_images)} URLs for {set_num}. '
            f'All available URLs exhausted or failed.'
        )

    # ── Image 10: BOI stats card ──────────────────────────────────────────────
    stats_canvas = _make_stats_card(set_data)
    stats_path   = str(OUT_DIR / f'{set_num}_feed_10.jpg')
    stats_canvas.convert('RGB').save(stats_path, 'JPEG', quality=95)
    print(f'[media] Image 10/10 saved (stats card): {Path(stats_path).name}')
    paths.append(stats_path)

    print(f'[media] Image generation complete: {len(paths)} images')
    return paths  # 10 paths: [gallery_1..9, stats_card]


# ── Module 3b: Video (30 s, multi-image carousel, Ken Burns 1.0->1.08, music 20%) ─

def _make_kb_clip(fg_arr: np.ndarray, bg_arr: np.ndarray,
                  seg_dur: float, fg_size: int, fg_y: int) -> 'VideoClip':
    """
    Factory: returns a VideoClip with Ken Burns zoom 1.0->1.08 for one slide.
    Defined as a module-level-style factory (not a closure over a loop variable)
    so each clip captures its own fg/bg arrays correctly.
    """
    from moviepy.editor import VideoClip

    def frame(t: float) -> np.ndarray:
        f      = bg_arr.copy()
        scale  = 1.0 + 0.08 * (t / seg_dur)
        new_sz = int(fg_size * scale)
        img    = Image.fromarray(fg_arr).resize((new_sz, new_sz), Image.LANCZOS)
        off    = (new_sz - fg_size) // 2
        crop   = np.array(img.crop((off, off, off + fg_size, off + fg_size)))
        f[fg_y:fg_y + fg_size, :] = crop
        return f

    return VideoClip(frame, duration=seg_dur)


def _build_video(set_data: dict, image_paths: list,
                 duration: float, trans: float, kb_zoom: float,
                 out_suffix: str) -> str:
    """
    Shared video builder used by process_reels_video and process_shorts_video.

    duration:   total video length in seconds
    trans:      crossfade duration between slides (seconds)
    kb_zoom:    Ken Burns zoom amount (e.g. 0.05 -> 1.0 to 1.05)
    out_suffix: output filename suffix ('_reels.mp4' or '_shorts.mp4')
    """
    from moviepy.editor import ImageClip, AudioFileClip, concatenate_videoclips
    import moviepy.audio.fx.all as afx

    set_num = set_data['set_num']
    n       = len(image_paths)
    # SEG_DUR chosen so n*SEG_DUR - (n-1)*trans == duration exactly
    SEG_DUR = (duration + (n - 1) * trans) / n
    FPS     = 30
    W, H    = 1080, 1920
    FG_SIZE = 1080
    FG_Y    = (H - FG_SIZE) // 2   # 420 px

    print(f'[media] Building {duration:.0f}s video ({out_suffix}): '
          f'{n} slides x {SEG_DUR:.2f}s, {trans}s crossfades, KB +{kb_zoom*100:.0f}%')

    # Blurred background from first slide (already a local file — no network call)
    raw     = Image.open(image_paths[0]).convert('RGB')
    shared_bg = np.array(
        ImageEnhance.Brightness(
            _scale_to_fill(raw.convert('RGB'), W, H).filter(ImageFilter.GaussianBlur(radius=20))
        ).enhance(0.40)
    )

    # Navy background for stats card
    navy_bg      = np.zeros((H, W, 3), dtype=np.uint8)
    navy_bg[:, :] = NAVY

    clips = []
    for i, path in enumerate(image_paths):
        fg       = np.array(Image.open(path).convert('RGB').resize((FG_SIZE, FG_SIZE), Image.LANCZOS))
        is_stats = (i == n - 1)
        bg       = navy_bg if is_stats else shared_bg

        if is_stats:
            static             = bg.copy()
            static[FG_Y:FG_Y + FG_SIZE, :] = fg
            clip = ImageClip(static, duration=SEG_DUR)
        else:
            # Ken Burns: use kb_zoom, not the hardcoded 0.08 from _make_kb_clip
            _fg, _bg, _sd, _fsz, _fy, _kbz = fg, bg, SEG_DUR, FG_SIZE, FG_Y, kb_zoom

            def _frame(t: float,
                       fg=_fg, bg=_bg, seg_dur=_sd,
                       fg_size=_fsz, fg_y=_fy, zoom=_kbz) -> np.ndarray:
                f      = bg.copy()
                scale  = 1.0 + zoom * (t / seg_dur)
                new_sz = int(fg_size * scale)
                img    = Image.fromarray(fg).resize((new_sz, new_sz), Image.LANCZOS)
                off    = (new_sz - fg_size) // 2
                crop   = np.array(img.crop((off, off, off + fg_size, off + fg_size)))
                f[fg_y:fg_y + fg_size, :] = crop
                return f

            from moviepy.editor import VideoClip
            clip = VideoClip(_frame, duration=SEG_DUR)

        if i > 0:
            clip = clip.crossfadein(trans)

        label = 'stats card (static)' if is_stats else f'Ken Burns +{kb_zoom*100:.0f}%'
        print(f'[media]  Slide {i + 1}/{n}: {label} {SEG_DUR:.2f}s -- {Path(path).name}')
        clips.append(clip)

    video = concatenate_videoclips(clips, padding=-trans, method='compose')
    print(f'[media] Assembled duration: {video.duration:.2f}s')

    has_audio = False
    if MUSIC_PATH.exists():
        try:
            audio = AudioFileClip(str(MUSIC_PATH))
            audio = audio.subclip(0, duration) if audio.duration > duration \
                    else afx.audio_loop(audio, duration=duration)
            audio     = audio.volumex(0.20)
            video     = video.set_audio(audio)
            has_audio = True
            print(f'[media] Music: {duration:.0f}s at 20% volume')
        except Exception as exc:
            print(f'[media] WARNING: music load failed: {exc}')
    else:
        print(f'[media] No music at {MUSIC_PATH} -- silent export')

    out_path = str(OUT_DIR / f'{set_num}{out_suffix}')
    video.write_videofile(
        out_path, fps=FPS, codec='libx264',
        audio_codec='aac' if has_audio else None,
        audio=has_audio, logger=None,
    )
    print(f'[media] Video saved: {out_path}')
    return out_path


def process_reels_video(set_data: dict, all_image_paths: list = None) -> str:
    """
    8-second Instagram Reels video.
    Uses: gallery[0], gallery[1], stats_card (3 slides).
    Ken Burns 1.0->1.05. 0.3s crossfades. Music 8s at 20%.
    """
    if not all_image_paths:
        all_image_paths = process_carousel_images(set_data)
    # [first gallery, second gallery, stats card]
    slides = [all_image_paths[0], all_image_paths[1], all_image_paths[-1]]
    return _build_video(set_data, slides,
                        duration=8.0, trans=0.3, kb_zoom=0.05,
                        out_suffix='_reels.mp4')



def process_video(set_data: dict, image_paths: list = None) -> str:
    """Backwards-compatible alias: calls process_reels_video."""
    return process_reels_video(set_data, image_paths)


if __name__ == '__main__':
    print('Media processor tests -- uses REAL LEGO.com gallery images\n')
    print('Requires set_data with gallery_images populated by scraper.\n')
    print('Run test_pipeline.py for full end-to-end test.')
    print('Run scraper.py directly to test gallery scraping.')

