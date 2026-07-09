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
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import requests
from dotenv import load_dotenv

from secrets_util import get_secret

load_dotenv()

# moviepy 1.x calls PIL.Image.ANTIALIAS, removed in Pillow >=10. Verified
# live 2026-07-05: moviepy 1.0.3 + Pillow 10.3.0 raises
# `AttributeError: module 'PIL.Image' has no attribute 'ANTIALIAS'` on any
# .resize() call without this patch. LANCZOS is the same algorithm under the
# old name (Pillow renamed it in 9.1, removed the alias in 10.0).
from PIL import Image, ImageEnhance, ImageFilter
if not hasattr(Image, "ANTIALIAS"):
    Image.ANTIALIAS = Image.LANCZOS

from moviepy.editor import (  # noqa: E402
    AudioFileClip,
    ImageClip,
    VideoClip,
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

# MyBrickHouse is the source for RETAIL DATA -- price, title, availability
# -- with Toycra as fallback, joined by set number. NEVER used for images
# as of 2026-07-06 (see below): retailer photos kept producing composite/
# lifestyle/off-center shots the classifiers had to work increasingly hard
# to filter out.
MBH_URL = "https://lego.mybrickhouse.com/collections/lego-sets/products.json"
MBH_DOMAIN = "lego.mybrickhouse.com"
TOYCRA_URL = "https://www.toycra.com/collections/lego/products.json"
TOYCRA_DOMAIN = "www.toycra.com"

_toycra_products_cache: list[dict] | None = None


def get_toycra_products() -> list[dict]:
    global _toycra_products_cache
    if _toycra_products_cache is None:
        _toycra_products_cache = fetch_shopify_products(TOYCRA_URL)
    return _toycra_products_cache


def find_toycra_fallback(set_number: str | None) -> dict | None:
    """Retail-data fallback only (price/title/availability) -- same set on
    Toycra, matched by set number only (never fuzzy title matching)."""
    if not set_number:
        return None
    for p in get_toycra_products():
        if extract_set_number(p.get("title"), p.get("handle")) == set_number:
            return p
    return None


# Images: 2026-07-06 (operator directive, corrected same day after live
# verification) -- Brickset API getAdditionalImages PRIMARY, Rebrickable
# single main image FALLBACK. This matches social-automation/scraper.py's
# actual, production-proven pattern exactly (same call sequence, same
# endpoints) -- NOT the initially-assumed "LEGO.com primary" spec, which
# was verified live to 403 on both the coming-soon page and a product page
# (Cloudflare-protected, matching that file's own documented reasoning).
# Reused directly rather than reimplemented.
def brickset_gallery_images(set_number: str) -> list[str]:
    brickset_key = get_secret("BRICKSET_API_KEY")
    if not brickset_key:
        return []
    try:
        r = requests.get(
            "https://brickset.com/api/v3.asmx/getSets",
            params={
                "apiKey": brickset_key,
                "userHash": "",
                "params": json.dumps({"setNumber": f"{set_number}-1", "pageSize": 1}),
            },
            timeout=15,
        )
        if r.status_code != 200:
            return []
        found = r.json().get("sets", [])
        if not found:
            return []
        set_id = found[0].get("setID")
        main_img = (found[0].get("image") or {}).get("imageURL", "")
    except Exception as e:
        print(f"WARN: Brickset getSets lookup failed for {set_number}: {e}", file=sys.stderr)
        return []
    if not set_id:
        return []

    images: list[str] = []
    try:
        r2 = requests.get(
            "https://brickset.com/api/v3.asmx/getAdditionalImages",
            params={"apiKey": brickset_key, "setID": set_id},
            timeout=15,
        )
        if r2.status_code == 200:
            for item in r2.json().get("additionalImages", []):
                url = item.get("imageURL", "")
                if url:
                    images.append(url)
    except Exception as e:
        print(f"WARN: Brickset getAdditionalImages failed for {set_number}: {e}", file=sys.stderr)

    if main_img and main_img not in images:
        images = [main_img] + images
    return images


def rebrickable_main_image(set_number: str) -> str | None:
    rb_key = get_secret("REBRICKABLE_API_KEY")
    if not rb_key:
        return None
    try:
        r = requests.get(
            f"https://rebrickable.com/api/v3/lego/sets/{set_number}-1/",
            headers={"Authorization": f"key {rb_key}"},
            timeout=15,
        )
        if r.status_code == 200:
            return r.json().get("set_img_url")
    except Exception as e:
        print(f"WARN: Rebrickable lookup failed for {set_number}: {e}", file=sys.stderr)
    return None

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

# Voice config -- operator-confirmed 2026-07-06 after a real A/B/C listening
# test (Test A: default settings: eleven_flash_v2_5, default similarity;
# Test B: eleven_flash_v2_5, similarity_boost 0.9; Test C:
# eleven_multilingual_v2, similarity_boost 0.85, bills at 2x Flash's rate).
# Test B won. Standing default for ALL TTS calls, not a one-off setting.
#
# Bug found 2026-07-06: the Minas Tirith render (the render this A/B/C test
# was validated against) actually ran BEFORE this lock landed in code --
# that call had no voice_settings at all, so it used whatever ElevenLabs'
# per-voice dashboard default happened to be. Confirmed (operator, via the
# ElevenLabs dashboard) that account's similarity_boost default is currently
# 90% -- meaning the render that "confirmed" Test B matched it by pure
# timing coincidence, not because the code enforced it. All 5 fields
# VoiceSettings supports (confirmed against the installed SDK's
# elevenlabs.types.voice_settings.VoiceSettings Pydantic model, cross-
# checked against ElevenLabs' own current API docs for documented defaults)
# are now set explicitly here so nothing is ever left to an account-level
# default that can drift silently with no record in this repo.
# Documented API defaults for reference: stability=0.5, similarity_boost=0.75,
# style=0, use_speaker_boost=true, speed=1.0 -- we deliberately override only
# similarity_boost (0.9, the Test B result); the rest match the platform
# default but are pinned explicitly rather than omitted, including speed
# (not previously set at all, same silent-drift risk as similarity_boost was).
TTS_MODEL_ID = "eleven_flash_v2_5"
TTS_VOICE_SETTINGS = {
    "stability": 0.5,
    "similarity_boost": 0.9,
    "use_speaker_boost": True,
    "style": 0.0,
    "speed": 1.0,
}


# ── Env / clients ─────────────────────────────────────────────────────────────

def get_supabase():
    url = get_secret("SUPABASE_URL")
    key = get_secret("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in .env", file=sys.stderr)
        sys.exit(1)
    return create_client(url, key)


MASTER_ASSETS_BUCKET = "video-master-assets"


def download_master_assets_if_missing(sb) -> None:
    """
    A fresh GitHub Actions checkout never has master_assets/*.mp4 -- they're
    gitignored (the operator's actual face/voice recordings, not repo
    content). Downloads them from a private Supabase Storage bucket
    (uploaded once, out of band) if not already present locally. No-op on a
    local dev machine that already has the real files.
    """
    for filename in ("intro_hook.mp4", "outro_signoff.mp4"):
        local_path = MASTER_ASSETS / filename
        if local_path.exists():
            continue
        print(f"{local_path} missing -- downloading from {MASTER_ASSETS_BUCKET}...")
        data = sb.storage.from_(MASTER_ASSETS_BUCKET).download(filename)
        local_path.write_bytes(data)
        print(f"Downloaded {filename} ({len(data)} bytes)")


# ── STEP 3: candidate selection ────────────────────────────────────────────────

import re  # noqa: E402

_SET_NUMBER_RE = re.compile(r"(?<!\d)(\d{4,6})(?!\d)")


def extract_set_number_candidates(title: str | None, handle: str | None) -> list[str]:
    """Returns ALL plausible 4-6 digit candidates, in order found (handle
    first, then title) -- does not pick one. A bare digit regex can match
    incidental numbers that aren't set numbers at all (real bug, 2026-07-06:
    "Star Trek: U.S.S. Enterprise NCC-1701-D... 10356" matched both '1701'
    -- the ship's fictional registry number -- and '10356' -- the real
    LEGO set). Confidence-checked disambiguation happens in
    resolve_catalog_match(), which needs the full candidate list, not just
    the first regex hit."""
    from_handle = _SET_NUMBER_RE.findall(handle or "")
    from_title = _SET_NUMBER_RE.findall(title or "")
    seen = []
    for n in from_handle + from_title:
        if n not in seen:
            seen.append(n)
    return seen


def extract_set_number(title: str | None, handle: str | None) -> str | None:
    """Same 4-6 digit convention as scripts/scrape-now.mjs::extractSetNumber
    (verified 2026-07-05 against a real catalog set, 853653, a 6-digit
    number -- the brief said 4-5 digits, but that would miss real sets).

    Best-guess only (first candidate found) -- used for Brickset image
    lookup and DB tracking, where an occasional wrong guess is lower-stakes
    (caught by the studio/lifestyle/composite classifier and operator QC
    review). Catalog fact enrichment (pieces/theme) must NEVER use this
    unvalidated guess -- see resolve_catalog_match()."""
    candidates = extract_set_number_candidates(title, handle)
    return candidates[0] if candidates else None


# Generic words that appear in almost every LEGO product title/name and
# carry no identifying signal -- excluded from the title-vs-catalog-name
# overlap check below.
_GENERIC_TITLE_WORDS = {
    "lego", "icons", "building", "kit", "set", "sets", "for", "adults",
    "pieces", "gift", "collectible", "model", "the", "and", "of", "a",
    "an", "in", "with", "to", "r",
}


def _meaningful_words(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9]+", text.lower())
    return {w for w in words if w not in _GENERIC_TITLE_WORDS and len(w) > 1}


def resolve_catalog_match(sb, title: str, candidates: list[str]) -> tuple[str | None, int | None, str | None]:
    """Cross-checks each candidate set-number against our catalog, requiring
    real keyword overlap between the candidate's title and the catalog's
    own name for that set -- not just a numeric coincidence.

    Verified against the real bug case: candidate '1701' matches catalog
    set 1701 = "Basic Building Set Trial Size" (theme "Basic") -- zero
    meaningful overlap with "Star Trek: U.S.S. Enterprise NCC-1701-D".
    Candidate '10356' matches catalog set 10356 = "Star Trek: U.S.S.
    Enterprise NCC-1701-D" (theme "Icons") -- near-total overlap. Theme
    alone isn't the discriminator here -- LEGO's own "Icons" theme is a
    broad, legitimate umbrella for exactly this kind of adult licensed set
    (also covers Minas Tirith, the Eiffel Tower, etc. this session) -- the
    catalog NAME field is the reliable signal, not theme.

    Returns (None, None, None) if no candidate validates -- the caller
    must not fall back to an unconfirmed guess for pieces/theme.
    """
    title_words = _meaningful_words(title)
    for n in candidates:
        res = sb.table("sets").select("set_number, name, pieces, theme").eq("set_number", n).limit(1).execute()
        if not res.data:
            continue
        row = res.data[0]
        name_words = _meaningful_words(row.get("name") or "")
        overlap = title_words & name_words
        if len(overlap) >= 2:
            return n, row.get("pieces"), row.get("theme")
    return None, None, None


# Bug found 2026-07-06/07, in two stages:
#
# Stage 1 (0ef480a): retailer product titles (MyBrickHouse, Toycra)
# sometimes carry their own piece-count text -- e.g. "...75419 (9023
# Pieces)" -- which can diverge from the catalog's stored value (9031 for
# that exact set at the time). G5's factuality gate already catches a
# script that misstates piece count against the catalog, but it only ever
# reads the SCRIPT text -- it never touches video_posts.set_title, which is
# stored verbatim from the retailer and flows straight into
# build_yt_metadata()'s YouTube title. Fixed by making the catalog's pieces
# value the single source of truth for both the script and the title.
#
# Stage 2 (this fix): 0ef480a's fix assumed the catalog always wins. Wrong,
# confirmed live for this exact set (75419) the following day -- the
# retailer's number (9023) matched LEGO's own printed box art, and the
# catalog's stored value (9031) was the one actually wrong. "Catalog beats
# retailer" is a reasonable prior, not a law, and silently auto-resolving
# in one fixed direction risks a confidently wrong number reaching a live
# video either way -- only the direction of the mistake changed, not the
# underlying risk.
#
# Correct behavior: when catalog and retailer-title piece counts diverge
# beyond a small tolerance (a few pieces -- spares/alternates counted
# differently between sources -- is normal noise; more than that is a real
# conflict, not noise, regardless of how small the absolute number looks),
# do NOT auto-resolve either way. Leave the title untouched, don't state a
# piece count in the script at all (safer than guessing), and record the
# conflict for the operator to resolve manually during review.
_TITLE_PIECE_COUNT_RE = re.compile(r"(\d[\d,]*)(\s*(?:pieces?|pcs\.?))", re.IGNORECASE)
_PIECE_COUNT_TRIVIAL_TOLERANCE = 2


def _extract_title_piece_count(title: str) -> int | None:
    m = _TITLE_PIECE_COUNT_RE.search(title)
    return int(m.group(1).replace(",", "")) if m else None


def resolve_title_and_pieces(title: str, catalog_pieces: int | None) -> tuple[str, int | None, dict | None]:
    """Returns (title, pieces_for_script, discrepancy).

    discrepancy is None unless catalog and title-stated piece counts
    diverge beyond _PIECE_COUNT_TRIVIAL_TOLERANCE -- in that case title is
    returned UNCHANGED, pieces_for_script is None (script states no piece
    count at all), and discrepancy carries both values for the operator.
    """
    if catalog_pieces is None:
        return title, None, None

    title_pieces = _extract_title_piece_count(title)
    if title_pieces is None:
        return title, catalog_pieces, None

    if abs(title_pieces - catalog_pieces) <= _PIECE_COUNT_TRIVIAL_TOLERANCE:
        corrected = _TITLE_PIECE_COUNT_RE.sub(lambda m: f"{catalog_pieces:,}{m.group(2)}", title, count=1)
        return corrected, catalog_pieces, None

    return title, None, {"catalog": catalog_pieces, "retailer_title": title_pieces}


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
    # The >=5 retailer-image filter is gone 2026-07-06 -- images no longer
    # come from the retailer at all (Brickset/Rebrickable now), so a thin
    # retailer gallery is irrelevant. A set_number IS required, since that's
    # the only way to look up Brickset images at all.
    title = product.get("title") or ""
    set_number_candidates = extract_set_number_candidates(title, product.get("handle"))
    if not set_number_candidates:
        return None
    variant = cheapest_variant(product)
    if variant is None:
        return None
    return {
        "title": title,
        "store": store_id,
        "store_name": store_name,
        "product_url": f"https://{domain}/products/{product.get('handle')}",
        "price_inr": float(variant["price"]),
        "set_number": set_number_candidates[0],  # best guess -- images/tracking only, see extract_set_number()
        "set_number_candidates": set_number_candidates,  # full list -- resolve_catalog_match() needs these for enrichment
        "published_at": product.get("published_at") or "",
    }


# Reversible rejection exclusion, added 2026-07-07 alongside content_rejections.
# Two independent exclusion sources now, deliberately NOT collapsed into one
# "any video_posts row exists" check like before:
#
# 1. Any NON-discarded video_posts row for the same set/URL -- covers a
#    real published post (permanent, unchanged), and every other in-flight
#    status (pending_approval, approved, rendered, publish_blocked) so the
#    same candidate is never suggested twice while it's still actively
#    somewhere in the pipeline. 'discarded' is deliberately excluded from
#    this check -- its exclusion is now governed by content_rejections
#    instead, which is the whole point of making rejection reversible.
# 2. A content_rejections row with review_status in ('pending',
#    'permanently_excluded') -- the set stays excluded until an operator
#    explicitly flips it to 'cleared_for_regeneration'.
#
# 'publish_blocked' is deliberately covered ONLY by check 1 (permanent,
# like before this change) -- it is the separate automated gate-failure
# path, not an operator rejection, and is NOT tracked in content_rejections
# at all (flagged back to the operator rather than merged into this table).
_ACTIVE_EXCLUSION_STATUSES = ["rendered", "pending_approval", "approved",
                              "posted_ig", "posted_yt", "posted_both", "publish_blocked"]
_UNRESOLVED_REJECTION_STATUSES = ["pending", "permanently_excluded"]


def already_used(sb, product_url: str, set_number: str | None) -> bool:
    if set_number:
        active = (
            sb.table("video_posts")
            .select("id")
            .eq("set_number", set_number)
            .in_("status", _ACTIVE_EXCLUSION_STATUSES)
            .limit(1)
            .execute()
        )
        if active.data:
            return True
        rejected = (
            sb.table("content_rejections")
            .select("id")
            .eq("set_number", set_number)
            .in_("review_status", _UNRESOLVED_REJECTION_STATUSES)
            .limit(1)
            .execute()
        )
        if rejected.data:
            return True
    by_url = (
        sb.table("video_posts")
        .select("id")
        .eq("product_url", product_url)
        .in_("status", _ACTIVE_EXCLUSION_STATUSES)
        .limit(1)
        .execute()
    )
    return bool(by_url.data)


# enrich_with_catalog() removed 2026-07-06 -- it trusted extract_set_number()'s
# single best-guess number directly, which is exactly what let the "1701"
# bug poison a candidate's pieces/theme facts. Replaced by
# resolve_catalog_match(), which checks every extracted candidate against
# the catalog and requires real title-vs-name overlap before trusting one.


# Price-drop detection: same query pattern and threshold as the real web
# pipeline's src/app/lab/price-drops/page.tsx (drop_inr >= 200 OR
# drop_pct >= 5, baseline = oldest price_history row in the last 30 days),
# reused rather than re-derived. store_prices/price_history.set_id is the
# plain set-number string, not a UUID FK -- verified live against the
# actual table before assuming the join key.
def get_price_drops(sb, set_numbers: list[str], store_id: str = "mybrickhouse") -> dict[str, dict]:
    if not set_numbers:
        return {}
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    current: dict[str, dict] = {}
    cur_res = sb.table("store_prices").select("set_id, price_inr, scraped_at").eq("store_id", store_id).in_("set_id", set_numbers).execute()
    for r in cur_res.data or []:
        if r.get("price_inr") is not None:
            current[r["set_id"]] = {"price": float(r["price_inr"]), "scraped_at": r["scraped_at"]}

    baseline: dict[str, float] = {}
    hist_res = (
        sb.table("price_history").select("set_id, price_inr, recorded_at")
        .eq("store_id", store_id).in_("set_id", set_numbers).gte("recorded_at", since)
        .order("recorded_at", desc=False).execute()
    )
    for r in hist_res.data or []:
        if r["set_id"] not in baseline and r.get("price_inr") is not None:
            baseline[r["set_id"]] = float(r["price_inr"])

    drops: dict[str, dict] = {}
    for set_num, cur in current.items():
        base = baseline.get(set_num)
        if base is None or cur["price"] >= base:
            continue
        drop_inr = base - cur["price"]
        drop_pct = (drop_inr / base) * 100
        if drop_inr < 200 and drop_pct < 5:
            continue
        drops[set_num] = {"old_price": base, "new_price": cur["price"], "drop_inr": drop_inr, "drop_pct": drop_pct}
    return drops


def get_candidates(sb, limit: int = 10, pool_size: int = 30) -> list[dict]:
    mbh_products = fetch_shopify_products(MBH_URL)

    def mbh_price_key(p: dict) -> float:
        v = cheapest_variant(p)
        return float(v["price"]) if v else -1.0

    # Client-side sort, per STEP 0 verification: sort_by is ignored server-side.
    mbh_sorted = sorted(mbh_products, key=mbh_price_key, reverse=True)

    pool: list[dict] = []
    for p in mbh_sorted:
        c = build_candidate(p, "mybrickhouse", "MyBrickHouse", MBH_DOMAIN)
        if c:
            pool.append(c)
        if len(pool) >= pool_size:
            break

    # Filter: not already used.
    fresh = [c for c in pool if not already_used(sb, c["product_url"], c["set_number"])]

    # Rank: newest-arrival + price-drop signals. A real price-drop (reusing
    # the web pipeline's own detector) is a strong "worth talking about
    # today" signal, so it outranks plain recency; otherwise sort by
    # newest-published first (previous behaviour).
    drops = get_price_drops(sb, [c["set_number"] for c in fresh])

    def rank_key(c: dict) -> tuple:
        drop = drops.get(c["set_number"])
        has_drop = 1 if drop else 0
        drop_pct = drop["drop_pct"] if drop else 0.0
        return (has_drop, drop_pct, c.get("published_at") or "")

    fresh.sort(key=rank_key, reverse=True)

    # Attach catalog enrichment (confidence-checked, see resolve_catalog_match)
    # + a one-line reason.
    for c in fresh[:limit]:
        confirmed_number, pieces, theme = resolve_catalog_match(sb, c["title"], c["set_number_candidates"])
        drop = drops.get(c["set_number"])
        discrepancy = None
        if confirmed_number:
            # Use the CONFIRMED number everywhere downstream (Brickset image
            # lookup, video_posts storage, already_used tracking) -- not
            # just for the enrichment facts. Keeping the unvalidated
            # best-guess here would still send the wrong number to Brickset
            # even after fixing the pieces/theme data.
            c["set_number"] = confirmed_number
            # Title + script piece count: see resolve_title_and_pieces()'s
            # docstring -- catalog vs. retailer-title conflicts beyond a
            # trivial tolerance are flagged, not auto-resolved either way.
            c["title"], pieces, discrepancy = resolve_title_and_pieces(c["title"], pieces)
        c["pieces"] = pieces
        c["theme"] = theme
        c["piece_count_discrepancy"] = discrepancy
        if drop:
            reason = f"price drop on MyBrickHouse: ₹{drop['old_price']:,.0f} -> ₹{drop['new_price']:,.0f} ({drop['drop_pct']:.0f}% off)"
        else:
            reason = f"newest arrival on MyBrickHouse (₹{c['price_inr']:,.0f})"
        if discrepancy:
            reason += (
                f", catalog match: {theme} theme, BUT piece count DISPUTED -- "
                f"catalog says {discrepancy['catalog']}, retailer title says {discrepancy['retailer_title']} "
                f"-- needs manual resolution, no piece count will be stated"
            )
        elif confirmed_number:
            reason += f", catalog match: {theme} theme, {pieces} pieces"
        else:
            reason += " (no confident catalog match -- no piece/theme fact)"
        c["reason"] = reason

    return fresh[:limit]


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

    gemini_key = get_secret("GEMINI_SOCIAL_API_KEY")
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

    cerebras_key = get_secret("CEREBRAS_API_KEY")
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


def get_recent_scripts_excluding(sb, exclude_id: str, n: int = 30) -> list[str]:
    """Same as get_recent_scripts, but drops one row by id first. Needed by
    rerender_video_post: G7 opener-uniqueness compares the candidate against
    "recent scripts", and a re-render's candidate IS one of those recent
    rows (its own prior script) -- left in, it would always compare against
    itself and spuriously fail at ~100% similarity."""
    res = sb.table("video_posts").select("id, script").order("created_at", desc=True).limit(n + 1).execute()
    return [row["script"] for row in res.data if row.get("script") and row["id"] != exclude_id][:n]


# Widened 2026-07-09 (Abhinav, explicit) from 4 (initial + 3 retries) to 6
# (initial + 5 retries), alongside the RETRY_NOTE fix below. The old value
# was set 2026-07-05 for the then-current 105-135 word gate; the gate was
# tightened to 90-110 on 2026-07-06 but this budget was never revisited.
# Extra margin while the fixed retry note proves itself in production.
MAX_GENERATION_ATTEMPTS = 6

# Root-cause fix, 2026-07-09 (Abhinav, explicit): this used to be a single
# static RETRY_NOTE -- "must be under 125 words" -- written 2026-07-05 for
# the gate that existed THAT DAY (105-135 words). The very next day
# (2026-07-06) the gate was tightened to 90-110, but this note was never
# updated. Result: every regeneration was told to hit a target ("under
# 125") that itself still fails the real gate, so the retry loop could
# never converge. Confirmed live: 3 consecutive daily runs (2026-07-08/09)
# failed after exactly 4 attempts, 10 of 11 logged attempts landing outside
# 90-110 (up to 157 words), because the model was faithfully complying with
# the wrong instruction it was given. Fixed by computing the note from the
# actual failed attempt's word count and the real 90-110 band, every time.
GENERIC_RETRY_NOTE = (
    "Your last attempt failed a quality gate. Re-read the hard rules above "
    "and try again, especially the 90-110 word count."
)


def _word_count_retry_note(n: int) -> str:
    if n > 110:
        return (
            f"Your last attempt was {n} words -- that FAILS the 90-110 word hard rule "
            f"(too long by {n - 110}). Cut it down to land inside 90-110: remove "
            f"qualifying phrases and shorten the story section first, never cut the "
            f"punchline or the price. Count your words before answering."
        )
    return (
        f"Your last attempt was {n} words -- that FAILS the 90-110 word hard rule "
        f"(too short by {90 - n}). Add real content to land inside 90-110 -- more story "
        f"detail, the LEGO fact, or INDIANIZATION texture -- never pad with filler. Count "
        f"your words before answering."
    )


def run_gates_with_one_retry(sb, candidate: dict) -> tuple[str, gates.GateReport]:
    recent = get_recent_scripts(sb)

    def sets_lookup(set_number: str) -> dict | None:
        res = sb.table("sets").select("pieces, theme").eq("set_number", set_number).limit(1).execute()
        return res.data[0] if res.data else None

    retry_note = None
    report = None
    for attempt in range(1, MAX_GENERATION_ATTEMPTS + 1):
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
            word_count_failed = next(
                (r for r in report.results if r.gate == "G1_word_count" and not r.passed), None
            )
            if word_count_failed:
                retry_note = _word_count_retry_note(len(report.sanitized_script.split()))
            else:
                retry_note = GENERIC_RETRY_NOTE
            print(f"Regenerating (attempt {attempt + 1}/{MAX_GENERATION_ATTEMPTS})...", file=sys.stderr)

    print(f"ERROR: script failed gates {MAX_GENERATION_ATTEMPTS} times. Aborting, not publishing.", file=sys.stderr)
    for r in report.results:
        status = "PASS" if r.passed else "FAIL"
        print(f"  [{status}] {r.gate}: {r.reason}", file=sys.stderr)
    sys.exit(1)


# ── STEP 6: TTS ─────────────────────────────────────────────────────────────────

def generate_tts(script: str, output_path: Path) -> None:
    # Currency AND piece-count spoken-word expansion happen here, at the TTS
    # boundary only -- the stored script (video_posts.script, captions) keeps
    # numeral form for both (₹26,999 / 9,031 pieces); humans read digits
    # instantly, only the audio layer needs words. The char guard must check
    # the EXPANDED text, since that's what's actually sent to (and billed by)
    # ElevenLabs -- expansion makes the payload longer than the stored script.
    tts_text = gates.normalize_currency_for_tts(script)
    tts_text = gates.normalize_piece_count_for_tts(tts_text)
    if len(tts_text) > ELEVENLABS_MAX_SCRIPT_CHARS:
        print(f"ERROR: TTS text is {len(tts_text)} chars after currency expansion, over the {ELEVENLABS_MAX_SCRIPT_CHARS}-char hard guard. Refusing to call ElevenLabs.", file=sys.stderr)
        sys.exit(1)

    api_key = get_secret("ELEVENLABS_API_KEY")
    voice_id = get_secret("ELEVENLABS_VOICE_ID")
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
        model_id=TTS_MODEL_ID,
        output_format="mp3_44100_128",
        # Voice A/B/C test, operator-confirmed 2026-07-06: Test B (this
        # model + similarity_boost 0.9) over Test C (eleven_multilingual_v2,
        # 2x the cost per char). Locked as the standing default, not just
        # that one test's settings -- do not revert without a new test.
        voice_settings=TTS_VOICE_SETTINGS,
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


# Visual assembly rewrite, 2026-07-06 (operator directive): the previous
# cover-crop-and-fill approach is what caused the composite/lifestyle/
# off-center-crop bugs this session -- cover-cropping assumes the subject
# is centered and fills the frame, which retailer photos often don't do.
# Replaced with SOC-AUTO-01's proven pattern instead of building smarter
# classifiers around a fundamentally fragile approach: contained-fit
# foreground (the product image scaled to FIT within a bounded box,
# centered, never cropped -- safe regardless of the source image's aspect
# ratio or subject position) + a blurred cover-crop of the SAME image as
# full-frame background fill. Ported directly from
# social-automation/media_processor.py's _scale_to_fill + GaussianBlur(20)
# + Brightness(0.40) + _scale_to_contain combination. Zoom applies only to
# the sharp foreground; the blurred background stays static per clip.
FG_SIZE = TARGET_W  # 1080 -- foreground box is a square matching frame width
FG_Y = (TARGET_H - FG_SIZE) // 2  # vertically centered, matches SOC-AUTO-01's FG_Y


def _scale_to_fill_pil(image: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Cover-crop to exact target size. Ported from social-automation/
    media_processor.py::_scale_to_fill -- used ONLY for the blurred
    background layer here, never the sharp product image."""
    img_w, img_h = image.size
    scale = max(target_w / img_w, target_h / img_h)
    new_w, new_h = int(img_w * scale), int(img_h * scale)
    resized = image.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def make_ken_burns_clip(image_path: Path, duration_s: float, zoom: float = KEN_BURNS_ZOOM):
    raw = Image.open(image_path).convert("RGB")

    bg_img = _scale_to_fill_pil(raw.copy(), TARGET_W, TARGET_H)
    bg_img = bg_img.filter(ImageFilter.GaussianBlur(radius=20))
    bg_img = ImageEnhance.Brightness(bg_img).enhance(0.40)
    bg_arr = np.array(bg_img)

    fg_img = raw.copy()
    fg_img.thumbnail((FG_SIZE, FG_SIZE), Image.LANCZOS)
    fg_canvas = Image.new("RGB", (FG_SIZE, FG_SIZE), (255, 255, 255))
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


def download_images(urls: list[str], max_images: int = 6, prefix: str = "product") -> list[Path]:
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
        path = TEMP_DOWNLOAD / f"{prefix}_{i}.jpg"
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


# [IMG-DIAG] instrumentation (diagnostic only, no filtering behavior change):
# the image-count question ("how many images does Brickset/Rebrickable
# actually return, how many survive the composite/off-center filters, how
# many end up in the middle section") has so far only ever been answered by
# re-reading this code on demand -- never measured. Logs one structured line
# per candidate so real numbers can be collected across several live
# generations instead of guessed from architecture. Every count is the
# number BEFORE any subsequent cap/filter is applied, so the four fields
# form a strict funnel (api_returned >= downloaded >= studio_kept, then
# final_middle_count includes any Rebrickable top-up).
def _log_image_diag(set_number: str, api_returned: int, downloaded: int,
                    studio_kept: int, rebrickable_used: bool, final_middle_count: int) -> None:
    print(
        f"[IMG-DIAG] set={set_number} brickset_api_returned={api_returned} "
        f"downloaded(capped)={downloaded} studio_kept={studio_kept} "
        f"rebrickable_fallback_used={rebrickable_used} final_middle_count={final_middle_count}",
        file=sys.stderr,
    )


def resolve_candidate_images(candidate: dict) -> list[Path]:
    """Images: Brickset getAdditionalImages PRIMARY, Rebrickable single main
    image FALLBACK (2026-07-06, matches social-automation/scraper.py's
    proven pattern) -- never retailer photos. Studio/lifestyle/composite
    classification still runs as defense-in-depth, not the primary filter,
    since Brickset images are expected to be clean by construction (same
    assumption SOC-AUTO-01 relies on)."""
    set_number = candidate.get("set_number")
    if not set_number:
        print(f"  [no set number extracted for {candidate['title']} -- cannot fetch Brickset images]", file=sys.stderr)
        return []

    print(f"  [Brickset images for {candidate['title']} (set {set_number})]", file=sys.stderr)
    brickset_urls = brickset_gallery_images(set_number)
    downloaded = download_images(brickset_urls, prefix="brickset", max_images=12)
    studio = filter_studio_images(downloaded)
    if len(studio) >= MIN_STUDIO_IMAGES:
        _log_image_diag(set_number, len(brickset_urls), len(downloaded), len(studio), False, len(studio))
        return studio

    rb_url = rebrickable_main_image(set_number)
    if not rb_url:
        print("  [Rebrickable fallback: no main image found]", file=sys.stderr)
        _log_image_diag(set_number, len(brickset_urls), len(downloaded), len(studio), False, len(studio))
        return studio
    print(f"  [Rebrickable fallback image for {candidate['title']}]", file=sys.stderr)
    rb_downloaded = download_images([rb_url], prefix="rebrickable")
    rb_studio = filter_studio_images(rb_downloaded)
    final = studio + rb_studio
    _log_image_diag(set_number, len(brickset_urls), len(downloaded), len(studio), True, len(final))
    return final


def slugify(title: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return s[:60]


# ── STEP 6b: captions (v1, approved style) ──────────────────────────────────────
#
# Transcribes the ACTUAL rendered audio (not the intended script text) --
# this is deliberate: it catches real TTS mispronunciation the same way the
# earlier "rupees" vs "RS" bug was caught by transcription, not by trusting
# the input. openai-whisper's default segmentation is already sentence/
# phrase-level, not word-level, matching the approved style directly.

_CAPTION_FONT_CANDIDATES = [
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]


def _caption_font(size: int):
    from PIL import ImageFont
    for path in _CAPTION_FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except (IOError, OSError):
            continue
    return ImageFont.load_default()


def transcribe_for_captions(audio_path: Path) -> list[dict]:
    import whisper
    model = whisper.load_model("base")
    result = model.transcribe(str(audio_path))
    return [
        {"start": s["start"], "end": s["end"], "text": s["text"].strip()}
        for s in result["segments"] if s["text"].strip()
    ]


def _wrap_caption_text(draw, text: str, font, max_width: int) -> list[str]:
    words = text.split()
    lines, line = [], ""
    for word in words:
        test = (line + " " + word).strip()
        if draw.textbbox((0, 0), test, font=font)[2] > max_width and line:
            lines.append(line)
            line = word
        else:
            line = test
    if line:
        lines.append(line)
    return lines


def burn_captions(video_path: Path, segments: list[dict], output_path: Path) -> None:
    """Bottom-third, white text, dark outline, full-sentence -- approved v1
    style. Renders via PIL per-segment (not moviepy TextClip, which needs
    ImageMagick) for consistency with the rest of this pipeline's manual
    frame compositing."""
    from PIL import ImageDraw
    from moviepy.editor import CompositeVideoClip

    base = VideoFileClip(str(video_path))
    font = _caption_font(56)
    max_width = int(TARGET_W * 0.85)
    caption_y = int(TARGET_H * 0.78)  # bottom-third

    def make_frame(t):
        frame = np.zeros((TARGET_H, TARGET_W, 4), dtype=np.uint8)  # transparent
        seg = next((s for s in segments if s["start"] <= t <= s["end"]), None)
        if seg is None:
            return frame
        img = Image.fromarray(frame, "RGBA")
        draw = ImageDraw.Draw(img)
        lines = _wrap_caption_text(draw, seg["text"], font, max_width)
        line_height = int(font.size * 1.3)
        total_h = line_height * len(lines)
        y = caption_y - total_h // 2
        for line in lines:
            w = draw.textbbox((0, 0), line, font=font)[2]
            x = (TARGET_W - w) // 2
            # dark outline: draw offset copies behind the white fill
            for dx, dy in ((-2, -2), (-2, 2), (2, -2), (2, 2), (-2, 0), (2, 0), (0, -2), (0, 2)):
                draw.text((x + dx, y + dy), line, font=font, fill=(0, 0, 0, 255))
            draw.text((x, y), line, font=font, fill=(255, 255, 255, 255))
            y += line_height
        return np.array(img)

    caption_clip = VideoClip(lambda t: make_frame(t)[:, :, :3], duration=base.duration)
    mask_clip = VideoClip(lambda t: make_frame(t)[:, :, 3] / 255.0, duration=base.duration, ismask=True)
    caption_clip = caption_clip.set_mask(mask_clip)

    final = CompositeVideoClip([base, caption_clip]).set_audio(base.audio)
    final.write_videofile(str(output_path), fps=FPS, codec="libx264", audio_codec="aac", logger=None)


# ── STEP 6c: story badge ────────────────────────────────────────────────────
#
# "Story #N" pill, matching src/components/ui/Taglines.tsx::TaglineChip's
# exact brand style: Fredoka SemiBold text, Brick Yellow (#FFC72C) on Navy
# (#1a2332), fully rounded pill (TaglineChip uses border-radius: 999px).
# TaglineChip is a small web chip (CSS px on a browser viewport); scaled up
# here for a 1080x1920 video frame, not a literal 1:1 unit copy.
#
# Fredoka is loaded via next/font/google on the web side -- no local font
# file exists anywhere in this repo for Python/PIL to use. Fetched the
# actual static TTF from Google Fonts' public CSS2 API (not guessed or
# substituted) to scripts/video/fonts/Fredoka-SemiBold.ttf.
STORY_BADGE_FONT_PATH = BASE_DIR / "fonts" / "Fredoka-SemiBold.ttf"
_BOI_YELLOW = (255, 199, 44)   # #FFC72C
_BOI_NAVY = (26, 35, 50)       # #1a2332
_BADGE_FONT_SIZE = 44
_BADGE_PAD_X, _BADGE_PAD_Y = 36, 16
_BADGE_MARGIN = 40  # top-left offset from frame edge


def render_story_badge(story_number: int) -> "Image.Image":
    """Renders a standalone RGBA 'Story #N' pill badge, transparent
    background, sized to fit the text exactly (plus padding)."""
    from PIL import ImageDraw, ImageFont

    text = f"Story #{story_number}"
    font = ImageFont.truetype(str(STORY_BADGE_FONT_PATH), _BADGE_FONT_SIZE)

    probe = Image.new("RGBA", (10, 10))
    draw = ImageDraw.Draw(probe)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]

    pill_w = text_w + _BADGE_PAD_X * 2
    pill_h = text_h + _BADGE_PAD_Y * 2

    badge = Image.new("RGBA", (pill_w, pill_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(badge)
    draw.rounded_rectangle([0, 0, pill_w, pill_h], radius=pill_h // 2, fill=(*_BOI_NAVY, 255))
    draw.text((_BADGE_PAD_X - bbox[0], _BADGE_PAD_Y - bbox[1]), text, font=font, fill=(*_BOI_YELLOW, 255))
    return badge


def apply_story_badge(video_path: Path, story_number: int, output_path: Path) -> None:
    """Composites a persistent 'Story #N' badge, top-left corner, for the
    FULL video duration (intro + middle + outro) -- unlike captions, this
    is static content, not per-segment, so a single ImageClip suffices
    rather than a per-frame make_frame() function. Positioned well clear of
    the bottom-third caption band, so the two never overlap by
    construction."""
    from moviepy.editor import CompositeVideoClip, ImageClip

    badge_img = render_story_badge(story_number)
    badge_arr = np.array(badge_img)

    base = VideoFileClip(str(video_path))
    badge_clip = (
        ImageClip(badge_arr)
        .set_duration(base.duration)
        .set_position((_BADGE_MARGIN, _BADGE_MARGIN))
    )
    final = CompositeVideoClip([base, badge_clip]).set_audio(base.audio)
    final.write_videofile(str(output_path), fps=FPS, codec="libx264", audio_codec="aac", logger=None)
    base.close()
    base.close()


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

def insert_video_post(sb, candidate: dict, script: str, gate_report: gates.GateReport, video_path: Path) -> tuple[str, int]:
    """Returns (video_id, story_number). story_number is assigned by the
    video_posts_story_number_trigger DB trigger (COALESCE(MAX(story_number),0)+1)
    -- only known for certain once the row exists, hence returned here
    rather than predicted beforehand."""
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
        "piece_count_discrepancy": candidate.get("piece_count_discrepancy"),
    }
    res = sb.table("video_posts").insert(row).execute()
    return res.data[0]["id"], res.data[0]["story_number"]


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


IST_OFFSET = timedelta(hours=5, minutes=30)


def _ist_day_bounds_utc(now_utc: datetime) -> tuple[str, str]:
    """Returns (start, end) ISO timestamps in UTC that bound "today" in IST
    -- posted_at is stored in UTC, so the day boundary has to be computed by
    shifting to IST, truncating to midnight, then shifting back."""
    now_ist = now_utc + IST_OFFSET
    start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    start_utc = start_ist - IST_OFFSET
    end_utc = start_utc + timedelta(days=1)
    return start_utc.isoformat(), end_utc.isoformat()


def already_published_today_ist_at(sb, now_utc: datetime) -> str | None:
    """Returns the id of a video_posts row already posted today (IST
    calendar day, relative to the given now_utc), or None. See the
    --poll-and-publish daily-cap comment for why this exists -- one publish
    per calendar day is the core cadence premise (including for the LEGO
    Fan CoLab application), but nothing checked it before 2026-07-07.
    now_utc is an explicit parameter (not read internally) so this is
    directly testable/simulatable without patching the clock."""
    start, end = _ist_day_bounds_utc(now_utc)
    res = (
        sb.table("video_posts")
        .select("id, posted_at")
        .in_("status", ["posted_ig", "posted_yt", "posted_both"])
        .gte("posted_at", start)
        .lt("posted_at", end)
        .limit(1)
        .execute()
    )
    return res.data[0]["id"] if res.data else None


def already_published_today_ist(sb) -> str | None:
    """Production entry point -- uses the real current time. See
    already_published_today_ist_at's docstring for the actual logic."""
    return already_published_today_ist_at(sb, datetime.now(timezone.utc))


# Fixed daily publish window, added 2026-07-07 (operator, explicit): the
# day-cap alone ("nothing posted yet today") let a publish fire on whatever
# tick happened to be first after midnight IST -- fine for the cap itself,
# but the operator wants a predictable evening slot (7:30 PM IST) instead of
# an arbitrary time of day. Deliberately NOT a single once-a-day cron
# trigger -- the poller keeps its existing 15-minute tick frequency
# (video-publish-poller.yml is unchanged, still `*/15 * * * *`, which spans
# every UTC hour including 14:00 UTC = 19:30 IST) and the publish condition
# becomes "nothing posted today AND current IST time >= 19:30". If the
# 19:30 tick itself is missed (API hiccup, runner delay, GitHub Actions
# scheduling jitter -- schedule triggers are not exact, confirmed live: the
# 2026-07-06 08:44 UTC run before this fix landed over 2.5 hours behind a
# nominal 15-minute cadence), 19:45/20:00/etc. still catch it the same
# evening rather than skipping the whole day, which a single fixed-time
# trigger could not recover from without waiting until tomorrow.
PUBLISH_WINDOW_START_IST = (19, 30)  # (hour, minute), IST, 24h


def _is_past_publish_window_ist(now_utc: datetime) -> bool:
    now_ist = now_utc + IST_OFFSET
    return (now_ist.hour, now_ist.minute) >= PUBLISH_WINDOW_START_IST


# Biweekly rejection-review reminder, added 2026-07-07 (operator, explicit).
# Cron cannot cleanly express "every 14 days" -- rather than fight it, this
# runs on a plain WEEKLY cron and self-gates on a durably-stored
# last_reminder_sent_at instead of relying on cron cadence for the 14-day
# interval. `now_utc` is an explicit parameter on the pure-logic function
# (not read internally) so it's directly testable, same pattern as
# already_published_today_ist_at().
REJECTION_REMINDER_INTERVAL_DAYS = 14


def should_send_rejection_reminder_at(last_sent_at: datetime | None, now_utc: datetime) -> bool:
    """True if a reminder has never been sent, or >=14 days have passed
    since the last one. Does not look at whether anything is actually
    pending -- that's a separate check in check_and_send_rejection_reminder,
    kept apart so this function is a pure timer with nothing else to get
    wrong."""
    if last_sent_at is None:
        return True
    return (now_utc - last_sent_at) >= timedelta(days=REJECTION_REMINDER_INTERVAL_DAYS)


def check_and_send_rejection_reminder(sb) -> None:
    """--check-rejection-reminder entry point, run weekly by
    video-rejection-reminder.yml. Silent no-op (no email, no state change)
    unless BOTH: (a) >=14 days since the last reminder (or none ever sent),
    AND (b) at least one content_rejections row is still review_status=
    'pending'. If (a) holds but (b) doesn't, deliberately does NOT update
    last_reminder_sent_at -- the 14-day timer keeps counting from the last
    REAL send, not from an empty check, so the first genuinely-pending
    rejection after a long quiet stretch still gets flagged promptly rather
    than waiting out a reset window."""
    import notifier as notifier_mod

    state = sb.table("content_rejection_reminders").select("last_reminder_sent_at").eq("id", 1).single().execute().data
    last_sent_raw = (state or {}).get("last_reminder_sent_at")
    last_sent_at = datetime.fromisoformat(last_sent_raw) if last_sent_raw else None

    now_utc = datetime.now(timezone.utc)
    if not should_send_rejection_reminder_at(last_sent_at, now_utc):
        days_since = (now_utc - last_sent_at).days if last_sent_at else None
        print(f"Rejection reminder not due yet (last sent {days_since} day(s) ago, need >={REJECTION_REMINDER_INTERVAL_DAYS}). No-op.")
        return

    pending_res = (
        sb.table("content_rejections")
        .select("set_number, set_title, rejected_at, rejection_reason")
        .eq("review_status", "pending")
        .order("rejected_at")
        .execute()
    )
    pending_rows = pending_res.data

    if not pending_rows:
        print("Rejection reminder due, but zero pending rows -- staying silent, timer not reset.")
        return

    print(f"Sending rejection reminder: {len(pending_rows)} pending row(s).")
    notifier_mod.send_rejection_reminder(pending_rows)
    sb.table("content_rejection_reminders").update({"last_reminder_sent_at": now_utc.isoformat()}).eq("id", 1).execute()
    print(f"last_reminder_sent_at updated to {now_utc.isoformat()}.")


# ── Re-render (full pipeline re-run against an EXISTING row) ────────────────────
#
# Process rule going forward: any post-hoc script/data correction always
# triggers a full re-render (audio + captions + badge), never a DB-only
# field edit -- that gap is exactly what left Story #4 (McLaren) and #5
# (Shopping Street) badge-less despite their underlying data being correct.
# This reuses the EXISTING approved script text (re-sanitized, never
# regenerated via Gemini/Cerebras -- the wording was already approved, only
# the piece-count digit formatting and downstream audio/captions/badge need
# to catch up to it) and re-runs every subsequent pipeline stage for real:
# new TTS (now includes piece-count word-spelling), new image resolution
# (current contained-fit + blurred-bg pipeline), new Whisper captions, new
# badge composite -- then re-uploads to the SAME storage_url filename
# (upsert overwrites in place, so the public URL a reviewer already has
# keeps working). Never touches `status`, `story_number`, or `id` -- this is
# a content refresh of an existing row, not a new post.
def rerender_video_post(sb, video_id: str, no_tts: bool = False) -> dict:
    row_res = sb.table("video_posts").select("*").eq("id", video_id).single().execute()
    row = row_res.data
    if not row:
        print(f"ERROR: no video_posts row found for id {video_id}", file=sys.stderr)
        sys.exit(1)

    print(f"\n=== Re-rendering Story #{row['story_number']}: {row['set_title']} (id {video_id}) ===")

    def sets_lookup(set_number: str) -> dict | None:
        res = sb.table("sets").select("pieces, theme").eq("set_number", set_number).limit(1).execute()
        return res.data[0] if res.data else None

    pieces = None
    if row.get("set_number"):
        catalog_row = sets_lookup(row["set_number"])
        pieces = catalog_row.get("pieces") if catalog_row else None

    # Excludes this row's own (previous) script from the opener-uniqueness
    # comparison set -- otherwise the candidate would compare against
    # itself and always fail at ~100% similarity.
    recent = get_recent_scripts_excluding(sb, video_id)

    # Re-runs sanitize_script (hence _format_piece_counts) on the EXISTING
    # stored script -- not a new generation. report.raw_script preserves
    # the pre-fix text as the audit trail; report.sanitized_script is the
    # corrected, TTS-ready canonical script.
    report = gates.run_all_gates(row["script"], pieces, sets_lookup, recent, row["price_inr"])
    if not report.all_passed:
        print("ERROR: existing script no longer passes gates after re-sanitization -- aborting, not re-rendering.", file=sys.stderr)
        for r in report.results:
            status = "PASS" if r.passed else "FAIL"
            print(f"  [{status}] {r.gate}: {r.reason}", file=sys.stderr)
        sys.exit(1)
    script = report.sanitized_script
    print("--- SCRIPT (post-fix) ---")
    print(script)
    print("--- END SCRIPT ---")

    download_master_assets_if_missing(sb)

    image_candidate = {"title": row["set_title"], "set_number": row.get("set_number")}
    image_paths = resolve_candidate_images(image_candidate)
    if len(image_paths) < MIN_STUDIO_IMAGES:
        print(f"ERROR: only {len(image_paths)} usable studio image(s) for {row['set_title']} (need >={MIN_STUDIO_IMAGES}). No substitution on a re-render.", file=sys.stderr)
        sys.exit(1)
    print(f"Using {len(image_paths)} studio image(s) for this re-render.")

    audio_path = TEMP_DOWNLOAD / "voiceover.mp3"
    if no_tts:
        est_duration = estimate_voiceover_duration_s(script)
        audio_path = TEMP_DOWNLOAD / "voiceover_silent.wav"
        generate_silent_placeholder_audio(audio_path, est_duration)
        print(f"--no-tts: silent placeholder audio, estimated duration {est_duration:.1f}s")
    else:
        generate_tts(script, audio_path)

    slug = slugify(row["set_title"])
    date_str = datetime.now().strftime("%Y-%m-%d")
    output_path = OUTPUT_DIR / f"{date_str}_{slug}_rerender.mp4"

    total_duration = assemble_video(image_paths, audio_path, output_path, placeholder_anchors=False)
    print(f"Rendered: {output_path} ({total_duration:.1f}s)")

    print("Transcribing rendered audio for captions (Whisper)...")
    segments = transcribe_for_captions(output_path)
    captioned_path = output_path.with_name(output_path.stem + "_captioned.mp4")
    burn_captions(output_path, segments, captioned_path)
    output_path.unlink()
    captioned_path.rename(output_path)

    print(f"Applying Story #{row['story_number']} badge...")
    badged_path = output_path.with_name(output_path.stem + "_badged.mp4")
    apply_story_badge(output_path, row["story_number"], badged_path)
    output_path.unlink()
    badged_path.rename(output_path)
    print(f"Final re-rendered artifact: {output_path}")

    import publish as publish_mod

    print("Uploading to storage (same filename -- overwrites existing storage_url in place)...")
    storage_url = publish_mod.upload_video_to_storage(sb, str(output_path), f"{video_id}.mp4")
    qc_urls = publish_mod.extract_and_upload_qc_frames(sb, str(output_path), video_id)

    # status/story_number/id deliberately absent from this update -- a
    # re-render refreshes content, it never changes a row's identity or
    # workflow state.
    sb.table("video_posts").update({
        "script": script,
        "script_chars": len(script),
        "gate_results": report.as_dict(),
        "video_path": str(output_path),
        "storage_url": storage_url,
        "qc_frame_urls": qc_urls,
    }).eq("id", video_id).execute()
    print(f"video_posts {video_id} updated in place (status untouched). storage_url: {storage_url}")

    return {
        "video_id": video_id,
        "story_number": row["story_number"],
        "output_path": output_path,
        "script": script,
        "storage_url": storage_url,
    }


# ── CLI ──────────────────────────────────────────────────────────────────────────

def main() -> None:
    # Generation-to-ready timing (2026-07-07, operator request: measure, don't
    # estimate). This is the earliest moment this Python process can observe
    # -- it is NOT the same instant the 6 AM cron fires. GitHub Actions
    # scheduled triggers queue a runner, then run actions/checkout + pip
    # install (observed ~40s+ for this dependency list) before this script's
    # first line ever executes, and schedule triggers themselves can lag
    # their nominal time by minutes to hours (confirmed live this session --
    # a run landed 2.5 hours behind its */15 cadence). To get the FULL
    # cron-fire-to-pending-approval span including that provisioning/queueing
    # gap, cross-reference this run's `gh run view --json createdAt` against
    # the `_timing.pending_approval_at` value stored below in gate_results --
    # engine.py alone cannot see the cron-fire instant, only its own start.
    generation_started_at = datetime.now(timezone.utc)

    parser = argparse.ArgumentParser(description="VID-P4 daily video pipeline")
    parser.add_argument("--suggest", action="store_true", help="show top 3 candidates")
    parser.add_argument("--pick", type=int, help="select candidate N (1-indexed) from --suggest order")
    parser.add_argument("--cloud-generate", action="store_true", help="Stage 2 cloud workflow: auto-pick the top candidate, download master assets from storage if missing, and leave the row in status='pending_approval' with storage_url/qc_frame_urls populated instead of 'rendered'")
    parser.add_argument("--url", type=str, help="manual override: use this product URL instead of --pick")
    parser.add_argument("--no-tts", action="store_true", help="dry run: silent placeholder audio, no ElevenLabs call")
    parser.add_argument("--placeholder-anchors", action="store_true", help="generate solid-color test anchors if master_assets clips are absent (dry-run only)")
    parser.add_argument("--posted", type=str, help="video_posts.id to mark as posted")
    parser.add_argument("--platform", type=str, choices=["ig", "yt", "both"], help="platform for --posted")
    parser.add_argument("--publish", type=str, help="video_posts.id to actually post live to IG Reels + YouTube Shorts")
    parser.add_argument("--poll-and-publish", action="store_true", help="Stage 4: find every status='approved' row and publish it (used by the scheduled poller workflow)")
    parser.add_argument("--resend-notification", type=str, help="video_posts.id to re-send the Stage F publish notification for, using its already-stored results (does not re-post)")
    parser.add_argument("--rerender", type=str, help="video_posts.id to fully re-render (re-sanitized script, new TTS, new images, new Whisper captions, new badge) and re-upload to its existing storage_url. Never touches status/story_number/id.")
    parser.add_argument("--check-rejection-reminder", action="store_true", help="weekly cron entry point: send the biweekly content_rejections review reminder if 14+ days have passed since the last one AND at least one row is still review_status='pending'. Silent no-op otherwise.")
    args = parser.parse_args()

    sb = get_supabase()

    if args.check_rejection_reminder:
        check_and_send_rejection_reminder(sb)
        return

    if args.rerender:
        result = rerender_video_post(sb, args.rerender, no_tts=args.no_tts)
        print(f"\nRe-render complete for Story #{result['story_number']} ({args.rerender}).")
        print(f"  Local file: {result['output_path']}")
        print(f"  storage_url: {result['storage_url']}")
        return

    if args.resend_notification:
        import notifier as notifier_mod

        row_res = sb.table("video_posts").select("*").eq("id", args.resend_notification).single().execute()
        video_post = row_res.data
        if not video_post:
            print(f"ERROR: no video_posts row found for id {args.resend_notification}", file=sys.stderr)
            sys.exit(1)
        ig_result = {"permalink": video_post["ig_permalink"]} if video_post.get("ig_permalink") else None
        yt_result = {"url": video_post["yt_url"]} if video_post.get("yt_url") else None
        notifier_mod.send_publish_notification(video_post, ig_result, yt_result)
        print(f"Notification re-sent for {args.resend_notification}.")
        return

    if args.poll_and_publish:
        import publish as publish_mod
        import notifier as notifier_mod

        # Daily publish cap -- root-caused 2026-07-07: Minas Tirith (13:51 UTC)
        # and N-1 Starfighter (17:52 UTC) both went out on 2026-07-06 because
        # NOTHING anywhere ever checked this. The only "daily" throttle that
        # existed was on the GENERATION side (video-generate-daily.yml, one
        # new candidate/day) -- approval is an ungated, out-of-band Supabase
        # UPDATE (chat-Claude or the operator, any time), and this poller
        # unconditionally published every status='approved' row it found on
        # every 15-minute tick, with no grouping by day and no cap on rows
        # processed per run. Both 2026-07-06 posts were legitimate, deliberate
        # chat-approvals (the second one was the operator validating the
        # brand-new Stage 3/4 approval flow the same night it was built) --
        # there was no bug to bypass, no wrong date field, no wrong timezone:
        # the check simply never existed. Two-part fix: (1) skip this run
        # entirely if anything already posted today (IST, matching the
        # operator's real day and generate-daily's 6 AM IST cadence), (2)
        # even on a run that does publish, stop after the first row that
        # actually goes live on at least one platform -- a backlog of
        # multiple approved rows must drain one per day, not all at once.
        already_posted_id = already_published_today_ist(sb)
        if already_posted_id:
            print(f"Already published today (IST): video_posts {already_posted_id}. "
                  f"Holding all approved rows for tomorrow's poll -- at most one publish per calendar day.")
            return

        # Fixed evening window, not a single once-a-day trigger -- see
        # _is_past_publish_window_ist's comment. The poller still ticks every
        # 15 minutes; before 19:30 IST this is a deliberate silent no-op so a
        # missed 19:30 tick is recovered by 19:45/20:00/etc. the same evening.
        now_utc = datetime.now(timezone.utc)
        if not _is_past_publish_window_ist(now_utc):
            now_ist = now_utc + IST_OFFSET
            print(f"Before publish window (19:30 IST) -- current IST time {now_ist.strftime('%H:%M')}. Nothing to do this tick.")
            return

        # Explicit, tested sort key: story_number, not created_at. They
        # currently always agree (story_number is assigned by a BEFORE
        # INSERT trigger off row-creation order -- see
        # 20260707050000_video_posts_story_number.sql), but that's an
        # incidental correlation, not a guarantee for every future insert
        # path -- publish order must be pinned to the field that actually
        # defines "Story #N" ordering.
        approved_res = sb.table("video_posts").select("*").eq("status", "approved").order("story_number").execute()
        approved_rows = approved_res.data

        if not approved_rows:
            print("No approved rows found. Nothing to publish.")
            return

        print(f"Found {len(approved_rows)} approved row(s) queued; publishing at most one this run (daily cap).")
        exit_code = 0

        for i, video_post in enumerate(approved_rows):
            vid = video_post["id"]
            print(f"\n--- Publishing {vid} ({video_post['set_title']}) ---")

            try:
                results = publish_mod.publish_video_post(sb, video_post)
            except (publish_mod.GateFailureError, publish_mod.CaptionsMissingError) as exc:
                # An already-approved row failing a hard guard at publish time
                # is unexpected (approval implies the gates already passed at
                # generation time) -- move it OUT of status='approved' so the
                # poller doesn't retry the same deterministic failure every
                # 15-30 minutes and re-alert each time, but keep it clearly
                # distinct from an operator's own 'discarded' action.
                print(f"ERROR: hard guard blocked {vid}: {exc}", file=sys.stderr)
                sb.table("video_posts").update({"status": "publish_blocked"}).eq("id", vid).execute()
                notifier_mod.send_skip_notification(
                    reason=f"Approved video failed a hard guard at publish time: {exc}",
                    candidate_title=video_post.get("set_title"),
                )
                exit_code = 1
                continue  # doesn't count as today's publish -- try the next queued row this same run

            refreshed = sb.table("video_posts").select("*").eq("id", vid).single().execute().data
            notifier_mod.send_publish_notification(refreshed, results.get("ig"), results.get("yt"))

            # Report both platforms' outcomes separately whenever they
            # diverge -- never collapse a partial success into a single
            # "posted" line.
            if "ig" in results and "yt" in results:
                print(f"{vid}: posted_both -- IG {results['ig']['permalink']} | YT {results['yt']['url']}")
            elif "ig" in results:
                print(f"{vid}: posted_ig only -- IG {results['ig']['permalink']} live; YouTube FAILED: {results['errors']}", file=sys.stderr)
                exit_code = 1
            elif "yt" in results:
                print(f"{vid}: posted_yt only -- YT {results['yt']['url']} live; Instagram FAILED: {results['errors']}", file=sys.stderr)
                exit_code = 1
            else:
                print(f"{vid}: BOTH platforms failed: {results['errors']}", file=sys.stderr)
                exit_code = 1

            if "ig" in results or "yt" in results:
                # At least one platform actually went live -- today's publish
                # is used up. Remaining approved rows stay queued for tomorrow.
                remaining = len(approved_rows) - i - 1
                if remaining:
                    print(f"Daily cap reached -- {remaining} remaining approved row(s) held for tomorrow.")
                break
            # else: both platforms failed, nothing actually went out -- fall
            # through and try the next approved row in this same run.

        sys.exit(exit_code)

    if args.publish:
        import publish as publish_mod
        import notifier as notifier_mod

        row_res = sb.table("video_posts").select("*").eq("id", args.publish).single().execute()
        video_post = row_res.data
        if not video_post:
            print(f"ERROR: no video_posts row found for id {args.publish}", file=sys.stderr)
            sys.exit(1)

        try:
            results = publish_mod.publish_video_post(sb, video_post)
        except (publish_mod.GateFailureError, publish_mod.CaptionsMissingError) as exc:
            # The two cases where nothing was attempted at all -- no partial
            # results exist, no notification to send (there's nothing to show).
            print(f"ERROR: {exc}", file=sys.stderr)
            sys.exit(1)

        # Re-fetch so the notification reflects what was actually written
        # (qc_frame_urls, storage_url) even if a platform call failed partway.
        refreshed = sb.table("video_posts").select("*").eq("id", args.publish).single().execute().data
        notifier_mod.send_publish_notification(refreshed, results.get("ig"), results.get("yt"))

        print(f"\nPublish attempt complete for {args.publish}:")
        if "ig" in results:
            print(f"  IG Reels: {results['ig']['permalink']}")
        else:
            print("  IG Reels: FAILED (see errors above)")
        if "yt" in results:
            print(f"  YouTube Shorts: {results['yt']['url']}")
        else:
            print("  YouTube Shorts: FAILED (see errors above)")

        if results["errors"]:
            print(f"\nERRORS: {'; '.join(results['errors'])}", file=sys.stderr)
            sys.exit(1)
        return

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

    if args.pick or args.url or args.cloud_generate:
        if args.cloud_generate and not args.pick:
            args.pick = 1  # cloud generation always takes the top-ranked candidate

        if not args.placeholder_anchors:
            download_master_assets_if_missing(sb)

        candidate = None
        image_paths: list[Path] = []

        if args.url:
            candidates = get_candidates(sb)
            match = next((c for c in candidates if c["product_url"] == args.url), None)
            if not match:
                print(f"ERROR: {args.url} not found among current eligible candidates.", file=sys.stderr)
                sys.exit(1)
            # Manual override: check the one requested product (with Toycra
            # fallback), no candidate substitution -- the operator asked for
            # this specific set, don't silently swap it for a different one.
            studio = resolve_candidate_images(match)
            if len(studio) < MIN_STUDIO_IMAGES:
                print(f"ERROR: {match['title']} has only {len(studio)} studio image(s) combined across MyBrickHouse + Toycra (need >={MIN_STUDIO_IMAGES}). No substitution for --url.", file=sys.stderr)
                sys.exit(1)
            candidate, image_paths = match, studio
        else:
            candidates = get_candidates(sb)
            if args.pick < 1 or args.pick > len(candidates):
                print(f"ERROR: --pick {args.pick} out of range (1-{len(candidates)} available).", file=sys.stderr)
                sys.exit(1)
            # Skip forward through the ranked list only if a candidate still
            # doesn't have enough usable images after the Toycra fallback.
            for idx in range(args.pick - 1, len(candidates)):
                c = candidates[idx]
                studio = resolve_candidate_images(c)
                if len(studio) >= MIN_STUDIO_IMAGES:
                    candidate, image_paths = c, studio
                    break
                print(f"SKIP: {c['title']} has only {len(studio)} studio image(s) combined across MyBrickHouse + Toycra (need >={MIN_STUDIO_IMAGES}) -- trying next candidate.", file=sys.stderr)
            if candidate is None:
                print("ERROR: no candidate from --pick onward has enough studio images, even with Toycra fallback.", file=sys.stderr)
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

        print("Transcribing rendered audio for captions (Whisper, catches real TTS pronunciation)...")
        segments = transcribe_for_captions(output_path)
        captioned_path = output_path.with_name(output_path.stem + "_captioned.mp4")
        burn_captions(output_path, segments, captioned_path)

        # Bug found 2026-07-06, confirmed via SHA256 (not just file size):
        # the pre-caption render (output_path) and the captioned render
        # (captioned_path) coexisted as two files after every run, and
        # video_posts.video_path pointed at output_path -- the file actually
        # uploaded and posted to both IG and YouTube for the first live post
        # was byte-identical to the pre-caption intermediate, not the
        # captioned one, despite the caption-burn step running successfully
        # in that same invocation.
        #
        # Fix: collapse to exactly one artifact per run. Delete the
        # pre-caption intermediate and have captioned_path take over
        # output_path's name -- there is no second file left on disk that
        # could ever be mistakenly referenced as "the" video for this run.
        output_path.unlink()
        captioned_path.rename(output_path)
        print(f"Captioned (sole output for this run): {output_path}")

        video_id, story_number = insert_video_post(sb, candidate, script, report, output_path)
        print(f"video_posts row inserted: {video_id} (Story #{story_number})")

        print(f"Applying Story #{story_number} badge...")
        badged_path = output_path.with_name(output_path.stem + "_badged.mp4")
        apply_story_badge(output_path, story_number, badged_path)
        # Same single-artifact rule as the caption-burn collapse above --
        # exactly one file per run, no second path anything could
        # mistakenly reference.
        output_path.unlink()
        badged_path.rename(output_path)
        print(f"Badged (sole output): {output_path}")

        if args.cloud_generate:
            import publish as publish_mod
            import notifier as notifier_mod

            print("Stage 2: uploading captioned video + QC frames to storage...")
            storage_url = publish_mod.upload_video_to_storage(sb, str(output_path), f"{video_id}.mp4")
            qc_urls = publish_mod.extract_and_upload_qc_frames(sb, str(output_path), video_id)

            # Generation-to-ready timing: real measurement, stored under the
            # same "_"-prefixed metadata convention gate_results already uses
            # (see assert_all_gates_passed()'s "_" = metadata, not a gate rule)
            # so it rides along with the row rather than needing a schema
            # migration. `report` is still the same GateReport this run
            # produced earlier -- re-serializing it here just adds the timing
            # key on top of the gate results already written at insert time.
            pending_approval_at = datetime.now(timezone.utc)
            gate_results_with_timing = report.as_dict()
            gate_results_with_timing["_timing"] = {
                "generation_started_at": generation_started_at.isoformat(),
                "pending_approval_at": pending_approval_at.isoformat(),
                "duration_seconds": (pending_approval_at - generation_started_at).total_seconds(),
                "note": "generation_started_at is this script's own start, not the cron-fire instant -- see main()'s opening comment.",
            }

            sb.table("video_posts").update({
                "storage_url": storage_url,
                "qc_frame_urls": qc_urls,
                "status": "pending_approval",
                "gate_results": gate_results_with_timing,
            }).eq("id", video_id).execute()
            duration_s = gate_results_with_timing["_timing"]["duration_seconds"]
            print(f"video_posts {video_id} set to status='pending_approval'. storage_url: {storage_url}")
            print(f"[TIMING] generation_started_at={generation_started_at.isoformat()} "
                  f"pending_approval_at={pending_approval_at.isoformat()} duration={duration_s:.1f}s "
                  f"(measured from this script's own start -- see note above for what this does/doesn't include)")

            notifier_mod.send_ready_for_review_notification(
                story_number=story_number,
                set_title=candidate["title"],
                storage_url=storage_url,
                qc_frame_urls=qc_urls,
            )

        return

    parser.print_help()


if __name__ == "__main__":
    main()
