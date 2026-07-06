#!/usr/bin/env python3
"""
VID-P4 — Daily video pipeline engine.

Sandwich video: operator's recorded intro clip + AI middle (Ken Burns over
product images + Gemini script read by an ElevenLabs voice clone) +
operator's recorded outro. Daily, manual upload to IG Reels + YT Shorts.

Usage:
  python engine.py --suggest                 # show top 3 candidates
  python engine.py --pick 1                  # generate + assemble candidate #1
  python engine.py --pick 1 --no-tts         # dry run: silent placeholder audio, no ElevenLabs call
  python engine.py --url <product_url>       # manual override instead of --pick
  python engine.py --posted <video_posts.id> ig|yt|both   # mark posted
"""

from __future__ import annotations

import argparse
import io
import json
import os
import random
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import requests
from dotenv import load_dotenv

load_dotenv()

# moviepy 1.x calls PIL.Image.ANTIALIAS, removed in Pillow >=10. Verified
# live 2026-07-05: moviepy 1.0.3 + Pillow 10.3.0 raises
# `AttributeError: module 'PIL.Image' has no attribute 'ANTIALIAS'` on any
# .resize() call without this patch. LANCZOS is the same algorithm under the
# old name (Pillow renamed it in 9.1, removed the alias in 10.0).
from PIL import Image
if not hasattr(Image, "ANTIALIAS"):
    Image.ANTIALIAS = Image.LANCZOS

from moviepy.editor import (  # noqa: E402
    AudioFileClip,
    ImageClip,
    VideoFileClip,
    concatenate_videoclips,
)

from supabase import create_client  # noqa: E402

import gates  # noqa: E402
import prompts  # noqa: E402

BASE_DIR = Path(__file__).parent
MASTER_ASSETS = BASE_DIR / "master_assets"
TEMP_DOWNLOAD = BASE_DIR / "temp_download"
OUTPUT_DIR = BASE_DIR / "output"
for d in (MASTER_ASSETS, TEMP_DOWNLOAD, OUTPUT_DIR):
    d.mkdir(exist_ok=True)

# Toycra dropped 2026-07-06 (operator directive) -- MyBrickHouse is now the
# SOLE source for this video pipeline's candidate selection and images.
# This does NOT affect the main web pipeline's Toycra scraper
# (scripts/scrape-now.mjs) -- scoped to scripts/video/ only.
MBH_URL = "https://lego.mybrickhouse.com/collections/lego-sets/products.json"
MBH_DOMAIN = "lego.mybrickhouse.com"

TARGET_W, TARGET_H = 1080, 1920
KEN_BURNS_ZOOM = 0.04
FPS = 30

GEMINI_MIN_GAP_S = 4.0
GEMINI_MAX_GAP_S = 6.0
_last_gemini_call_at = 0.0

# Recomputed 2026-07-05 from real ElevenLabs rate + observed chars/word ratio
# -- see commit for the fix that introduced this. Do not reset without
# recomputing.
#
# Rate: eleven_flash_v2_5 costs 0.5 credits/char (confirmed against
# ElevenLabs' own pricing docs -- Flash/Turbo models get the discounted
# 0.5x rate, vs 1 credit/char for Multilingual v2).
# Observed chars/word this session (two real gate-passing scripts, before
# this fix): 827 chars / 131 words = 6.31 chars/word; 810 chars / 128 words
# = 6.33 chars/word. Using 6.5 chars/word (above both real samples) at
# G1's 135-word ceiling: 135 * 6.5 = 877.5 chars, +15% safety margin for
# word-length variance on scripts not yet seen = 1009 -> round to 1000.
# Cost check, worst case (every script hits exactly 1000 chars, 30
# scripts/month = one per day): 1000 * 0.5 credits/char = 500 credits/script
# * 30 = 15,000 credits/month, vs the Starter plan's 30,000 credits/month
# allowance -- 50% utilization, 2x headroom even in the absolute worst case.
# (Old 800-char guard was never derived from this arithmetic -- it was a
# guess, and it collided with G1's own 105-135 word range: two real scripts
# this session passed G1 cleanly at 131 and 128 words and still got refused
# at the char guard, which is the bug this recompute fixes.)
ELEVENLABS_MAX_SCRIPT_CHARS = 1000


# ── Env / clients ─────────────────────────────────────────────────────────────

def get_supabase():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in .env", file=sys.stderr)
        sys.exit(1)
    return create_client(url, key)


# ── STEP 3: candidate selection ────────────────────────────────────────────────

import re  # noqa: E402

_SET_NUMBER_RE = re.compile(r"(?<!\d)(\d{4,6})(?!\d)")


def extract_set_number(title: str | None, handle: str | None) -> str | None:
    """Same 4-6 digit convention as scripts/scrape-now.mjs::extractSetNumber
    (verified 2026-07-05 against a real catalog set, 853653, a 6-digit
    number -- the brief said 4-5 digits, but that would miss real sets)."""
    from_handle = _SET_NUMBER_RE.findall(handle or "")
    from_title = _SET_NUMBER_RE.findall(title or "")
    seen = []
    for n in from_handle + from_title:
        if n not in seen:
            seen.append(n)
    return seen[0] if seen else None


def fetch_shopify_products(base_url: str, page_size: int = 250, max_pages: int = 2) -> list[dict]:
    """Paginate a Shopify /products.json endpoint. Verified 2026-07-05: this
    endpoint ignores sort_by entirely (identical order with/without it) --
    sorting must happen client-side, never trust a URL sort param here."""
    all_products: list[dict] = []
    for page in range(1, max_pages + 1):
        resp = requests.get(base_url, params={"limit": page_size, "page": page}, timeout=20)
        resp.raise_for_status()
        products = resp.json().get("products", [])
        if not products:
            break
        all_products.extend(products)
        if len(products) < page_size:
            break
    return all_products


def cheapest_variant(product: dict) -> dict | None:
    variants = product.get("variants") or []
    if not variants:
        return None
    in_stock = [v for v in variants if v.get("available")]
    pool = in_stock if in_stock else variants
    priced = [v for v in pool if v.get("price") is not None]
    if not priced:
        return None
    return min(priced, key=lambda v: float(v["price"]))


def build_candidate(product: dict, store_id: str, store_name: str, domain: str) -> dict | None:
    images = product.get("images") or []
    if len(images) < 5:
        return None
    variant = cheapest_variant(product)
    if variant is None:
        return None
    return {
        "title": product.get("title") or "",
        "store": store_id,
        "store_name": store_name,
        "product_url": f"https://{domain}/products/{product.get('handle')}",
        "price_inr": float(variant["price"]),
        "image_urls": [img.get("src") for img in images if img.get("src")],
        "set_number": extract_set_number(product.get("title"), product.get("handle")),
        "published_at": product.get("published_at") or "",
    }


def already_used(sb, product_url: str, set_number: str | None) -> bool:
    if set_number:
        by_set = sb.table("video_posts").select("id").eq("set_number", set_number).limit(1).execute()
        if by_set.data:
            return True
    by_url = sb.table("video_posts").select("id").eq("product_url", product_url).limit(1).execute()
    return bool(by_url.data)


def enrich_with_catalog(sb, set_number: str | None) -> tuple[int | None, str | None]:
    """Returns (pieces, theme) if set_number exists in our catalog, else (None, None)."""
    if not set_number:
        return None, None
    res = sb.table("sets").select("pieces, theme").eq("set_number", set_number).limit(1).execute()
    if not res.data:
        return None, None
    row = res.data[0]
    return row.get("pieces"), row.get("theme")


def get_candidates(sb, limit: int = 10) -> list[dict]:
    mbh_products = fetch_shopify_products(MBH_URL)

    def mbh_price_key(p: dict) -> float:
        v = cheapest_variant(p)
        return float(v["price"]) if v else -1.0

    # Client-side sort, per STEP 0 verification: sort_by is ignored server-side.
    mbh_sorted = sorted(mbh_products, key=mbh_price_key, reverse=True)

    candidates: list[dict] = []
    for p in mbh_sorted:
        c = build_candidate(p, "mybrickhouse", "MyBrickHouse", MBH_DOMAIN)
        if c:
            candidates.append(c)
        if len(candidates) >= limit:
            break

    # Filter: not already used, price present (guaranteed by build_candidate).
    fresh = [c for c in candidates if not already_used(sb, c["product_url"], c["set_number"])]

    # Attach catalog enrichment + a one-line reason.
    for c in fresh:
        pieces, theme = enrich_with_catalog(sb, c["set_number"])
        c["pieces"] = pieces
        c["theme"] = theme
        reason = f"highest-priced on MyBrickHouse (₹{c['price_inr']:,.0f})"
        if pieces:
            reason += f", catalog match: {c['theme']} theme, {pieces} pieces"
        c["reason"] = reason

    return fresh[:10]


def print_suggestions(candidates: list[dict]) -> None:
    top3 = candidates[:3]
    if not top3:
        print("No eligible candidates found (all filtered by image count, price, or already used).")
        return
    for i, c in enumerate(top3, 1):
        print(f"[{i}] {c['title']} — {c['store_name']} — ₹{c['price_inr']:,.0f}")
        print(f"    {c['reason']}")
        print(f"    {c['product_url']}")


# ── STEP 4: script generation ──────────────────────────────────────────────────

def _gemini_pace() -> None:
    """4-6s randomized minimum gap between Gemini calls, same rationale as
    the web pipeline's 2026-07-05 pacing fix (scripts/generate-approved-drafts.ts) --
    a bursty rate limiter still reads as a QPS spike server-side."""
    global _last_gemini_call_at
    target_gap = random.uniform(GEMINI_MIN_GAP_S, GEMINI_MAX_GAP_S)
    since_last = time.time() - _last_gemini_call_at
    if _last_gemini_call_at > 0 and since_last < target_gap:
        time.sleep(target_gap - since_last)
    _last_gemini_call_at = time.time()


def generate_script(title: str, price_inr: float, pieces: int | None, theme: str | None, retry_note: str | None = None) -> str:
    task_prompt = prompts.build_task_prompt(title, price_inr, pieces, theme)
    if retry_note:
        task_prompt = f"{task_prompt}\n\n{retry_note}"

    gemini_key = os.environ.get("GEMINI_SOCIAL_API_KEY")
    if gemini_key:
        try:
            _gemini_pace()
            from google import genai
            from google.genai import types
            client = genai.Client(api_key=gemini_key)
            resp = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=task_prompt,
                config=types.GenerateContentConfig(system_instruction=prompts.SYSTEM_PROMPT),
            )
            if resp.text and resp.text.strip():
                return resp.text.strip()
            print("WARN: Gemini returned empty text, falling back to Cerebras.", file=sys.stderr)
        except Exception as e:
            print(f"WARN: Gemini failed ({e}), falling back to Cerebras.", file=sys.stderr)
    else:
        print("WARN: GEMINI_SOCIAL_API_KEY not set, going straight to Cerebras.", file=sys.stderr)

    cerebras_key = os.environ.get("CEREBRAS_API_KEY")
    if not cerebras_key:
        print("ERROR: Both Gemini and Cerebras unavailable (no CEREBRAS_API_KEY). Cannot generate script.", file=sys.stderr)
        sys.exit(1)

    try:
        from cerebras.cloud.sdk import Cerebras
        client = Cerebras(api_key=cerebras_key)
        # Model verified live 2026-07-05: the brief said "llama3.1-8b", which
        # returns 404 model_not_found on this account. client.models.list()
        # showed only gemma-4-31b / zai-glm-4.7 / gpt-oss-120b -- gpt-oss-120b
        # matches the main site's already-proven Cerebras failover model
        # (see CLAUDE.md's RADAR pipeline rules), so used that instead.
        resp = client.chat.completions.create(
            model="gpt-oss-120b",
            messages=[
                {"role": "system", "content": prompts.SYSTEM_PROMPT},
                {"role": "user", "content": task_prompt},
            ],
        )
        content = resp.choices[0].message.content
        if content and content.strip():
            return content.strip()
    except Exception as e:
        print(f"ERROR: Cerebras also failed: {e}", file=sys.stderr)
        sys.exit(1)

    print("ERROR: Both providers returned empty content.", file=sys.stderr)
    sys.exit(1)


def get_recent_scripts(sb, n: int = 30) -> list[str]:
    res = sb.table("video_posts").select("script").order("created_at", desc=True).limit(n).execute()
    return [row["script"] for row in res.data if row.get("script")]


MAX_GENERATION_ATTEMPTS = 4  # initial + 3 retries, per 2026-07-05 word-count fix
RETRY_NOTE = "Your last attempt was too long. This one must be under 125 words. Cut ruthlessly."


def run_gates_with_one_retry(sb, candidate: dict) -> tuple[str, gates.GateReport]:
    recent = get_recent_scripts(sb)

    def sets_lookup(set_number: str) -> dict | None:
        res = sb.table("sets").select("pieces, theme").eq("set_number", set_number).limit(1).execute()
        return res.data[0] if res.data else None

    for attempt in range(1, MAX_GENERATION_ATTEMPTS + 1):
        retry_note = RETRY_NOTE if attempt > 1 else None
        raw_script = generate_script(candidate["title"], candidate["price_inr"], candidate.get("pieces"), candidate.get("theme"), retry_note=retry_note)
        report = gates.run_all_gates(raw_script, candidate.get("pieces"), sets_lookup, recent, candidate["price_inr"])
        if report.all_passed:
            # Sanitized text, not raw -- this is what actually reaches TTS
            # and gets stored as the canonical script (see gates.sanitize_script).
            return report.sanitized_script, report
        print(f"Gate failure on attempt {attempt}:", file=sys.stderr)
        for r in report.results:
            if not r.passed:
                print(f"  {r.gate}: {r.reason}", file=sys.stderr)
        if attempt < MAX_GENERATION_ATTEMPTS:
            print(f"Regenerating (attempt {attempt + 1}/{MAX_GENERATION_ATTEMPTS})...", file=sys.stderr)

    print(f"ERROR: script failed gates {MAX_GENERATION_ATTEMPTS} times. Aborting, not publishing.", file=sys.stderr)
    for r in report.results:
        status = "PASS" if r.passed else "FAIL"
        print(f"  [{status}] {r.gate}: {r.reason}", file=sys.stderr)
    sys.exit(1)


# ── STEP 6: TTS ─────────────────────────────────────────────────────────────────

def generate_tts(script: str, output_path: Path) -> None:
    # Currency spoken-word expansion happens here, at the TTS boundary only --
    # the stored script (video_posts.script, captions) keeps the ₹ numeral
    # form; humans read "₹26,999" instantly, only the audio layer needs
    # "twenty-six thousand, nine hundred and ninety-nine rupees". The char
    # guard must check the EXPANDED text, since that's what's actually sent
    # to (and billed by) ElevenLabs -- expansion makes the payload longer
    # than the stored script.
    tts_text = gates.normalize_currency_for_tts(script)
    if len(tts_text) > ELEVENLABS_MAX_SCRIPT_CHARS:
        print(f"ERROR: TTS text is {len(tts_text)} chars after currency expansion, over the {ELEVENLABS_MAX_SCRIPT_CHARS}-char hard guard. Refusing to call ElevenLabs.", file=sys.stderr)
        sys.exit(1)

    api_key = os.environ.get("ELEVENLABS_API_KEY")
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID")
    if not api_key or not voice_id:
        print("ERROR: ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID not set.", file=sys.stderr)
        sys.exit(1)

    from elevenlabs.client import ElevenLabs
    client = ElevenLabs(api_key=api_key)
    audio_chunks = client.text_to_speech.convert(
        voice_id,
        text=tts_text,
        # Verified live 2026-07-05: the brief's "eleven_flash_v2.5" (period)
        # 400s with "invalid_uid" -- ElevenLabs' real model ID uses an
        # underscore, confirmed against their own docs.
        model_id="eleven_flash_v2_5",
        output_format="mp3_44100_128",
    )
    with open(output_path, "wb") as f:
        for chunk in audio_chunks:
            f.write(chunk)


def generate_silent_placeholder_audio(output_path: Path, duration_s: float) -> None:
    """--no-tts path: a silent audio track of the estimated voiceover length,
    so assembly can be verified end-to-end without spending ElevenLabs credits."""
    import subprocess
    subprocess.run(
        [
            "ffmpeg", "-y", "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=mono",
            "-t", str(duration_s), "-q:a", "9", str(output_path),
        ],
        check=True, capture_output=True,
    )


def estimate_voiceover_duration_s(script: str) -> float:
    """~150 wpm conversational speaking rate -- used only for --no-tts
    placeholder audio length; the real pipeline reads the actual ElevenLabs
    output's duration via ffprobe once TTS is live."""
    words = len(script.split())
    return (words / 150.0) * 60.0


# ── STEP 7: assembly ────────────────────────────────────────────────────────────

def get_clip_duration(path: Path) -> float:
    with VideoFileClip(str(path)) as clip:
        return clip.duration


def make_ken_burns_clip(image_path: Path, duration_s: float, zoom: float = KEN_BURNS_ZOOM):
    clip = ImageClip(str(image_path))
    w, h = clip.size
    scale = max(TARGET_W / w, TARGET_H / h)
    cover_w, cover_h = int(w * scale) + 4, int(h * scale) + 4  # cover 1080x1920, +4px slop for rounding
    clip = clip.resize((cover_w, cover_h)).set_duration(duration_s)
    zoomed = clip.resize(lambda t: 1 + zoom * (t / duration_s))
    return zoomed.crop(x_center=zoomed.w / 2, y_center=zoomed.h / 2, width=TARGET_W, height=TARGET_H)


def download_images(urls: list[str], max_images: int = 6) -> list[Path]:
    # Verified 2026-07-05 on a real run: Shopify serves some product images as
    # transparent cutout PNGs (this candidate: 5 of 6, ~52% transparent
    # pixels), despite the file being saved with a ".jpg" extension here.
    # moviepy's ImageClip drops the alpha channel and reads the raw RGB
    # values underneath -- PNGs conventionally store RGB=(0,0,0) in fully
    # transparent regions, so those areas rendered as solid black in the
    # final video. Flatten onto white here, once, at download time, so every
    # downstream consumer (Ken Burns, gates, everything) always sees a plain
    # opaque JPEG regardless of what format the source actually was.
    paths = []
    for i, url in enumerate(urls[:max_images]):
        resp = requests.get(url, timeout=20)
        resp.raise_for_status()
        path = TEMP_DOWNLOAD / f"product_{i}.jpg"
        img = Image.open(io.BytesIO(resp.content))
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            img = img.convert("RGBA")
            flattened = Image.new("RGB", img.size, (255, 255, 255))
            flattened.paste(img, mask=img.split()[3])
            img = flattened
        else:
            img = img.convert("RGB")
        img.save(path, "JPEG", quality=95)
        paths.append(path)
    return paths


# Real bug found on operator visual review, 2026-07-06: official LEGO
# "lifestyle" photos (product staged in a room, often off-center in the
# source frame) get center-cropped through the middle of the room, cutting
# off the actual product -- the cover-resize+center-crop math is correct
# for a centered product, but lifestyle shots were never centered to begin
# with. Fix is filtering, not smarter cropping: only use STUDIO shots
# (plain white/neutral background, product centered and filling the frame)
# for Ken Burns, since those are safe to center-crop by construction.
#
# Heuristic verified against 6 real MyBrickHouse images for one candidate:
# true studio shots (product_0/1/2) had all 4 corner patches at pure white,
# (255,255,255), zero variance across corners. The 3 real lifestyle photos
# (product_3/4/5) had corner values as low as 32-224 with high variance
# (17-60) from visible room/furniture/prop color. A tight per-channel
# whiteness floor plus a cross-corner uniformity check cleanly separated
# both classes on this real data with no ambiguous cases.
_STUDIO_WHITE_FLOOR = 235
_STUDIO_UNIFORMITY_MAX_STD = 15
_STUDIO_CORNER_PATCH = 25
MIN_STUDIO_IMAGES = 3


def is_studio_image(path: Path) -> bool:
    img = Image.open(path).convert("RGB")
    w, h = img.size
    patch = _STUDIO_CORNER_PATCH
    corners = [
        np.array(img.crop((0, 0, patch, patch))).mean(axis=(0, 1)),
        np.array(img.crop((w - patch, 0, w, patch))).mean(axis=(0, 1)),
        np.array(img.crop((0, h - patch, patch, h))).mean(axis=(0, 1)),
        np.array(img.crop((w - patch, h - patch, w, h))).mean(axis=(0, 1)),
    ]
    means = np.array(corners)  # shape (4, 3)
    if means.min() < _STUDIO_WHITE_FLOOR:
        return False
    if means.std(axis=0).max() > _STUDIO_UNIFORMITY_MAX_STD:
        return False
    return True


# Second real bug found on closer operator review of the qc_frames the
# studio/lifestyle filter above produced, 2026-07-06: some images pass the
# corner check (their outer edges/margins are genuinely white) but are
# actually TWO images side by side -- e.g. a box-cover photo abutting a
# separate built-model shot, each with its own local background, meeting at
# a seam well inside the corners. Center-cropping one of these shows a
# partial sliver of the other element bleeding in at the frame edge.
#
# Third bug, same day: the first fix used a FIXED absolute content-fraction
# threshold (0.45), calibrated against a side-by-side composite where each
# half filled most of the frame (peaks ~0.73-0.75). It completely missed a
# real vertically-stacked exploded/modular diagram (a tower shown as 4
# separate segments stacked with white gaps) because that image is a THIN
# subject on a WIDE canvas -- its row-wise content fraction never exceeds
# ~0.16 anywhere, so it never crossed the fixed 0.45 threshold at all.
#
# Fourth bug, same day: the first attempted fix (a threshold relative to
# the profile's GLOBAL peak) traded one failure for another -- it fixed the
# exploded-diagram case but then missed the ORIGINAL side-by-side composite,
# because a global-peak-relative floor can't tell "a real gap between two
# similar-height peaks" from "a shallower but still-separate band elsewhere
# in the same profile" (verified by testing both fixture images together,
# not one at a time, after the first "fix" silently regressed the other
# case -- exactly the mistake being corrected here).
#
# Final approach: real peak/valley prominence, evaluated LOCALLY per pair of
# neighboring peaks, not against one global number. Find local maxima in the
# profile, then for each adjacent pair, check whether the valley between
# them drops to less than half of the SMALLER of the two peaks -- if so
# they're genuinely separate regions; if not, they're one region with minor
# internal wobble (e.g. box-art texture). This self-calibrates per-peak
# rather than needing one constant to work across wildly different content
# densities.
#
# Verified against 6 real fixture images together in one test (not
# sequentially, to catch exactly the kind of regression above): 2 confirmed
# composites (Eiffel side-by-side box+product, Barad-dur vertical exploded
# stack) and 4 confirmed single-subject studio shots, all classified
# correctly with no cross-regressions.
_COMPOSITE_ACTIVE_FLOOR = 0.02
_COMPOSITE_VALLEY_DROP_RATIO = 0.5


def _count_content_regions(profile: np.ndarray) -> int:
    active = profile >= _COMPOSITE_ACTIVE_FLOOR
    idx = np.where(active)[0]
    if len(idx) == 0:
        return 0
    start, end = idx[0], idx[-1] + 1
    span = profile[start:end]
    m = len(span)
    if m < 3:
        return 1
    peaks = [i for i in range(1, m - 1) if span[i] >= span[i - 1] and span[i] >= span[i + 1] and span[i] > _COMPOSITE_ACTIVE_FLOOR]
    if not peaks:
        return 1
    regions = [[peaks[0]]]
    for p in peaks[1:]:
        prev_peak_idx = regions[-1][-1]
        valley = span[prev_peak_idx:p + 1].min()
        peak_left, peak_right = span[prev_peak_idx], span[p]
        if valley <= _COMPOSITE_VALLEY_DROP_RATIO * min(peak_left, peak_right):
            regions.append([p])
        else:
            regions[-1].append(p)
    return len(regions)


def has_composite_seam(path: Path) -> bool:
    img = Image.open(path).convert("RGB")
    arr = np.array(img)
    is_content = np.any(arr < _STUDIO_WHITE_FLOOR, axis=-1)
    col_frac = is_content.mean(axis=0)
    row_frac = is_content.mean(axis=1)
    col_kernel = np.ones(max(15, len(col_frac) // 100))
    col_kernel /= col_kernel.sum()
    row_kernel = np.ones(max(15, len(row_frac) // 100))
    row_kernel /= row_kernel.sum()
    col_smoothed = np.convolve(col_frac, col_kernel, mode="same")
    row_smoothed = np.convolve(row_frac, row_kernel, mode="same")
    return _count_content_regions(col_smoothed) >= 2 or _count_content_regions(row_smoothed) >= 2


def classify_image(path: Path) -> str:
    """Returns 'studio', 'lifestyle', or 'composite'."""
    if not is_studio_image(path):
        return "lifestyle"
    if has_composite_seam(path):
        return "composite"
    return "studio"


def filter_studio_images(paths: list[Path]) -> list[Path]:
    kept = []
    for p in paths:
        cls = classify_image(p)
        print(f"  {p.name}: {cls}", file=sys.stderr)
        if cls == "studio":
            kept.append(p)
    return kept


def slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:60]


def assemble_video(image_paths: list[Path], audio_path: Path, output_path: Path, placeholder_anchors: bool) -> float:
    intro_path = MASTER_ASSETS / "intro_hook.mp4"
    outro_path = MASTER_ASSETS / "outro_signoff.mp4"

    if not intro_path.exists() or not outro_path.exists():
        if not placeholder_anchors:
            print(f"ERROR: {intro_path} and/or {outro_path} missing, and placeholder anchors not requested.", file=sys.stderr)
            sys.exit(1)
        print("WARN: master_assets clips absent — generating 2 solid-color 5s placeholder anchors for this dry run only.", file=sys.stderr)
        _make_placeholder_anchor(intro_path, (30, 60, 120), "INTRO PLACEHOLDER")
        _make_placeholder_anchor(outro_path, (120, 60, 30), "OUTRO PLACEHOLDER")

    intro_duration = get_clip_duration(intro_path)
    outro_duration = get_clip_duration(outro_path)
    print(f"Intro actual duration: {intro_duration:.2f}s | Outro actual duration: {outro_duration:.2f}s")

    with AudioFileClip(str(audio_path)) as audio:
        voiceover_duration = audio.duration
        per_image = voiceover_duration / len(image_paths)
        middle_clips = [make_ken_burns_clip(p, per_image) for p in image_paths]
        middle = concatenate_videoclips(middle_clips, method="compose").set_audio(audio.set_duration(voiceover_duration))
        middle = middle.set_duration(voiceover_duration)

        intro = VideoFileClip(str(intro_path)).resize(height=TARGET_H)
        outro = VideoFileClip(str(outro_path)).resize(height=TARGET_H)

        final = concatenate_videoclips([intro, middle, outro], method="compose")
        final.write_videofile(
            str(output_path),
            fps=FPS,
            codec="libx264",
            audio_codec="aac",
            logger=None,
        )
        total_duration = final.duration
        intro.close()
        outro.close()

    return total_duration


def _make_placeholder_anchor(path: Path, color: tuple[int, int, int], label: str) -> None:
    from PIL import ImageDraw
    img = Image.new("RGB", (TARGET_W, TARGET_H), color=color)
    draw = ImageDraw.Draw(img)
    draw.text((TARGET_W // 2 - 150, TARGET_H // 2), label, fill=(255, 255, 255))
    img_path = path.with_suffix(".png")
    img.save(img_path)
    clip = ImageClip(str(img_path)).set_duration(5).set_fps(FPS)
    clip.write_videofile(str(path), fps=FPS, codec="libx264", audio=False, logger=None)


# ── DB write ────────────────────────────────────────────────────────────────────

def insert_video_post(sb, candidate: dict, script: str, gate_report: gates.GateReport, video_path: Path) -> str:
    row = {
        "set_title": candidate["title"],
        "set_number": candidate.get("set_number"),
        "store": candidate["store"],
        "product_url": candidate["product_url"],
        "price_inr": candidate["price_inr"],
        "script": script,
        "script_chars": len(script),
        "gate_results": gate_report.as_dict(),
        "video_path": str(video_path),
        "status": "rendered",
    }
    res = sb.table("video_posts").insert(row).execute()
    return res.data[0]["id"]


def mark_posted(sb, video_id: str, platform: str) -> None:
    status_map = {"ig": "posted_ig", "yt": "posted_yt", "both": "posted_both"}
    if platform not in status_map:
        print(f"ERROR: platform must be one of ig|yt|both, got {platform!r}", file=sys.stderr)
        sys.exit(1)
    sb.table("video_posts").update({
        "status": status_map[platform],
        "posted_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", video_id).execute()
    print(f"Marked {video_id} as {status_map[platform]}.")


# ── CLI ──────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="VID-P4 daily video pipeline")
    parser.add_argument("--suggest", action="store_true", help="show top 3 candidates")
    parser.add_argument("--pick", type=int, help="select candidate N (1-indexed) from --suggest order")
    parser.add_argument("--url", type=str, help="manual override: use this product URL instead of --pick")
    parser.add_argument("--no-tts", action="store_true", help="dry run: silent placeholder audio, no ElevenLabs call")
    parser.add_argument("--placeholder-anchors", action="store_true", help="generate solid-color test anchors if master_assets clips are absent (dry-run only)")
    parser.add_argument("--posted", type=str, help="video_posts.id to mark as posted")
    parser.add_argument("--platform", type=str, choices=["ig", "yt", "both"], help="platform for --posted")
    args = parser.parse_args()

    sb = get_supabase()

    if args.posted:
        if not args.platform:
            print("ERROR: --posted requires --platform ig|yt|both", file=sys.stderr)
            sys.exit(1)
        mark_posted(sb, args.posted, args.platform)
        return

    if args.suggest:
        candidates = get_candidates(sb)
        print_suggestions(candidates)
        return

    if args.pick or args.url:
        candidate = None
        image_paths: list[Path] = []

        if args.url:
            candidates = get_candidates(sb)
            match = next((c for c in candidates if c["product_url"] == args.url), None)
            if not match:
                print(f"ERROR: {args.url} not found among current eligible candidates.", file=sys.stderr)
                sys.exit(1)
            # Manual override: check the one requested product, no substitution --
            # the operator asked for this specific set, don't silently swap it.
            downloaded = download_images(match["image_urls"])
            studio = filter_studio_images(downloaded)
            if len(studio) < MIN_STUDIO_IMAGES:
                print(f"ERROR: {match['title']} has only {len(studio)} studio image(s) (need >={MIN_STUDIO_IMAGES}). No substitution for --url.", file=sys.stderr)
                sys.exit(1)
            candidate, image_paths = match, studio
        else:
            candidates = get_candidates(sb)
            if args.pick < 1 or args.pick > len(candidates):
                print(f"ERROR: --pick {args.pick} out of range (1-{len(candidates)} available).", file=sys.stderr)
                sys.exit(1)
            # Skip forward through the ranked list if a candidate doesn't have
            # enough studio (non-lifestyle) images -- see is_studio_image().
            for idx in range(args.pick - 1, len(candidates)):
                c = candidates[idx]
                downloaded = download_images(c["image_urls"])
                studio = filter_studio_images(downloaded)
                if len(studio) >= MIN_STUDIO_IMAGES:
                    candidate, image_paths = c, studio
                    break
                print(f"SKIP: {c['title']} has only {len(studio)} studio image(s) (need >={MIN_STUDIO_IMAGES}) -- trying next candidate.", file=sys.stderr)
            if candidate is None:
                print("ERROR: no candidate from --pick onward has enough studio images.", file=sys.stderr)
                sys.exit(1)

        print(f"Selected: {candidate['title']} ({candidate['product_url']})")
        print(f"Using {len(image_paths)} studio image(s) for this render.")

        script, report = run_gates_with_one_retry(sb, candidate)
        print("\n--- SCRIPT ---")
        print(script)
        print("--- END SCRIPT ---\n")
        print("Gate results:")
        for r in report.results:
            print(f"  [{'PASS' if r.passed else 'FAIL'}] {r.gate}: {r.reason}")

        audio_path = TEMP_DOWNLOAD / "voiceover.mp3"
        if args.no_tts:
            est_duration = estimate_voiceover_duration_s(script)
            audio_path = TEMP_DOWNLOAD / "voiceover_silent.wav"
            generate_silent_placeholder_audio(audio_path, est_duration)
            print(f"--no-tts: silent placeholder audio, estimated duration {est_duration:.1f}s")
        else:
            generate_tts(script, audio_path)

        slug = slugify(candidate["title"])
        date_str = datetime.now().strftime("%Y-%m-%d")
        output_path = OUTPUT_DIR / f"{date_str}_{slug}.mp4"

        total_duration = assemble_video(image_paths, audio_path, output_path, placeholder_anchors=args.placeholder_anchors)
        print(f"\nRendered: {output_path}")
        print(f"Total duration: {total_duration:.1f}s")
        if total_duration > 90:
            print("WARNING: video exceeds 90s — IG Reels/YT Shorts may reject or truncate.")

        video_id = insert_video_post(sb, candidate, script, report, output_path)
        print(f"video_posts row inserted: {video_id}")
        return

    parser.print_help()


if __name__ == "__main__":
    main()
