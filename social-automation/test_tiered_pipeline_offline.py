"""
test_tiered_pipeline_offline.py -- STANDALONE, OFFLINE, NOT DEPLOYED.
Evidence-gathering only. Not imported by pipeline.py/scraper.py. Not wired
into any workflow. Reuses the Apollo-schema gallery extraction confirmed on
this same branch (feature/lego-apollo-gallery-parser-test).

Implements, for evidence purposes only:
  1. Discovery: Rebrickable + Brickset APIs only -- never lego.com
     coming-soon/sitemap (confirmed blocked on the real GH Actions runner).
  2. Filter: excludes non-buildable candidates using Brickset's real,
     documented `category` field. Confirmed live (2026-08-08) against known
     real/junk candidates before writing this filter -- not assumed:
       - 76342 (Daily Bugle, real posted set)  -> category "Normal"
       - 43290 (Kevin & Dug, real posted set)   -> category "Normal"
       - 5010343, 5010101 (junk from real logs) -> category "Gear"
       - L0002265, L0002237 (junk from real logs) -> category "Other"
       - DISNEYTOWN, POSTER, HEADBAND, Q46515, the 13-digit ISBN-shaped
         numbers, 6669168, 53756, 6626055, 115513 -> Brickset has ZERO
         record of these numbers at all (matches=0).
     Rule adopted from this evidence: a candidate is "buildable" only if
     Brickset's getSets returns >=1 match for it AND that match's
     category == "Normal". Rebrickable-sourced junk that Brickset has never
     heard of is excluded by the same rule (zero match = excluded).
  3. Image source: curl_cffi (impersonate="chrome120") fetching the
     candidate's LEGO.com product page directly by bare set number
     (https://www.lego.com/en-us/product/<num>, following LEGO.com's own
     redirect to the slugged URL), parsed for __APOLLO_STATE__ /
     ProductAssetImage:* entries -- same extraction already verified
     against 30+ real pages on this branch.
  4. Tiering: current-year (2026) tried first. If the whole tier is
     exhausted with fewer than MIN_PASSING_IN_TIER candidates clearing
     MIN_GALLERY_IMAGES, widen to years 2020-2025.
     MIN_PASSING_IN_TIER = 3, chosen as "reasonable" per the investigation
     request -- not derived from data, flagged as a judgment call.
     KNOWN LIMITATION, stated rather than worked around: the local
     REBRICKABLE_API_KEY is confirmed invalid (401 "Invalid token", tested
     both before and during this investigation) -- the widened tier here is
     Brickset-only, not Rebrickable+Brickset combined.
  5. Within a tier, candidates are tried in original sort order (part count
     descending, matching scraper.py's existing behaviour) until one clears
     MIN_GALLERY_IMAGES=10 or the tier is exhausted.
"""
import os
import re
import json
import sys
from pathlib import Path

import requests
from curl_cffi import requests as cffi_requests
from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).parent))
import scraper  # for _lego_headers(), _is_image_url() -- reused, not reimplemented

MIN_GALLERY_IMAGES = scraper.MIN_GALLERY_IMAGES  # 10
MIN_PASSING_IN_TIER = 3  # judgment call, see module docstring

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")


def _load_env():
    env = {}
    for p in (Path(__file__).parent.parent / ".env.local",):
        if p.exists():
            for line in p.read_text(encoding="utf-8").splitlines():
                m = re.match(r"^([A-Z_][A-Z0-9_]*)=(.*)$", line.strip())
                if m:
                    env[m.group(1)] = m.group(2).strip("\"'").strip()
    return env


ENV = _load_env()
BRICKSET_API_KEY = ENV.get("BRICKSET_API_KEY", "")


def brickset_lookup(bare_num: str) -> dict | None:
    """Real live Brickset getSets lookup. Returns the matched set dict
    (with real `category`) or None if zero matches."""
    for variant in (f"{bare_num}-1", bare_num):
        params_json = json.dumps({"setNumber": variant, "pageSize": 1})
        url = (f"https://brickset.com/api/v3.asmx/getSets"
               f"?apiKey={BRICKSET_API_KEY}&userHash=&params={params_json}")
        try:
            r = requests.get(url, timeout=15)
            data = r.json()
        except Exception:
            continue
        if data.get("sets"):
            return data["sets"][0]
    return None


def is_buildable(bare_num: str) -> tuple[bool, str]:
    """Returns (is_buildable, reason). Ground rule confirmed live, see
    module docstring."""
    match = brickset_lookup(bare_num)
    if match is None:
        return False, "brickset_zero_matches"
    cat = match.get("category")
    if cat != "Normal":
        return False, f"brickset_category={cat!r}"
    return True, "brickset_category_Normal"


def brickset_year_range(year_start: int, year_end: int, page_size: int = 50) -> list[dict]:
    """Live Brickset getSets for a year range (real call, Rebrickable
    equivalent not available -- see module docstring)."""
    params_json = json.dumps({"year": f"{year_start},{year_end}", "orderBy": "PiecesDESC", "pageSize": page_size})
    url = (f"https://brickset.com/api/v3.asmx/getSets"
           f"?apiKey={BRICKSET_API_KEY}&userHash=&params={params_json}")
    r = requests.get(url, timeout=20)
    data = r.json()
    return data.get("sets", [])


def apollo_gallery_count(bare_num: str) -> tuple[int, str]:
    """curl_cffi (chrome120) fetch of the LEGO.com product page by bare
    number, Apollo-state gallery extraction. Returns (count, failure_reason
    or '')."""
    try:
        r = cffi_requests.get(
            f"https://www.lego.com/en-us/product/{bare_num}",
            headers={"User-Agent": UA, "Referer": "https://www.lego.com"},
            impersonate="chrome120",
            timeout=20,
            allow_redirects=True,
        )
    except Exception as exc:
        return 0, f"fetch_exception: {exc}"
    if r.status_code != 200:
        return 0, f"http_{r.status_code}"
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)</script>', r.text)
    if not m:
        return 0, "no___NEXT_DATA__"
    try:
        data = json.loads(m.group(1))
    except Exception:
        return 0, "next_data_parse_error"
    apollo = (data.get("props", {}).get("pageProps", {}) or {}).get("__APOLLO_STATE__")
    if not isinstance(apollo, dict):
        return 0, "no___APOLLO_STATE__"
    seen = set()
    for key, val in apollo.items():
        if key.startswith("ProductAssetImage:") and isinstance(val, dict) and val.get("url"):
            seen.add(val["url"])
    if not seen:
        return 0, "apollo_present_zero_images"
    return len(seen), ""


def run_tier(candidates_bare_nums: list[str], tier_name: str, log: list) -> dict | None:
    """Tries candidates in order. Returns the winning candidate's result
    dict, or None if the tier is exhausted. Appends every attempt to `log`."""
    passing = []
    winner = None
    for i, num in enumerate(candidates_bare_nums, start=1):
        buildable, reason = is_buildable(num)
        if not buildable:
            log.append({"tier": tier_name, "attempt": i, "num": num, "buildable": False, "reason": reason})
            continue
        count, fail_reason = apollo_gallery_count(num)
        entry = {"tier": tier_name, "attempt": i, "num": num, "buildable": True,
                  "gallery_count": count, "fail_reason": fail_reason}
        log.append(entry)
        if count >= MIN_GALLERY_IMAGES:
            passing.append(entry)
            if winner is None:
                winner = entry
    return {"winner": winner, "passing_count": len(passing), "tried": len(candidates_bare_nums)}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--candidates", required=True, help="comma-separated bare set numbers, current-year tier, in original sort order")
    parser.add_argument("--day", default="unknown")
    args = parser.parse_args()

    nums = [n.strip() for n in args.candidates.split(",") if n.strip()]
    log = []
    print(f"=== {args.day}: tier=current-year, {len(nums)} candidates ===")
    result = run_tier(nums, "current-year", log)
    for entry in log:
        print(" ", entry)

    if result["passing_count"] < MIN_PASSING_IN_TIER:
        print(f"\ncurrent-year tier produced {result['passing_count']} passing candidate(s) "
              f"(< MIN_PASSING_IN_TIER={MIN_PASSING_IN_TIER}) -- widening to 2020-2025 (Brickset only).")
        widened_raw = brickset_year_range(2020, 2025)
        widened_nums = [str(s["number"]) for s in widened_raw if s.get("number")]
        log2 = []
        result2 = run_tier(widened_nums, "2020-2025", log2)
        for entry in log2[:40]:
            print(" ", entry)
        final_winner = result2["winner"] or result["winner"]
        final_tier = "2020-2025" if result2["winner"] else ("current-year" if result["winner"] else "NONE")
        total_tried = result["tried"] + result2["tried"]
    else:
        final_winner = result["winner"]
        final_tier = "current-year"
        total_tried = result["tried"]

    print(f"\n=== RESULT for {args.day} ===")
    print(f"Winning tier: {final_tier}")
    print(f"Winner: {final_winner}")
    print(f"Total candidates tried across all tiers: {total_tried}")
    print(f"Valid post would result: {final_winner is not None}")
