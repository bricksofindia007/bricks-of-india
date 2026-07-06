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
    brickset_key = os.environ.get("BRICKSET_API_KEY")
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
    rb_key = os.environ.get("REBRICKABLE_API_KEY")
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
TTS_MODEL_ID = "eleven_flash_v2_5"
TTS_VOICE_SETTINGS = {
    "stability": 0.5,
    "similarity_boost": 0.9,
    "use_speaker_boost": True,
    "style": 0.0,
}


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


def already_used(sb, product_url: str, set_number: str | None) -> bool:
    if set_number:
        by_set = sb.table("video_posts").select("id").eq("set_number", set_number).limit(1).execute()
        if by_set.data:
            return True
    by_url = sb.table("video_posts").select("id").eq("product_url", product_url).limit(1).execute()
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
        if confirmed_number:
            # Use the CONFIRMED number everywhere downstream (Brickset image
            # lookup, video_posts storage, already_used tracking) -- not
            # just for the enrichment facts. Keeping the unvalidated
            # best-guess here would still send the wrong number to Brickset
            # even after fixing the pieces/theme data.
            c["set_number"] = confirmed_number
        c["pieces"] = pieces
        c["theme"] = theme
        if drop:
            reason = f"price drop on MyBrickHouse: ₹{drop['old_price']:,.0f} -> ₹{drop['new_price']:,.0f} ({drop['drop_pct']:.0f}% off)"
        else:
            reason = f"newest arrival on MyBrickHouse (₹{c['price_inr']:,.0f})"
        if confirmed_number:
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
        return studio

    rb_url = rebrickable_main_image(set_number)
    if not rb_url:
        print("  [Rebrickable fallback: no main image found]", file=sys.stderr)
        return studio
    print(f"  [Rebrickable fallback image for {candidate['title']}]", file=sys.stderr)
    rb_downloaded = download_images([rb_url], prefix="rebrickable")
    rb_studio = filter_studio_images(rb_downloaded)
    return studio + rb_studio


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
        print(f"Captioned: {captioned_path}")

        video_id = insert_video_post(sb, candidate, script, report, output_path)
        print(f"video_posts row inserted: {video_id}")
        return

    parser.print_help()


if __name__ == "__main__":
    main()
