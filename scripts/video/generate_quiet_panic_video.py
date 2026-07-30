"""
generate_quiet_panic_video.py -- standalone script-gen-to-video pipeline for
the Quiet Panic format (Phase 2b, briefs/VID-QP-02.md sections 1-6).

Deliberately imports nothing from engine.py, publish.py, or gates.py --
same isolation precedent as publish_quiet_panic.py. The moviepy Ken Burns
technique, the Pillow ANTIALIAS compatibility patch, and the banned-
construction pattern list are duplicated here as their own independent
copies, not shared functions. Own output/temp directories, own gate
implementations, own DB writes (quiet_panic_posts only).

Test-batch entry point: --test-batch reads quiet_panic_test_candidates.json
(pre-validated segment scripts, not regenerated here) and runs each
through TTS -> gates -> assembly -> audio QC -> quiet_panic_posts insert.
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import requests
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

# moviepy 1.x calls PIL.Image.ANTIALIAS, removed in Pillow >=10. Same fix as
# engine.py:38-42 -- verified live in this environment (moviepy 1.0.3 +
# Pillow 10.3.0) that .resize() crashes without this patch.
if not hasattr(Image, "ANTIALIAS"):
    Image.ANTIALIAS = Image.LANCZOS

from moviepy.editor import AudioFileClip, ImageClip, VideoClip, concatenate_videoclips  # noqa: E402
from supabase import create_client  # noqa: E402
from elevenlabs.client import ElevenLabs  # noqa: E402


def get_secret(name: str, default: str = '') -> str:
    """Duplicated from secrets_util.py, same as publish_quiet_panic.py --
    kept local so this file has zero imports from anywhere else in
    scripts/video/."""
    return os.environ.get(name, default).lstrip('﻿').strip()


BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / '.env')

SUPABASE_URL = get_secret('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = get_secret('SUPABASE_SERVICE_ROLE_KEY')
ELEVENLABS_API_KEY_ASMR = get_secret('ELEVENLABS_API_KEY_ASMR')
BRICKSET_API_KEY = get_secret('BRICKSET_API_KEY')
REBRICKABLE_API_KEY = get_secret('REBRICKABLE_API_KEY')

VOICE_ID = 'thNHFcPYszCz6ZPG6mUp'  # Mira Whisper -- locked, briefs/VID-QP-01.md section 8
TTS_MODEL_ID = 'eleven_flash_v2_5'
TTS_VOICE_SETTINGS = {
    'stability': 0.5,
    'similarity_boost': 0.9,
    'use_speaker_boost': True,
    'style': 0.0,
    'speed': 1.0,
}

SFX_LIBRARY_DIR = BASE_DIR.parent.parent / 'assets' / 'sfx' / 'library'
SFX_PEAK_MANIFEST_PATH = SFX_LIBRARY_DIR / 'peak_levels.json'
BUMPERS_DIR = BASE_DIR.parent.parent / 'assets' / 'bumpers'
INTRO_BUMPER = BUMPERS_DIR / 'intro_final.mp3'
OUTRO_BUMPER = BUMPERS_DIR / 'outro_final.mp3'

# Shared DATA dependency with social-automation's SOC-AUTO-01 pipeline (the
# watermark asset itself), not a code import -- same precedent as reusing
# IG_ACCESS_TOKEN/YOUTUBE_CLIENT_SECRETS in publish_quiet_panic.py. Confirmed
# live on the Zombie Dungeon post (posted_sets id=45, ig_reels_posted and
# yt_shorts_posted both true) -- that post's Reels/Shorts frames came from
# process_carousel_images() -> _apply_watermark(), the same function this
# file's apply_watermark() below duplicates.
WATERMARK_PATH = BASE_DIR.parent.parent / 'social-automation' / 'assets' / 'watermark.png'

# Continuous "car being built" audio-bed asset (promoted from the v2
# candidate 2026-07-30) and its duck level under voice:true segments.
AUDIO_BED_SFX_TAG = 'car_build_texture'
AUDIO_BED_DUCK_CEILING_DB = -18.0

# Own directories -- deliberately separate from engine.py's output/ and
# temp_download/ (isolation precedent; avoids any slug/filename collision).
OUTPUT_DIR = BASE_DIR / 'output_quiet_panic'
TEMP_DIR = BASE_DIR / 'temp_quiet_panic'
OUTPUT_DIR.mkdir(exist_ok=True)
TEMP_DIR.mkdir(exist_ok=True)

TARGET_W, TARGET_H = 1080, 1920
FPS = 30
KEN_BURNS_ZOOM = 0.04
FG_SIZE = TARGET_W
FG_Y = (TARGET_H - FG_SIZE) // 2

DURATION_TARGET_MIN = 45.0
DURATION_TARGET_MAX = 55.0
DURATION_TOLERANCE = 0.10  # +-10% per briefs/VID-QP-02.md section 3

# Minimum on-screen duration floor for voice:false segments, driven by
# caption reading speed rather than the SFX asset's own (often much
# shorter) length -- 15 chars/sec is a comfortable, commonly-used subtitle
# reading pace. The segment's accent SFX still plays once; the continuous
# car_build_texture bed (see mix_bed_into_segment) fills any extra time.
READING_SPEED_CPS = 15.0

# Duplicated from scripts/video/gates.py BANNED_PATTERNS (gates.py:21-58) --
# not imported, per this build's isolation precedent. Quiet Panic is a
# spoken-script format like VID-P4, so the same spoken-word bans apply.
BANNED_PATTERNS = [
    r"today we'?re looking",
    r"lego has announced",
    r"\bhello\b",
    r"hey everyone",
    r"\bwelcome\b",
    r"^\s*so,",
    r"\bfollow\b",
    r"\blike (and |, )?(subscribe|comment|follow)\b",
    r"\bhit (that |the )?like\b",
    r"\bsmash (that |the )?like\b",
    r"\blike (this|the) video\b",
    r"\blike button\b",
    r"\bsubscribe\b",
    r"\bcomment\b",
    r"\bromanticism\b",
    r"\barchitectural\b",
    r"\bgrandeur\b",
    r"\btestament\b",
    r"\bmagnificence\b",
    r"\bquintessential\b",
    r"\bundeniable statement\b",
    r"\bmakes a statement\b",
    r"\bcommands attention\b",
]

# New for Quiet Panic -- small manually curated list per briefs/VID-QP-01.md
# section 2's rule ("no words like 'hubris' that need a dictionary") and
# briefs/VID-QP-02.md section 3's vocabulary-complexity gate. Start small,
# refine once there's real failure data (per the brief's own instruction).
VOCAB_COMPLEXITY_BANNED_WORDS = [
    'hubris', 'quintessential', 'juxtaposition', 'ephemeral', 'ubiquitous',
    'paradigm', 'eloquent', 'esoteric', 'ostentatious', 'grandiloquent',
    'perfunctory', 'sanguine', 'vicissitude', 'perspicacious',
]


class GateFailureError(Exception):
    pass


def get_supabase():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print('ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.', file=sys.stderr)
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# ---------------------------------------------------------------------------
# Image fetching -- simplified duplicate of engine.py's Brickset-primary /
# Rebrickable-fallback approach (engine.py:106-167). Deliberately SKIPS the
# studio/lifestyle image classifier engine.py applies (classify_image /
# filter_studio_images) -- that's a quality refinement, not needed to prove
# out this first test batch. Flagged as a simplification, not hidden.
# ---------------------------------------------------------------------------

def brickset_gallery_images(set_number: str) -> list:
    if not BRICKSET_API_KEY:
        return []
    try:
        r = requests.get(
            'https://brickset.com/api/v3.asmx/getSets',
            params={
                'apiKey': BRICKSET_API_KEY,
                'userHash': '',
                'params': json.dumps({'setNumber': f'{set_number}-1', 'pageSize': 1}),
            },
            timeout=15,
        )
        if r.status_code != 200:
            return []
        found = r.json().get('sets', [])
        if not found:
            return []
        set_id = found[0].get('setID')
        main_img = (found[0].get('image') or {}).get('imageURL', '')
    except Exception as e:
        print(f'WARN: Brickset getSets lookup failed for {set_number}: {e}', file=sys.stderr)
        return []
    if not set_id:
        return []

    images = []
    try:
        r2 = requests.get(
            'https://brickset.com/api/v3.asmx/getAdditionalImages',
            params={'apiKey': BRICKSET_API_KEY, 'setID': set_id},
            timeout=15,
        )
        if r2.status_code == 200:
            for item in r2.json().get('additionalImages', []):
                url = item.get('imageURL', '')
                if url:
                    images.append(url)
    except Exception as e:
        print(f'WARN: Brickset getAdditionalImages failed for {set_number}: {e}', file=sys.stderr)

    if main_img and main_img not in images:
        images = [main_img] + images
    return images


def rebrickable_main_image(set_number: str):
    if not REBRICKABLE_API_KEY:
        return None
    try:
        r = requests.get(
            f'https://rebrickable.com/api/v3/lego/sets/{set_number}-1/',
            headers={'Authorization': f'key {REBRICKABLE_API_KEY}'},
            timeout=15,
        )
        if r.status_code == 200:
            return r.json().get('set_img_url')
    except Exception as e:
        print(f'WARN: Rebrickable lookup failed for {set_number}: {e}', file=sys.stderr)
    return None


def apply_watermark(canvas: Image.Image) -> Image.Image:
    """Bottom-right BOI watermark, applied to source images before Ken Burns
    pan/zoom -- duplicated from social-automation/media_processor.py's
    _apply_watermark (same asset via WATERMARK_PATH, same 20%-of-width cap /
    40% opacity / 20px margin), not imported, per this file's isolation
    precedent. That original applies the margin/cap against a fixed 1080x1080
    canvas; this version uses the actual source image's own dimensions
    (product photos here aren't guaranteed to be 1080x1080), same ratios."""
    if not WATERMARK_PATH.exists():
        print(f'WARN: watermark not found at {WATERMARK_PATH}', file=sys.stderr)
        return canvas
    canvas = canvas.convert('RGBA')
    wm = Image.open(WATERMARK_PATH).convert('RGBA')
    max_wm_w = int(canvas.width * 0.20)
    if wm.width > max_wm_w:
        ratio = max_wm_w / wm.width
        wm = wm.resize((max_wm_w, int(wm.height * ratio)), Image.LANCZOS)
    r, g, b, a = wm.split()
    a = ImageEnhance.Brightness(a).enhance(0.40)
    wm.putalpha(a)
    canvas.paste(wm, (canvas.width - wm.width - 20, canvas.height - wm.height - 20), wm)
    return canvas.convert('RGB')


def download_images(urls: list, dest_dir: Path, max_images: int = 8, prefix: str = 'img') -> list:
    paths = []
    for i, url in enumerate(urls[:max_images]):
        try:
            resp = requests.get(url, timeout=20)
            resp.raise_for_status()
            path = dest_dir / f'{prefix}_{i}.jpg'
            img = Image.open(__import__('io').BytesIO(resp.content))
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                img = img.convert('RGBA')
                flattened = Image.new('RGB', img.size, (255, 255, 255))
                flattened.paste(img, mask=img.split()[3])
                img = flattened
            else:
                img = img.convert('RGB')
            img = apply_watermark(img)
            img.save(path, 'JPEG', quality=95)
            paths.append(path)
        except Exception as e:
            print(f'WARN: failed to download image {url}: {e}', file=sys.stderr)
    return paths


def resolve_candidate_images(set_number: str, fallback_url: str, dest_dir: Path) -> list:
    urls = brickset_gallery_images(set_number)
    if not urls:
        rb_url = rebrickable_main_image(set_number)
        urls = [rb_url] if rb_url else ([fallback_url] if fallback_url else [])
    paths = download_images(urls, dest_dir, max_images=8, prefix='qp_img')
    if not paths and fallback_url:
        paths = download_images([fallback_url], dest_dir, max_images=1, prefix='qp_fallback')
    return paths


# ---------------------------------------------------------------------------
# TTS per segment -- ElevenLabs, measure real output duration (design note,
# briefs/VID-QP-02.md section 0: target_duration is a planning estimate,
# never authoritative).
# ---------------------------------------------------------------------------

def render_segment_tts(client: ElevenLabs, text: str, out_path: Path) -> float:
    audio = client.text_to_speech.convert(
        voice_id=VOICE_ID, text=text, model_id=TTS_MODEL_ID,
        voice_settings=TTS_VOICE_SETTINGS, output_format='mp3_44100_128',
    )
    with open(out_path, 'wb') as f:
        for chunk in audio:
            f.write(chunk)
    return ffprobe_duration(out_path)


def ffprobe_duration(path: Path) -> float:
    r = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'default=noprint_wrappers=1:nokey=1', str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(r.stdout.strip())


# ---------------------------------------------------------------------------
# Audio processing -- de-esser on voice only, explicit gain-staged EQ/boost
# on SFX per track type, per-segment mix (SFX overlaid at segment start,
# trimmed to the voice segment's own measured duration so total timeline
# timing stays 1:1 with the Ken Burns video clips), final two-pass
# (measured) loudnorm applied once across the whole assembled track.
# ---------------------------------------------------------------------------

def apply_deesser(in_path: Path, out_path: Path) -> None:
    subprocess.run(
        ['ffmpeg', '-y', '-i', str(in_path), '-af', 'deesser',
         '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', str(out_path)],
        check=True, capture_output=True,
    )


def apply_sfx_eq(in_path: Path, out_path: Path, gain_db: float = 3.0) -> None:
    """For voice=true segments with an accent sfx_tag: SFX stays clearly
    audible but subordinate to voice. 4-8kHz EQ lift (centered peaking EQ
    at 6kHz) plus a moderate gain boost -- present, not full prominence.
    Paired with mix_sfx_over_voice's amix normalize=0, this gain is what
    actually sets the SFX's relative level in the final mix."""
    subprocess.run(
        ['ffmpeg', '-y', '-i', str(in_path), '-af',
         f'equalizer=f=6000:width_type=h:width=4000:g=6,volume={gain_db}dB',
         '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', str(out_path)],
        check=True, capture_output=True,
    )


def db_to_linear(db: float) -> float:
    return 10 ** (db / 20)


def measure_peak_db(path: Path) -> float:
    """Whole-file peak level via ffmpeg volumedetect's max_volume -- measured
    over the entire file, unlike a windowed/reset stats filter."""
    r = subprocess.run(
        ['ffmpeg', '-i', str(path), '-af', 'volumedetect', '-f', 'null', '-'],
        capture_output=True, text=True, check=True,
    )
    for line in r.stderr.splitlines():
        line = line.strip()
        if 'max_volume' in line:
            return float(line.split(':')[-1].strip().rstrip('dB').strip())
    raise RuntimeError(f'volumedetect produced no max_volume for {path}')


def build_sfx_peak_manifest() -> dict:
    """Measures every file in assets/sfx/library/ once and writes
    peak_levels.json there -- apply_sfx_boost reads this manifest instead
    of re-measuring on every run. Re-run this (via --build-sfx-manifest)
    whenever a library file is added or replaced."""
    manifest = {}
    for p in sorted(SFX_LIBRARY_DIR.glob('*.mp3')):
        peak = measure_peak_db(p)
        manifest[p.stem] = peak
        print(f'  measured {p.stem}: {peak:.2f} dB peak')
    with open(SFX_PEAK_MANIFEST_PATH, 'w') as f:
        json.dump(manifest, f, indent=2, sort_keys=True)
    print(f'  wrote {SFX_PEAK_MANIFEST_PATH}')
    return manifest


def load_sfx_peak_manifest() -> dict:
    if not SFX_PEAK_MANIFEST_PATH.exists():
        raise FileNotFoundError(
            f'{SFX_PEAK_MANIFEST_PATH} not found -- run with --build-sfx-manifest first.'
        )
    with open(SFX_PEAK_MANIFEST_PATH) as f:
        return json.load(f)


def apply_sfx_boost(in_path: Path, out_path: Path, target_ceiling_db: float = -3.0) -> None:
    """For voice=false segments: SFX is the PRIMARY audio for that segment,
    not an accent under voice. Gain is peak-relative, not a flat additive
    dB: gain = target_ceiling_db - measured_peak_db (measured_peak_db read
    from peak_levels.json, built by build_sfx_peak_manifest) so every clip
    lands at the same target ceiling regardless of how hot or quiet its
    source recording already is -- a flat +6dB constant clipped files that
    were already peaking close to 0dBFS. target_ceiling_db defaults to
    -3dB, leaving headroom before the final loudnorm pass rather than
    pushing every clip right up to 0dBFS. An alimiter safety net (ceiling
    -1dB, soft knee, output-level compensation disabled so it only limits
    rather than re-boosting) follows the gain stage in case the EQ lift or
    a miscalculated/future louder SFX file would still push a peak over."""
    manifest = load_sfx_peak_manifest()
    measured_peak_db = manifest.get(in_path.stem)
    if measured_peak_db is None:
        measured_peak_db = measure_peak_db(in_path)
    gain_db = target_ceiling_db - measured_peak_db
    limiter_limit = db_to_linear(-1.0)
    subprocess.run(
        ['ffmpeg', '-y', '-i', str(in_path), '-af',
         f'equalizer=f=6000:width_type=h:width=4000:g=6,volume={gain_db}dB,'
         f'alimiter=limit={limiter_limit}:level=disabled',
         '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', str(out_path)],
        check=True, capture_output=True,
    )


def mix_sfx_over_voice(voice_path: Path, sfx_path: Path, out_path: Path) -> None:
    """Overlays sfx_path onto the start of voice_path, output trimmed to
    voice's own duration (duration=first) -- SFX never extends segment
    timing beyond the measured voice length. normalize=0 so amix does not
    auto-scale each input's level to avoid clipping -- relative levels are
    controlled explicitly via the gain staging applied to each track
    beforehand (apply_sfx_eq / apply_sfx_boost), not left to amix."""
    subprocess.run(
        ['ffmpeg', '-y', '-i', str(voice_path), '-i', str(sfx_path),
         '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]',
         '-map', '[aout]', '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', str(out_path)],
        check=True, capture_output=True,
    )


def extract_bed_slice(bed_path: Path, duration: float, start_offset: float, out_path: Path) -> None:
    """Loops the (short) audio-bed source infinitely via -stream_loop, then
    slices out exactly `duration` seconds starting at a rolling
    `start_offset` -- consecutive segments pull from a different phase of
    the loop instead of all restarting at t=0, so the repeat is less
    obvious across a single video's body."""
    subprocess.run(
        ['ffmpeg', '-y', '-stream_loop', '-1', '-i', str(bed_path),
         '-ss', str(start_offset), '-t', str(duration),
         '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', str(out_path)],
        check=True, capture_output=True,
    )


def mix_bed_into_segment(segment_audio_path: Path, bed_path: Path, out_path: Path) -> None:
    """Layers the continuous construction-texture bed under an already-
    finalized segment audio track (voice(+accent) mix, or the primary SFX
    for voice=false segments). Same amix normalize=0 explicit-gain-staging
    pattern as mix_sfx_over_voice -- a separate function since this is a
    conceptually distinct layer (whole-body bed, not a per-segment accent),
    not because the ffmpeg call itself differs.

    duration=longest, not first: the bed slice is always cut to exactly
    seg['measured_duration'] (see process_candidate), but for voice=false
    segments under the reading-speed floor, that duration can now exceed
    the segment's own SFX asset length -- duration=first would trim the
    output back down to the (shorter) SFX length and throw away the extra
    bed time the floor exists to provide. For voice=true segments the two
    inputs are already the same length, so this is a no-op change there."""
    subprocess.run(
        ['ffmpeg', '-y', '-i', str(segment_audio_path), '-i', str(bed_path),
         '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[aout]',
         '-map', '[aout]', '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', str(out_path)],
        check=True, capture_output=True,
    )


def concat_audio(paths: list, out_path: Path) -> None:
    list_file = out_path.parent / f'{out_path.stem}_concat_list.txt'
    with open(list_file, 'w') as f:
        for p in paths:
            f.write(f"file '{p.resolve().as_posix()}'\n")
    subprocess.run(
        ['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', str(list_file),
         '-c:a', 'libmp3lame', '-b:a', '128k', '-ar', '44100', str(out_path)],
        check=True, capture_output=True,
    )
    list_file.unlink()


def measure_loudnorm(in_path: Path) -> dict:
    """Pass 1 of two-pass loudnorm: measure the track's actual integrated
    loudness/true-peak/LRA against the -14 LUFS / -1dB TP / 11 LRA target,
    without altering the audio. loudnorm writes its measurement JSON to
    stderr (the null-muxer run produces no audio output)."""
    r = subprocess.run(
        ['ffmpeg', '-i', str(in_path), '-af',
         'loudnorm=I=-14:TP=-1:LRA=11:print_format=json',
         '-f', 'null', '-'],
        capture_output=True, text=True, check=True,
    )
    json_start = r.stderr.rindex('{')
    json_end = r.stderr.rindex('}') + 1
    return json.loads(r.stderr[json_start:json_end])


def apply_final_loudnorm(in_path: Path, out_path: Path) -> None:
    """Two-pass loudnorm (~-14 LUFS integrated, ~-1dB true peak, 11 LRA),
    applied exactly once on the fully assembled final composite track.
    Pass 1 (measure_loudnorm) measures actual input loudness/peak/LRA;
    pass 2 feeds those measured_* values back in with linear=true so the
    correction is a precise single computed gain rather than single-pass
    loudnorm's on-the-fly estimate -- the on-the-fly estimate is what let
    the voice-dominated mix get boosted well past already-peaked SFX."""
    measured = measure_loudnorm(in_path)
    af = (
        'loudnorm=I=-14:TP=-1:LRA=11:'
        f'measured_I={measured["input_i"]}:'
        f'measured_TP={measured["input_tp"]}:'
        f'measured_LRA={measured["input_lra"]}:'
        f'measured_thresh={measured["input_thresh"]}:'
        f'offset={measured["target_offset"]}:'
        'linear=true:print_format=summary'
    )
    subprocess.run(
        ['ffmpeg', '-y', '-i', str(in_path), '-af', af,
         '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', str(out_path)],
        check=True, capture_output=True,
    )


# ---------------------------------------------------------------------------
# Ken Burns video clip -- duplicated algorithm from engine.py:950-987
# (make_ken_burns_clip / _scale_to_fill_pil). Same visual technique, own
# copy, driven here by each segment's MEASURED audio duration rather than
# per_image = total/N.
# ---------------------------------------------------------------------------

def _scale_to_fill_pil(image: Image.Image, target_w: int, target_h: int) -> Image.Image:
    img_w, img_h = image.size
    scale = max(target_w / img_w, target_h / img_h)
    new_w, new_h = int(img_w * scale), int(img_h * scale)
    resized = image.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def make_ken_burns_clip(image_path: Path, duration_s: float, zoom: float = KEN_BURNS_ZOOM):
    raw = Image.open(image_path).convert('RGB')

    bg_img = _scale_to_fill_pil(raw.copy(), TARGET_W, TARGET_H)
    bg_img = bg_img.filter(ImageFilter.GaussianBlur(radius=20))
    bg_img = ImageEnhance.Brightness(bg_img).enhance(0.40)
    bg_arr = np.array(bg_img)

    fg_img = raw.copy()
    fg_img.thumbnail((FG_SIZE, FG_SIZE), Image.LANCZOS)
    fg_canvas = Image.new('RGB', (FG_SIZE, FG_SIZE), (255, 255, 255))
    fg_canvas.paste(fg_img, ((FG_SIZE - fg_img.width) // 2, (FG_SIZE - fg_img.height) // 2))
    fg_arr = np.array(fg_canvas)

    def make_frame(t):
        frame = bg_arr.copy()
        scale = 1.0 + zoom * (t / duration_s)
        new_size = max(FG_SIZE, int(FG_SIZE * scale))
        zoomed = np.array(Image.fromarray(fg_arr).resize((new_size, new_size), Image.LANCZOS))
        left = (new_size - FG_SIZE) // 2
        zoomed = zoomed[left:left + FG_SIZE, left:left + FG_SIZE]
        frame[FG_Y:FG_Y + FG_SIZE, :] = zoomed
        return frame

    return VideoClip(make_frame, duration=duration_s)


def make_static_card_clip(lines: list, duration_s: float, bg_color=(15, 20, 30)) -> ImageClip:
    """Placeholder visual for the audio-only intro/outro bumpers -- no
    dedicated intro/outro VIDEO asset exists yet (only the locked audio
    bumpers from Phase 2a). Simple static brand card, same idea as
    engine.py's _make_placeholder_anchor. Flagged as a placeholder, not a
    real brand asset."""
    img = Image.new('RGB', (TARGET_W, TARGET_H), bg_color)
    draw = ImageDraw.Draw(img)
    font = _caption_font(72, italic=False)
    y = TARGET_H // 2 - (len(lines) * 90) // 2
    for line in lines:
        w = draw.textbbox((0, 0), line, font=font)[2]
        x = (TARGET_W - w) // 2
        draw.text((x, y), line, font=font, fill=(255, 199, 44))  # brand yellow
        y += 90
    img = apply_watermark(img)
    return ImageClip(np.array(img)).set_duration(duration_s)


# ---------------------------------------------------------------------------
# Captions -- burned in via PIL per-frame compositor (same non-TextClip
# approach as engine.py, since TextClip needs ImageMagick), but a distinct
# lighter/italic style from the main review pipeline's bold caption look,
# timed off MEASURED segment durations (not Whisper re-transcription --
# we already have the exact segment text, no need to re-derive it).
# ---------------------------------------------------------------------------

_CAPTION_FONT_CANDIDATES_ITALIC = [
    'C:/Windows/Fonts/ariali.ttf',
    'C:/Windows/Fonts/georgiai.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf',
]
_CAPTION_FONT_CANDIDATES_REGULAR = [
    'C:/Windows/Fonts/arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
]


def _caption_font(size: int, italic: bool = True):
    candidates = _CAPTION_FONT_CANDIDATES_ITALIC if italic else _CAPTION_FONT_CANDIDATES_REGULAR
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except (IOError, OSError):
            continue
    return ImageFont.load_default()


def _wrap_caption_text(draw, text: str, font, max_width: int) -> list:
    words = text.split()
    lines, current = [], ''
    for w in words:
        trial = f'{current} {w}'.strip()
        if draw.textbbox((0, 0), trial, font=font)[2] <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines


def render_caption_frame(text: str, font, max_width: int, caption_y: int, canvas_size=(TARGET_W, TARGET_H)):
    """Shared caption compositor -- used by both burn_captions (video
    pipeline) and the standalone still-frame test harness, so a legibility
    fix here applies identically to both.

    Fixed 2026-07-29: VID-P4's own caption code (engine.py:1270-1309) already
    uses an 8-direction +-2px FULLY OPAQUE black outline. This pipeline's
    first pass was weaker -- 4-direction +-1px at 78% opacity, no shadow --
    which is the actual legibility gap, not something VID-P4 already solved
    that this pipeline failed to copy. Now: a ~2px round outline (all
    integer offsets within radius ~2.2) at full opacity, plus a soft
    Gaussian-blurred drop shadow underneath, on top of the same lighter/
    italic font weight (unchanged, that part was correct already)."""
    frame = np.zeros((canvas_size[1], canvas_size[0], 4), dtype=np.uint8)
    img = Image.fromarray(frame, 'RGBA')
    draw = ImageDraw.Draw(img)
    lines = _wrap_caption_text(draw, text, font, max_width)
    line_height = int(font.size * 1.3)
    total_h = line_height * len(lines)
    y_start = caption_y - total_h // 2

    line_positions = []
    y = y_start
    for line in lines:
        w = draw.textbbox((0, 0), line, font=font)[2]
        x = (canvas_size[0] - w) // 2
        line_positions.append((line, x, y))
        y += line_height

    # 0. Semi-transparent dark backing plate behind the text, sized to the
    # wrapped text's own bounding box (not a full-width bar) -- guarantees
    # contrast against any background, including bright white LEGO box
    # renders, without reading as a heavy black bar. 130/255 (~51%) opacity,
    # rounded corners.
    max_line_w = max(draw.textbbox((0, 0), line, font=font)[2] for line, _, _ in line_positions)
    plate_pad_x, plate_pad_y = 28, 16
    plate_w = max_line_w + plate_pad_x * 2
    plate_h = total_h + plate_pad_y * 2
    plate_x = (canvas_size[0] - plate_w) // 2
    plate_y = y_start - plate_pad_y
    plate_layer = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    plate_draw = ImageDraw.Draw(plate_layer)
    plate_draw.rounded_rectangle(
        [plate_x, plate_y, plate_x + plate_w, plate_y + plate_h],
        radius=18, fill=(0, 0, 0, 130),
    )
    img = Image.alpha_composite(img, plate_layer)
    draw = ImageDraw.Draw(img)

    # 1. Soft blurred drop shadow, offset down-right.
    shadow_layer = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow_layer)
    for line, x, y in line_positions:
        shadow_draw.text((x + 4, y + 6), line, font=font, fill=(0, 0, 0, 190))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=3))
    img = Image.alpha_composite(img, shadow_layer)
    draw = ImageDraw.Draw(img)

    # 2. Thick (~2px radius) fully-opaque black outline.
    offsets = [(dx, dy) for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2)
               if (dx, dy) != (0, 0) and dx * dx + dy * dy <= 5]
    for line, x, y in line_positions:
        for dx, dy in offsets:
            draw.text((x + dx, y + dy), line, font=font, fill=(0, 0, 0, 255))

    # 3. White fill on top.
    for line, x, y in line_positions:
        draw.text((x, y), line, font=font, fill=(255, 255, 255, 255))

    return np.array(img)


def burn_captions(video_clip, segments_timed: list):
    """segments_timed: list of {'text', 'start', 'end'} using MEASURED
    durations. Distinct style vs. VID-P4: italic font, lighter (non-bold)
    weight -- but same solid legibility (thick outline + drop shadow) as
    VID-P4's captions, not a weaker version of it."""
    font = _caption_font(44, italic=True)
    max_width = int(TARGET_W * 0.85)
    caption_y = int(TARGET_H * 0.80)

    def make_frame(t):
        seg = next((s for s in segments_timed if s['start'] <= t <= s['end']), None)
        if seg is None:
            return np.zeros((TARGET_H, TARGET_W, 4), dtype=np.uint8)
        return render_caption_frame(seg['text'], font, max_width, caption_y)

    caption_clip = VideoClip(lambda t: make_frame(t)[:, :, :3], duration=video_clip.duration)
    mask_clip = VideoClip(lambda t: make_frame(t)[:, :, 3] / 255.0, duration=video_clip.duration, ismask=True)
    caption_clip = caption_clip.set_mask(mask_clip)
    from moviepy.editor import CompositeVideoClip
    return CompositeVideoClip([video_clip, caption_clip]).set_audio(video_clip.audio)


# ---------------------------------------------------------------------------
# Gates -- lighter set per briefs/VID-QP-02.md section 3.
# ---------------------------------------------------------------------------

_ONES = {'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7,
          'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13,
          'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18,
          'nineteen': 19}
_TENS = {'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60,
          'seventy': 70, 'eighty': 80, 'ninety': 90}


def _words_to_number(words: list) -> int:
    total, current = 0, 0
    for w in words:
        w = w.lower()
        if w in _ONES:
            current += _ONES[w]
        elif w in _TENS:
            current += _TENS[w]
        elif w == 'hundred':
            current = (current if current else 1) * 100
        elif w == 'thousand':
            total += (current if current else 1) * 1000
            current = 0
    return total + current


def extract_spoken_rupee_amounts(script_text: str) -> list:
    """Finds number-word sequences immediately followed by 'rupees' and
    converts each to an integer. E.g. 'Two thousand nine hundred ninety
    nine rupees.' -> [2999]."""
    number_words = set(_ONES) | set(_TENS) | {'hundred', 'thousand'}
    tokens = re.findall(r"[A-Za-z]+", script_text)
    amounts = []
    i = 0
    while i < len(tokens):
        if tokens[i].lower() in number_words:
            j = i
            while j < len(tokens) and tokens[j].lower() in number_words:
                j += 1
            if j < len(tokens) and tokens[j].lower().startswith('rupee'):
                amounts.append(_words_to_number(tokens[i:j]))
            i = j
        else:
            i += 1
    return amounts


def gate_duration(total_duration: float) -> dict:
    """total_duration must be the full assembled file's length (intro
    bumper + body segments + outro bumper) -- body-only duration under-
    reports the real render length by the bumpers' combined duration."""
    low = DURATION_TARGET_MIN * (1 - DURATION_TOLERANCE)
    high = DURATION_TARGET_MAX * (1 + DURATION_TOLERANCE)
    ok = low <= total_duration <= high
    return {'pass': ok, 'detail': f'{total_duration:.1f}s (target {DURATION_TARGET_MIN}-{DURATION_TARGET_MAX}s +-{int(DURATION_TOLERANCE*100)}%, i.e. {low:.1f}-{high:.1f}s)'}


def gate_price_token(script_text: str, price_inr: int) -> dict:
    amounts = extract_spoken_rupee_amounts(script_text)
    if price_inr in amounts:
        return {'pass': True, 'detail': f'found exact match {price_inr} in {amounts}'}
    return {'pass': False, 'detail': f'expected {price_inr}, found {amounts}'}


def gate_verdict(script_text: str) -> dict:
    ok = bool(re.search(r'\bverdict:\s*buy it\b', script_text, re.IGNORECASE))
    return {'pass': ok, 'detail': 'found "Verdict: buy it"' if ok else 'no unmodified "Verdict: buy it" line found'}


def gate_sfx_tags(segments: list) -> dict:
    valid_tags = {p.stem for p in SFX_LIBRARY_DIR.glob('*.mp3')}
    bad = [s.get('sfx_tag') for s in segments if s.get('sfx_tag') and s['sfx_tag'] not in valid_tags]
    # voice=false segments have no TTS audio -- SFX is their only audio
    # source, so sfx_tag stops being optional for them.
    missing_for_voice_off = [i for i, s in enumerate(segments) if not s.get('voice', True) and not s.get('sfx_tag')]
    ok = len(bad) == 0 and len(missing_for_voice_off) == 0
    parts = []
    if bad:
        parts.append(f'invalid tags: {bad}')
    if missing_for_voice_off:
        parts.append(f'voice=false segments missing sfx_tag: {missing_for_voice_off}')
    detail = '; '.join(parts) if parts else f'valid library tags: {sorted(valid_tags)}'
    return {'pass': ok, 'detail': detail}


def gate_banned_constructions(script_text: str) -> dict:
    lower = script_text.lower()
    hits = [pat for pat in BANNED_PATTERNS if re.search(pat, lower, re.IGNORECASE | re.MULTILINE)]
    ok = len(hits) == 0
    return {'pass': ok, 'detail': 'clean' if ok else f'matched: {hits}'}


def gate_vocab_complexity(script_text: str) -> dict:
    lower = script_text.lower()
    hits = [w for w in VOCAB_COMPLEXITY_BANNED_WORDS if re.search(rf'\b{re.escape(w)}\b', lower)]
    ok = len(hits) == 0
    return {'pass': ok, 'detail': 'clean' if ok else f'found: {hits}'}


def run_all_gates(segments: list, total_duration: float, price_inr: int) -> dict:
    full_text = ' '.join(s['text'] for s in segments)
    return {
        'duration': gate_duration(total_duration),
        'price_token': gate_price_token(full_text, price_inr),
        'verdict': gate_verdict(full_text),
        'sfx_tags': gate_sfx_tags(segments),
        'banned_constructions': gate_banned_constructions(full_text),
        'vocab_complexity': gate_vocab_complexity(full_text),
    }


# ---------------------------------------------------------------------------
# Full per-candidate pipeline
# ---------------------------------------------------------------------------

def process_candidate(candidate: dict) -> dict:
    set_number = candidate['set_number']
    set_title = candidate['set_title']
    price_inr = candidate['price_inr']
    segments = candidate['segments']
    fallback_image_url = candidate.get('image_url', '')

    work_dir = TEMP_DIR / f'qp_{set_number}'
    work_dir.mkdir(exist_ok=True)

    print(f'\n=== Processing {set_title} (#{set_number}) ===')

    client = ElevenLabs(api_key=ELEVENLABS_API_KEY_ASMR)

    # 1. TTS per segment, measure real duration. voice=false segments skip
    # TTS entirely -- their audio IS the SFX cue, so duration comes from
    # that file's own length instead.
    segment_audio_paths = []
    for i, seg in enumerate(segments):
        voice_on = seg.get('voice', True)
        if voice_on:
            raw_path = work_dir / f'seg_{i}_raw.mp3'
            duration = render_segment_tts(client, seg['text'], raw_path)
            seg['measured_duration'] = duration
            segment_audio_paths.append(raw_path)
            print(f'  segment {i} (voice): "{seg["text"][:50]}..." -> {duration:.2f}s')
        else:
            sfx_tag = seg.get('sfx_tag')
            if not sfx_tag:
                raise ValueError(f'Segment {i} has voice=false but no sfx_tag -- no audio source.')
            sfx_src = SFX_LIBRARY_DIR / f'{sfx_tag}.mp3'
            sfx_duration = ffprobe_duration(sfx_src)
            reading_floor = len(seg['text']) / READING_SPEED_CPS
            duration = max(sfx_duration, reading_floor)
            seg['measured_duration'] = duration
            segment_audio_paths.append(None)
            if duration > sfx_duration:
                print(f'  segment {i} (voice-off, sfx={sfx_tag}): "{seg["text"][:50]}..." -> {duration:.2f}s (reading-speed floor, SFX itself is {sfx_duration:.2f}s)')
            else:
                print(f'  segment {i} (voice-off, sfx={sfx_tag}): "{seg["text"][:50]}..." -> {duration:.2f}s (SFX native duration)')

    total_measured = sum(s['measured_duration'] for s in segments)

    # Bumper durations measured now (not just at step 6) so the duration
    # gate checks the full assembled file -- body segments alone previously
    # under-reported total length by ~intro+outro (~21s for the current
    # intro_final.mp3/outro_final.mp3 pair), letting an out-of-band video
    # pass the gate.
    intro_duration = ffprobe_duration(INTRO_BUMPER)
    outro_duration = ffprobe_duration(OUTRO_BUMPER)
    total_video_duration = intro_duration + total_measured + outro_duration

    # 2. Gates (after TTS, per section 0's design note).
    gate_results = run_all_gates(segments, total_video_duration, price_inr)
    for name, result in gate_results.items():
        print(f'  GATE {name}: {"PASS" if result["pass"] else "FAIL"} -- {result["detail"]}')
    all_passed = all(r['pass'] for r in gate_results.values())

    # 3. Images.
    images = resolve_candidate_images(set_number, fallback_image_url, work_dir)
    if not images:
        raise RuntimeError(f'No images resolved for set {set_number} -- cannot assemble video.')
    print(f'  resolved {len(images)} image(s) for assembly')

    # 4. Audio processing per segment: de-ess voice, EQ-lift + mix SFX. For
    # voice=false segments, there's no voice to de-ess or mix under -- the
    # SFX cue itself is the segment's audio, boosted as primary content.
    # Then, if the continuous audio-bed asset exists, layer a slice of it
    # under every segment's finalized audio -- heavily ducked under
    # voice=true (subtle texture, not competing with Mira), at the same
    # "present" peak-relative ceiling as other primary SFX under
    # voice=false (it can share the beat with that segment's own tagged
    # accent). Bed runs under the body only, not the locked intro/outro
    # bumpers.
    bed_source = SFX_LIBRARY_DIR / f'{AUDIO_BED_SFX_TAG}.mp3'
    bed_available = bed_source.exists()
    bed_cursor = 0.0

    mixed_paths = []
    for i, seg in enumerate(segments):
        voice_on = seg.get('voice', True)
        sfx_tag = seg.get('sfx_tag')

        if not voice_on:
            sfx_src = SFX_LIBRARY_DIR / f'{sfx_tag}.mp3'
            boosted_path = work_dir / f'seg_{i}_sfx_boosted.mp3'
            apply_sfx_boost(sfx_src, boosted_path)
            segment_final_path = boosted_path
        else:
            raw_path = segment_audio_paths[i]
            deessed_path = work_dir / f'seg_{i}_deessed.mp3'
            apply_deesser(raw_path, deessed_path)

            if sfx_tag:
                sfx_src = SFX_LIBRARY_DIR / f'{sfx_tag}.mp3'
                sfx_eq_path = work_dir / f'seg_{i}_sfx_eq.mp3'
                apply_sfx_eq(sfx_src, sfx_eq_path)
                mixed_path = work_dir / f'seg_{i}_mixed.mp3'
                mix_sfx_over_voice(deessed_path, sfx_eq_path, mixed_path)
                segment_final_path = mixed_path
            else:
                segment_final_path = deessed_path

        if bed_available:
            duration = seg['measured_duration']
            bed_slice_path = work_dir / f'seg_{i}_bed_slice.mp3'
            extract_bed_slice(bed_source, duration, bed_cursor, bed_slice_path)
            bed_cursor += duration

            bed_boosted_path = work_dir / f'seg_{i}_bed_boosted.mp3'
            ceiling = AUDIO_BED_DUCK_CEILING_DB if voice_on else -3.0
            apply_sfx_boost(bed_slice_path, bed_boosted_path, target_ceiling_db=ceiling)

            with_bed_path = work_dir / f'seg_{i}_with_bed.mp3'
            mix_bed_into_segment(segment_final_path, bed_boosted_path, with_bed_path)
            segment_final_path = with_bed_path

        mixed_paths.append(segment_final_path)

    # 5. Concatenate segments, splice bumpers, final loudnorm.
    body_path = work_dir / 'body.mp3'
    concat_audio(mixed_paths, body_path)

    full_audio_path = work_dir / 'full_audio.mp3'
    concat_audio([INTRO_BUMPER, body_path, OUTRO_BUMPER], full_audio_path)

    final_audio_path = work_dir / 'final_audio.mp3'
    apply_final_loudnorm(full_audio_path, final_audio_path)

    # 6. Video assembly: intro card -> Ken Burns per segment -> outro card.
    intro_visual = make_static_card_clip(['Bricks of India', 'Where every brick tells a story', 'in ASMR'], intro_duration)
    outro_visual = make_static_card_clip(['Like it. Share it.', 'Follow Bricks of India.'], outro_duration)

    segment_clips = []
    for i, seg in enumerate(segments):
        image_path = images[i % len(images)]
        segment_clips.append(make_ken_burns_clip(image_path, seg['measured_duration']))

    video_no_audio = concatenate_videoclips([intro_visual] + segment_clips + [outro_visual], method='compose')

    with AudioFileClip(str(final_audio_path)) as final_audio:
        video_with_audio = video_no_audio.set_audio(final_audio.set_duration(video_no_audio.duration))

        # Caption timing: offset by intro_duration, cumulative over measured segment durations.
        segments_timed = []
        t = intro_duration
        for seg in segments:
            segments_timed.append({'text': seg['text'], 'start': t, 'end': t + seg['measured_duration']})
            t += seg['measured_duration']

        final_video = burn_captions(video_with_audio, segments_timed)

        # Second-level timestamp, not just date -- the row id isn't known
        # yet at this point (DB insert happens after the render, step 7
        # below), and date+slug alone silently overwrote same-day re-renders
        # of the same set (lost row 2a1b6d89's video evidence 2026-07-30).
        timestamp_str = datetime.now().strftime('%Y-%m-%d_%H%M%S')
        slug = re.sub(r'[^a-z0-9]+', '-', set_title.lower()).strip('-')[:60]
        output_path = OUTPUT_DIR / f'qp_{timestamp_str}_{slug}.mp4'
        final_video.write_videofile(str(output_path), fps=FPS, codec='libx264', audio_codec='aac', logger=None)

    print(f'  Rendered -> {output_path} (total duration ~{total_video_duration:.1f}s)')

    # 7. DB insert.
    sb = get_supabase()
    status = 'pending_approval' if all_passed else 'publish_blocked'
    full_script_text = ' '.join(s['text'] for s in segments)
    row = {
        'set_title': set_title,
        'set_number': set_number,
        'price_inr': price_inr,
        'script': full_script_text,
        'video_path': str(output_path),
        'gate_results': gate_results,
        'status': status,
    }
    inserted = sb.table('quiet_panic_posts').insert(row).execute()
    post_id = inserted.data[0]['id']
    print(f'  Inserted quiet_panic_posts row {post_id} (status={status})')

    return {
        'post_id': post_id,
        'set_title': set_title,
        'set_number': set_number,
        'status': status,
        'gate_results': gate_results,
        'total_duration': total_video_duration,
        'video_path': str(output_path),
    }


def main():
    parser = argparse.ArgumentParser(description='Quiet Panic script-to-video generation (standalone, no engine.py/publish.py/gates.py imports).')
    parser.add_argument('--test-batch', type=str, help='Path to a JSON file of candidate dicts (segments + set metadata) to process.')
    parser.add_argument('--build-sfx-manifest', action='store_true', help='Measure peak dB for every assets/sfx/library/*.mp3 file and write peak_levels.json, then exit.')
    args = parser.parse_args()

    if args.build_sfx_manifest:
        build_sfx_peak_manifest()
        return

    if not args.test_batch:
        parser.print_help()
        return

    with open(args.test_batch) as f:
        candidates = json.load(f)

    results = []
    for candidate in candidates:
        results.append(process_candidate(candidate))

    print('\n=== Summary ===')
    for r in results:
        print(json.dumps(r, indent=2))


if __name__ == '__main__':
    main()
