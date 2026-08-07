"""
scraper.py — Fetches the latest LEGO sets and their gallery images.

Discovery source priority:
  1. LEGO.com coming-soon page (Tier 1 / current-year only) — confirmed
     blocked (403) from GitHub Actions runners; kept as a first attempt but
     effectively always falls through to the API sources below in practice.
  2. Rebrickable API (set discovery)
  3. Brickset API (set discovery + availability data + category)

Gallery image source priority (see get_gallery()):
  1. Brickset API getAdditionalImages — PRIMARY. Reliably fetchable, never
     blocked, confirmed throughout investigation.
  2. LEGO.com product page via curl_cffi Chrome impersonation — SECONDARY,
     opportunistic, best-effort only. Confirmed unreliable (Cloudflare
     blocks it unpredictably, including mid-session after a single prior
     success) -- never required, only adopted if it beats Brickset's count.
  3. Rebrickable main image URL — final fallback, single image.

Buildable-set filter: candidates are checked against Brickset's `category`
field (== "Normal", or "Extended" matching the BrickLink Designer Program
pattern) before ever being appended to a discovery pool. See
_is_buildable_category()'s module-level comment for the evidence this is
based on.

Gallery requirement: every selected set MUST have >= 10 gallery images.
Sets that cannot be enriched with gallery images are skipped.
"""

import os
import re
import json
import sys
import time
from pathlib import Path
from datetime import date, datetime
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import db

try:
    from curl_cffi import requests as cffi_requests
    _CURL_CFFI_AVAILABLE = True
except ImportError:
    cffi_requests = None
    _CURL_CFFI_AVAILABLE = False

load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent / '.env.local')

REBRICKABLE_API_KEY = os.environ.get('REBRICKABLE_API_KEY', '')
BRICKSET_API_KEY    = os.environ.get('BRICKSET_API_KEY', '')

TODAY        = date.today()
CURRENT_YEAR = TODAY.year

MIN_GALLERY_IMAGES = 10   # minimum gallery images required to post

_UPCOMING  = {'Not yet available', 'Available soon'}
_ON_SHELVES = {'Retail', 'Discontinued', 'Retail - available direct only'}

# ── Buildable-set category filter ───────────────────────────────────────────────
#
# Confirmed live against Brickset's own getSets `category` field (2026-08-08,
# see BOI_MASTER_TRACKER.md investigation notes): real, buildable, posted sets
# (76342, 43290, and 9/9 other real historical posted_sets winners spot-checked)
# all come back category=="Normal". Confirmed junk that has repeatedly polluted
# the candidate pool (DISNEYTOWN, POSTER, HEADBAND, Q46515, 12-13-digit
# ISBN/barcode-shaped numbers) has ZERO Brickset record at all -- not merely a
# different category. Gear (puzzles, pencils) and Other (loose minifig packs)
# are real Brickset categories but not buildable sets for this pipeline's
# purposes.
#
# One confirmed, deliberate exception: BrickLink Designer Program sets (e.g.
# 910063 "W.A.L.T.") are real, purchasable, buildable LEGO products but
# Brickset categorizes them "Extended", not "Normal". Named constant so this
# allowlist is easy to extend later without touching the filter logic itself.
BUILDABLE_EXTENDED_CATEGORY_PATTERNS = [
    re.compile(r'^91\d{4}$'),  # BrickLink Designer Program, e.g. 910063
]


def _is_buildable_category(category: str | None, bare_set_num: str) -> bool:
    """True if a Brickset `category` value represents a real, buildable,
    purchasable LEGO set. See module-level comment above for the evidence
    this rule is based on."""
    if category == 'Normal':
        return True
    if category == 'Extended':
        return any(p.match(bare_set_num) for p in BUILDABLE_EXTENDED_CATEGORY_PATTERNS)
    return False


def _brickset_category_lookup(bare_num: str) -> str | None:
    """
    Live Brickset getSets lookup for `category` only. Used to classify
    Rebrickable-sourced candidates, which have no native category field of
    their own -- Brickset is the only source with this signal. Returns None
    if Brickset has no record of this number at all (itself a strong signal
    the candidate isn't a real buildable set -- confirmed live against
    DISNEYTOWN/POSTER/HEADBAND/13-digit ISBN numbers/etc, all zero matches).
    Costs one extra Brickset API call per Rebrickable candidate; accepted
    per investigation request to filter eagerly at discovery time rather
    than lazily at gallery-fetch time.
    """
    if not BRICKSET_API_KEY or not bare_num:
        return None
    for variant in (f'{bare_num}-1', bare_num):
        try:
            r = requests.get(
                'https://brickset.com/api/v3.asmx/getSets',
                params={
                    'apiKey': BRICKSET_API_KEY,
                    'userHash': '',
                    'params': json.dumps({'setNumber': variant, 'pageSize': 1}),
                },
                timeout=15,
            )
            if r.status_code != 200:
                continue
            matches = r.json().get('sets', [])
            if matches:
                return matches[0].get('category')
        except Exception as exc:
            print(f'[scraper] Brickset category lookup failed ({bare_num}): {exc}')
    return None


# ── Shared helpers ─────────────────────────────────────────────────────────────

def _lego_headers() -> dict:
    return {
        'User-Agent':                (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/120.0.0.0 Safari/537.36'
        ),
        'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':           'en-US,en;q=0.5',
        'Accept-Encoding':           'gzip, deflate, br',
        'Referer':                   'https://www.lego.com',
        'Connection':                'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    for fmt in ('%Y-%m-%dT%H:%M:%S', '%Y-%m-%d'):
        try:
            return datetime.strptime(value[:19], fmt).date()
        except ValueError:
            continue
    return None


def _is_genuinely_new(s: dict) -> bool:
    """
    True if the set is a genuine upcoming announcement worth posting about.
    (Same logic as before — availability gate + 14-day recency window.)
    """
    year         = s.get('year') or 0
    availability = s.get('availability') or ''
    us_date      = s.get('us_date')
    uk_date      = s.get('uk_date')

    if availability in _UPCOMING:
        return True
    if us_date and us_date > TODAY:
        return True
    if uk_date and uk_date > TODAY:
        return True

    if availability in _ON_SHELVES:
        if us_date and (TODAY - us_date).days <= 14:
            return True
        return False

    if year < CURRENT_YEAR:
        if us_date and (TODAY - us_date).days <= 14:
            return True
        return False

    if us_date and (TODAY - us_date).days > 14:
        return False

    return True


# ── Source 1: LEGO.com coming-soon page ────────────────────────────────────────

_LEGO_COMING_SOON_URL = 'https://www.lego.com/en-us/categories/coming-soon'


def lego_com_coming_soon() -> list[dict]:
    """
    Scrapes LEGO.com /categories/coming-soon for upcoming sets.
    3 retry attempts with 2s delay between each.
    Tries __NEXT_DATA__ JSON first, then HTML product cards.
    Returns list of partial set dicts with source='lego_coming_soon'.
    """
    print('[scraper] Fetching LEGO.com coming-soon page...')
    resp = None
    for attempt in range(1, 4):
        try:
            resp = requests.get(
                _LEGO_COMING_SOON_URL,
                headers=_lego_headers(),
                timeout=25,
            )
            if resp.status_code == 200:
                break
            print(f'[scraper] LEGO.com attempt {attempt}/3: HTTP {resp.status_code}')
        except Exception as exc:
            print(f'[scraper] LEGO.com attempt {attempt}/3 error: {exc}')
            resp = None
        if attempt < 3:
            time.sleep(2)

    if resp is None or resp.status_code != 200:
        status = resp.status_code if resp else 'no response'
        print(f'[scraper] LEGO.com coming-soon failed after 3 attempts: {status}')
        return []

    soup = BeautifulSoup(resp.text, 'html.parser')

    # Method 1: __NEXT_DATA__ embedded JSON (preferred — richest data)
    nd_tag = soup.find('script', id='__NEXT_DATA__')
    if nd_tag:
        try:
            data = json.loads(nd_tag.string)
            sets = _parse_next_data_products(data)
            if sets:
                print(f'[scraper] LEGO.com coming-soon: {len(sets)} sets via __NEXT_DATA__')
                return sets
        except Exception as exc:
            print(f'[scraper] __NEXT_DATA__ parse failed: {exc}')

    # Method 2: HTML product-leaf cards + per-set product page scraping
    sets = []
    product_links = []
    for card in soup.select('[data-test="product-leaf"]'):
        name_el = card.select_one('[data-test="product-leaf-title"]')
        if not name_el:
            continue
        link = card.select_one('a[href]')
        href = link.get('href', '') if link else ''
        set_num = ''
        if href:
            m = re.search(r'-(\d{4,6})(?:/|\?|$)', href)
            if m:
                set_num = m.group(1) + '-1'
        img_el = card.select_one('img')
        entry = {
            'set_num':       set_num,
            'name':          name_el.get_text(strip=True),
            'year':          CURRENT_YEAR,
            'theme_id':      '',
            'theme':         '',
            'num_parts':     0,
            'image_url':     img_el.get('src', '') if img_el else '',
            'usd_price':     None,
            'us_date':       None,
            'uk_date':       None,
            'availability':  'Not yet available',
            'gallery_images': [],
            'product_url':   href if href.startswith('http') else (
                f'https://www.lego.com{href}' if href.startswith('/') else ''
            ),
            'source':        'lego_coming_soon',
        }
        sets.append(entry)
        if entry['product_url']:
            product_links.append((len(sets) - 1, entry['product_url']))

    print(f'[scraper] LEGO.com coming-soon: {len(sets)} sets via HTML cards')

    # Enrich top sets by scraping their product pages (up to 5)
    for idx, url in product_links[:5]:
        time.sleep(2)
        details = _lego_com_scrape_product_page(url)
        if details:
            s = sets[idx]
            if details.get('num_parts'):
                s['num_parts'] = details['num_parts']
            if details.get('usd_price'):
                s['usd_price'] = details['usd_price']
            if details.get('theme'):
                s['theme'] = details['theme']
            if details.get('gallery_images'):
                s['gallery_images'] = details['gallery_images']
                if not s['image_url'] and details['gallery_images']:
                    s['image_url'] = details['gallery_images'][0]

    return sets


def _extract_apollo_gallery(html: str) -> list[str]:
    """
    Extracts gallery image URLs from a LEGO.com product page's
    __NEXT_DATA__/__APOLLO_STATE__ (confirmed live shape, 2026-08-07/08 --
    see feature/lego-apollo-gallery-parser-test). LEGO.com's current pages
    carry pageProps = {initProps, __APOLLO_STATE__} -- no `product` key of
    any kind. __APOLLO_STATE__ is a normalized Apollo GraphQL cache; every
    gallery photo is a top-level "ProductAssetImage:<id>" entry with a
    direct .url pointing at the existing www.lego.com/cdn/cs/set/assets/...
    path. Returns [] on any parse failure -- never raises.
    """
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)</script>', html)
    if not m:
        return []
    try:
        data = json.loads(m.group(1))
    except Exception:
        return []
    pp = data.get('props', {}).get('pageProps', {})
    apollo = pp.get('__APOLLO_STATE__')
    if not isinstance(apollo, dict):
        return []
    seen, imgs = set(), []
    for key, val in apollo.items():
        if key.startswith('ProductAssetImage:') and isinstance(val, dict):
            u = val.get('url')
            if u and _is_image_url(u) and u not in seen:
                seen.add(u)
                imgs.append(u)
    return imgs


def _lego_com_scrape_product_page(url: str) -> dict:
    """
    Scrapes a single LEGO.com product page for enrichment data.
    Returns dict with: num_parts, usd_price, theme, gallery_images (list of URLs).
    Returns empty dict on any failure.

    Gallery extraction rewritten 2026-08 against the real __APOLLO_STATE__
    schema (see _extract_apollo_gallery()) -- the old logic looked for
    pageProps.product.images/.media, confirmed to no longer exist on any
    live LEGO.com page. num_parts/usd_price/theme extraction below is
    otherwise unchanged from the prior version; its schema was not part of
    this rewrite.
    """
    try:
        resp = requests.get(url, headers=_lego_headers(), timeout=25)
        if resp.status_code != 200:
            return {}
        soup = BeautifulSoup(resp.text, 'html.parser')
        result: dict = {}

        gallery = _extract_apollo_gallery(resp.text)
        if gallery:
            result['gallery_images'] = gallery

        # num_parts/usd_price/theme: still via __NEXT_DATA__, unchanged logic.
        nd_tag = soup.find('script', id='__NEXT_DATA__')
        if nd_tag:
            try:
                data = json.loads(nd_tag.string)
                pp = data.get('props', {}).get('pageProps', {})
                product = (pp.get('product') or pp.get('set')
                           or _deep_find(pp, 'product') or {})
                if product:
                    result['num_parts'] = product.get('pieceCount') or product.get('pieces') or 0
                    price_obj = product.get('price') or {}
                    if isinstance(price_obj, dict):
                        raw = price_obj.get('formattedAmount', '')
                        m = re.search(r'[\d,.]+', raw.replace(',', ''))
                        if m:
                            result['usd_price'] = float(m.group())
                    result['theme'] = product.get('theme', '')
            except Exception:
                pass

        # Fallback: HTML meta/og tags
        if not result.get('usd_price'):
            price_el = (soup.find('meta', property='product:price:amount')
                        or soup.find('[data-test*="price"]'))
            if price_el:
                raw = (price_el.get('content', '')
                       or price_el.get_text(strip=True))
                m = re.search(r'[\d.]+', raw.replace(',', ''))
                if m:
                    result['usd_price'] = float(m.group())

        return result
    except Exception as exc:
        print(f'[scraper] Product page scrape error ({url[:60]}...): {exc}')
        return {}


def _lego_com_gallery_opportunistic(bare_num: str) -> list[str]:
    """
    Best-effort ONLY. LEGO.com's Cloudflare bot-management blocks this
    unpredictably -- confirmed throughout investigation that even a
    Chrome-impersonating TLS/HTTP2 client (curl_cffi) succeeds intermittently
    (as low as 1/20 sequential calls on the real GH Actions runner in one
    observed run) rather than reliably. NEVER treated as required: returns
    [] on ANY failure (403, 404, timeout, schema mismatch, missing
    dependency) and never raises past this function. Never called unless
    curl_cffi is installed (requirements.txt) -- guarded so a missing
    dependency degrades to "always skip", not a crash.
    """
    if not _CURL_CFFI_AVAILABLE or not bare_num:
        return []
    try:
        r = cffi_requests.get(
            f'https://www.lego.com/en-us/product/{bare_num}',
            headers=_lego_headers(),
            impersonate='chrome120',
            timeout=20,
            allow_redirects=True,
        )
        if r.status_code != 200:
            return []
        return _extract_apollo_gallery(r.text)
    except Exception as exc:
        print(f'[scraper] LEGO.com opportunistic fetch error ({bare_num}): {exc}')
        return []


def _parse_next_data_products(data: dict) -> list[dict]:
    """
    Navigate __NEXT_DATA__ JSON to extract product listings.
    Tries multiple known paths for different LEGO.com page versions.
    """
    sets = []
    try:
        page_props = data.get('props', {}).get('pageProps', {})

        # Common locations for product lists in LEGO.com Next.js
        candidates = [
            page_props.get('products'),
            page_props.get('items'),
            page_props.get('productList'),
            _deep_find(page_props, 'products'),
            _deep_find(page_props, 'items'),
        ]
        product_list = next((c for c in candidates if c and isinstance(c, list)), [])

        for item in product_list:
            if not isinstance(item, dict):
                continue
            name    = item.get('name') or item.get('productName', '')
            raw_num = str(item.get('number') or item.get('itemNumber') or item.get('productId', ''))
            set_num = f'{raw_num}-1' if raw_num and '-' not in raw_num else raw_num

            # Extract primary image
            images    = item.get('images') or item.get('media') or []
            image_url = ''
            if images and isinstance(images[0], dict):
                image_url = images[0].get('url') or images[0].get('src', '')
            elif images and isinstance(images[0], str):
                image_url = images[0]

            # Price
            price_obj = item.get('price') or {}
            usd_price = price_obj.get('formattedAmount') if isinstance(price_obj, dict) else None

            if not name:
                continue

            sets.append({
                'set_num':       set_num,
                'name':          name,
                'year':          item.get('yearFrom') or CURRENT_YEAR,
                'theme_id':      '',
                'theme':         item.get('theme', ''),
                'num_parts':     item.get('pieceCount') or item.get('pieces') or 0,
                'image_url':     image_url,
                'usd_price':     usd_price,
                'us_date':       None,
                'uk_date':       None,
                'availability':  'Not yet available',
                'gallery_images': [],
                'source':        'lego_coming_soon',
            })
    except Exception as exc:
        print(f'[scraper] _parse_next_data_products error: {exc}')
    return sets


def _deep_find(obj, key: str, _depth: int = 0):
    """Recursively find first occurrence of key in nested dict/list."""
    if _depth > 8:
        return None
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        for v in obj.values():
            r = _deep_find(v, key, _depth + 1)
            if r is not None:
                return r
    elif isinstance(obj, list):
        for item in obj:
            r = _deep_find(item, key, _depth + 1)
            if r is not None:
                return r
    return None


# ── Gallery image extraction ────────────────────────────────────────────────────
#
# LEGO.com is Cloudflare-protected (403 on plain requests).
# Primary source: Brickset API getAdditionalImages (requires setID from getSets).
# Fallback: Rebrickable main image (single image, usually only 1 available).
# If all sources return < MIN_GALLERY_IMAGES, the set is skipped.


def lego_com_get_gallery(set_data: dict) -> list[str]:
    """Alias kept for backwards compatibility. Delegates to get_gallery()."""
    return get_gallery(set_data)


def get_gallery(set_data: dict) -> list[str]:
    """
    Returns high-res gallery image URLs for the set.
    Primary: Brickset API getAdditionalImages (needs setID lookup) --
    reliably fetchable, never blocked, confirmed throughout investigation.
    Secondary, opportunistic, best-effort only: LEGO.com's own product page
    via curl_cffi Chrome impersonation -- tried, but only adopted if it
    actually returns AND yields strictly more images than Brickset already
    has. Never blocks or fails a candidate if it 403s/errors.
    Fallback: Rebrickable main image URL.
    """
    set_num = set_data.get('set_num', '')
    bare_num = set_num.split('-')[0]
    if not bare_num:
        return []

    # Primary: Brickset API gallery (uses stored setID or looks it up)
    images = _brickset_api_gallery(set_data)

    # Secondary, opportunistic: LEGO.com direct, only if it beats Brickset.
    # Logged either way for future visibility into whether this step is
    # worth keeping at all, given its confirmed unreliability.
    lego_images = _lego_com_gallery_opportunistic(bare_num)
    if lego_images and len(lego_images) > len(images):
        print(f'[scraper] LEGO.com opportunistic fetch SUCCEEDED ({bare_num}): '
              f'{len(lego_images)} images vs {len(images)} from Brickset -- using LEGO.com')
        images = lego_images
    elif lego_images:
        print(f'[scraper] LEGO.com opportunistic fetch succeeded but not adopted ({bare_num}): '
              f'{len(lego_images)} images vs {len(images)} from Brickset already -- keeping Brickset')
    else:
        print(f'[scraper] LEGO.com opportunistic fetch SKIPPED/FAILED ({bare_num}) -- Brickset only')

    if len(images) >= MIN_GALLERY_IMAGES:
        print(f'[scraper] Gallery ({bare_num}): {len(images)} images')
        return images

    # Fallback: add Rebrickable main image URL if we have one
    rb_img = set_data.get('image_url', '')
    if rb_img and _is_image_url(rb_img) and rb_img not in images:
        images = images + [rb_img]

    count = len(images)
    print(f'[scraper] Gallery ({bare_num}): {count} images total '
          f'({"OK" if count >= MIN_GALLERY_IMAGES else "INSUFFICIENT"})')
    return images


def _brickset_api_gallery(set_data: dict) -> list[str]:
    """
    Fetches additional images for a set via Brickset API getAdditionalImages.
    Requires setID — uses stored brickset_set_id or looks it up via getSets.
    Returns full-size imageURLs, with the main Brickset image prepended.
    """
    if not BRICKSET_API_KEY:
        return []

    set_num  = set_data.get('set_num', '')
    bare_num = set_num.split('-')[0]
    set_id   = set_data.get('brickset_set_id')
    main_img = set_data.get('brickset_image_url', '')  # Brickset CDN only — never Rebrickable URLs

    # If we don't have setID, look it up
    if not set_id and bare_num:
        try:
            r = requests.get(
                'https://brickset.com/api/v3.asmx/getSets',
                params={
                    'apiKey': BRICKSET_API_KEY,
                    'userHash': '',
                    'params': json.dumps({'setNumber': f'{bare_num}-1', 'pageSize': 1}),
                },
                timeout=15,
            )
            if r.status_code == 200:
                sets = r.json().get('sets', [])
                if sets:
                    set_id   = sets[0].get('setID')
                    img_data = sets[0].get('image') or {}
                    if not main_img:
                        main_img = img_data.get('imageURL', '')
        except Exception as exc:
            print(f'[scraper] Brickset setSets lookup failed: {exc}')

    if not set_id:
        return []

    # Fetch additional images
    images = []
    try:
        r = requests.get(
            'https://brickset.com/api/v3.asmx/getAdditionalImages',
            params={'apiKey': BRICKSET_API_KEY, 'setID': set_id},
            timeout=15,
        )
        if r.status_code == 200:
            for item in r.json().get('additionalImages', []):
                url = item.get('imageURL', '')
                if url and _is_image_url(url):
                    images.append(url)
    except Exception as exc:
        print(f'[scraper] Brickset getAdditionalImages failed: {exc}')

    # Prepend the main Brickset image so we have one clean hero shot
    if main_img and _is_image_url(main_img):
        images = _dedup_urls([main_img] + images)

    return images


def _is_image_url(url: str) -> bool:
    return bool(url and url.startswith('http') and
                any(url.lower().endswith(ext) for ext in ('.jpg', '.jpeg', '.png', '.webp')))


def _dedup_urls(urls: list) -> list:
    seen, result = set(), []
    for u in urls:
        if u and u not in seen:
            seen.add(u)
            result.append(u)
    return result


# ── Source 2: Rebrickable (fallback for set discovery) ─────────────────────────

def rebrickable_get_sets(year_start: int | None = None, year_end: int | None = None) -> list[dict]:
    """
    year_start/year_end: inclusive year range for discovery. Defaults to
    CURRENT_YEAR-only (existing behavior) when both are None -- used by
    Tier 1. Tiers 2/3 pass explicit ranges (2020-2025, pre-2020).
    """
    if not REBRICKABLE_API_KEY:
        print('[scraper] REBRICKABLE_API_KEY not set -- skipping')
        return []
    y_start = year_start if year_start is not None else CURRENT_YEAR
    y_end   = year_end if year_end is not None else CURRENT_YEAR
    try:
        params = {'ordering': '-year', 'page_size': 20, 'min_year': y_start}
        if y_end:
            params['max_year'] = y_end
        resp = requests.get(
            'https://rebrickable.com/api/v3/lego/sets/',
            headers={'Authorization': f'key {REBRICKABLE_API_KEY}'},
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        results = resp.json().get('results', [])
        sets = []
        dropped_not_buildable = 0
        for s in results:
            set_num  = s.get('set_num', '')
            bare_num = set_num.split('-')[0]
            # Rebrickable's own response has no category field -- Brickset
            # is the only source with that signal, so classify via a live
            # Brickset lookup before this candidate is ever appended to the
            # pool. See _brickset_category_lookup()'s docstring for the cost
            # tradeoff this implies (one extra Brickset call per candidate).
            category = _brickset_category_lookup(bare_num)
            if not _is_buildable_category(category, bare_num):
                dropped_not_buildable += 1
                continue
            sets.append({
                'set_num':       set_num,
                'name':          s.get('name', ''),
                'year':          s.get('year', 0),
                'theme_id':      s.get('theme_id', ''),
                'theme':         '',  # Rebrickable has no theme name — Brickset merge fills this
                'category':      category,
                'num_parts':     s.get('num_parts', 0),
                'image_url':     s.get('set_img_url', ''),
                'usd_price':     None,
                'us_date':       None,
                'uk_date':       None,
                'availability':  '',
                'gallery_images': [],
                'source':        'rebrickable',
            })
        print(f'[scraper] Rebrickable: {len(sets)} buildable sets '
              f'({dropped_not_buildable} dropped as not-buildable) '
              f'(years {y_start}-{y_end})')
        return sets
    except Exception as exc:
        print(f'[scraper] Rebrickable error: {exc}')
        return []


# ── Source 3: Brickset (fallback for set discovery + availability data) ─────────

def brickset_get_sets(year_start: int | None = None, year_end: int | None = None,
                       page_size: int = 50) -> list[dict]:
    """
    year_start/year_end: inclusive year range for discovery. Defaults to
    CURRENT_YEAR-only (existing behavior) when both are None -- used by
    Tier 1. Tiers 2/3 pass explicit ranges (2020-2025, pre-2020).
    """
    if not BRICKSET_API_KEY:
        print('[scraper] BRICKSET_API_KEY not set -- skipping')
        return []
    y_start = year_start if year_start is not None else CURRENT_YEAR
    y_end   = year_end if year_end is not None else CURRENT_YEAR
    # Brickset's `year` param (marked '*' in their docs) takes a decimal or a
    # COMMA-DELIMITED LIST of exact years, not a dash-range -- confirmed
    # against their published API docs. A real range must be spelled out as
    # explicit comma-separated years.
    year_param = ','.join(str(y) for y in range(y_start, y_end + 1))
    try:
        params_json = json.dumps({'year': year_param, 'orderBy': 'PiecesDESC', 'pageSize': page_size})
        resp = requests.get(
            'https://brickset.com/api/v3.asmx/getSets',
            params={'apiKey': BRICKSET_API_KEY, 'userHash': '', 'params': params_json},
            timeout=15,
        )
        resp.raise_for_status()
        raw_sets = resp.json().get('sets', [])
        sets = []
        dropped_not_buildable = 0
        for s in raw_sets:
            number    = str(s.get('number') or '')
            bare_num  = number
            category  = s.get('category')
            # Free -- category is already in this same response, unlike
            # Rebrickable which requires a separate lookup. See
            # _is_buildable_category()'s module-level comment for the
            # evidence this rule is based on.
            if not _is_buildable_category(category, bare_num):
                dropped_not_buildable += 1
                continue
            availability = s.get('availability') or ''
            lego_us   = (s.get('LEGOCom') or {}).get('US') or {}
            lego_uk   = (s.get('LEGOCom') or {}).get('UK') or {}
            us_date   = _parse_date(lego_us.get('dateFirstAvailable'))
            uk_date   = _parse_date(lego_uk.get('dateFirstAvailable'))
            set_num   = f'{number}-1' if number and '-' not in number else number
            image     = s.get('image') or {}
            sets.append({
                'set_num':            set_num,
                'name':               s.get('name', ''),
                'year':               s.get('year', 0),
                'theme_id':           '',
                'theme':              s.get('theme', ''),
                'category':           category,
                'num_parts':          s.get('pieces') or 0,
                'image_url':          image.get('imageURL', ''),
                'brickset_image_url': image.get('imageURL', ''),
                'brickset_set_id':    s.get('setID'),
                'usd_price':          lego_us.get('retailPrice'),
                'us_date':            us_date,
                'uk_date':            uk_date,
                'availability':       availability,
                'gallery_images':     [],
                'source':             'brickset',
            })
        upcoming = sum(1 for s in sets if s['availability'] in _UPCOMING
                       or (s['us_date'] and s['us_date'] > TODAY))
        print(f'[scraper] Brickset: {len(sets)} buildable sets '
              f'({dropped_not_buildable} dropped as not-buildable, {upcoming} flagged upcoming) '
              f'(years {y_start}-{y_end})')
        return sets
    except Exception as exc:
        print(f'[scraper] Brickset error: {exc}')
        return []


# ── Merge + dedup (Rebrickable + Brickset) ────────────────────────────────────

def _merge_and_dedup(rb_sets: list, bs_sets: list) -> list[dict]:
    """
    Rebrickable wins on part count + image.
    Brickset fills: usd_price, us_date, uk_date, availability, theme name.
    """
    merged: dict[str, dict] = {}
    for s in rb_sets:
        key = s['set_num'].split('-')[0]
        merged[key] = s.copy()
    for s in bs_sets:
        key = s['set_num'].split('-')[0]
        if key in merged:
            m = merged[key]
            if m['usd_price'] is None and s['usd_price'] is not None:
                m['usd_price'] = s['usd_price']
            if not m['theme'] and s['theme']:
                m['theme'] = s['theme']
            if not m['availability']:
                m['availability'] = s['availability']
            if m['us_date'] is None:
                m['us_date'] = s['us_date']
            if m['uk_date'] is None:
                m['uk_date'] = s['uk_date']
            if not m.get('brickset_set_id') and s.get('brickset_set_id'):
                m['brickset_set_id'] = s['brickset_set_id']
            if not m.get('brickset_image_url') and s.get('brickset_image_url'):
                m['brickset_image_url'] = s['brickset_image_url']
        else:
            merged[key] = s.copy()
    return list(merged.values())


# ── Main entry point ──────────────────────────────────────────────────────────

def get_new_set(year_start: int | None = None, year_end: int | None = None,
                 require_genuinely_new: bool = True) -> dict | None:
    """
    Returns one set dict with gallery_images populated (>= 10 images), or None.

    year_start/year_end: None (default) = current-year only, i.e. Tier 1's
    existing behavior, unchanged. Explicit ranges (e.g. 2020, 2025) are used
    by pipeline.py's Tier 2/3 fallback.

    require_genuinely_new: Tier 1 (default True) keeps the existing
    "is this a genuine upcoming announcement" recency filter. Tiers 2/3 pass
    False -- _is_genuinely_new() is built around "was this released in the
    last 14 days," which by construction rejects nearly everything in an
    older-year fallback pool. Widening tiers exist precisely to reach past
    that window when Tier 1 is empty, so applying the same recency filter
    there would defeat the point.

    Flow:
      1. Try LEGO.com coming-soon as primary source (Tier 1 / current-year
         range only -- LEGO.com's coming-soon listing is inherently
         current-year, so it's skipped for wider ranges)
      2. If that returns < 3 sets, augment with Rebrickable + Brickset
      3. Filter: genuinely new (Tier 1 only) + not already posted
      4. For each candidate (highest part count first), try LEGO.com gallery
      5. First candidate with >= MIN_GALLERY_IMAGES is selected
      6. If no candidate gets enough gallery images, return None
    """
    is_current_year_tier = year_start is None and year_end is None

    # Step 1: primary + fallback discovery
    lego_sets = lego_com_coming_soon() if is_current_year_tier else []

    rb_sets = brickset_sets = []
    if len(lego_sets) < 3:
        print('[scraper] LEGO.com returned few sets -- augmenting with API fallbacks')
        rb_sets       = rebrickable_get_sets(year_start, year_end)
        brickset_sets = brickset_get_sets(year_start, year_end)

    if lego_sets:
        # Merge LEGO.com results with API data (API enriches availability/parts)
        api_merged = _merge_and_dedup(rb_sets, brickset_sets)
        # Build lookup by bare set number
        api_by_num = {s['set_num'].split('-')[0]: s for s in api_merged}
        for s in lego_sets:
            key = s['set_num'].split('-')[0]
            api = api_by_num.get(key, {})
            # Enrich LEGO.com set with API data where missing
            if not s['num_parts'] and api.get('num_parts'):
                s['num_parts'] = api['num_parts']
            if not s['theme'] and api.get('theme'):
                s['theme'] = api['theme']
            if s['usd_price'] is None and api.get('usd_price') is not None:
                s['usd_price'] = api['usd_price']
            if not s.get('brickset_set_id') and api.get('brickset_set_id'):
                s['brickset_set_id'] = api['brickset_set_id']
            if not s.get('brickset_image_url') and api.get('brickset_image_url'):
                s['brickset_image_url'] = api['brickset_image_url']
        all_sets = lego_sets + [s for s in api_merged
                                if s['set_num'].split('-')[0] not in {
                                    ls['set_num'].split('-')[0] for ls in lego_sets
                                }]
    else:
        all_sets = _merge_and_dedup(rb_sets, brickset_sets)

    if not all_sets:
        print('[scraper] All sources returned empty.')
        return None

    # Filter 1: genuinely new (Tier 1 only -- see require_genuinely_new's
    # docstring above for why this is skipped on widened tiers)
    if require_genuinely_new:
        upcoming = [s for s in all_sets if _is_genuinely_new(s)]
        print(f'[scraper] Newness filter: {len(upcoming)} upcoming, '
              f'{len(all_sets) - len(upcoming)} removed')
    else:
        upcoming = all_sets
        print(f'[scraper] Newness filter skipped (widened tier): {len(upcoming)} candidates')

    if not upcoming:
        print('[scraper] No genuinely new sets found.')
        return None

    # Filter 2: not already posted
    posted_nums = db.get_all_posted_set_nums()
    print(f'[scraper] posted_sets: {len(posted_nums)} set(s)')
    candidates = [
        s for s in upcoming
        if s.get('set_num') and s['set_num'] not in posted_nums
    ]
    print(f'[scraper] {len(candidates)} unposted candidates')

    # Filter 3: drop Rebrickable placeholder names
    candidates = [s for s in candidates if not s.get('name', '').startswith('{')]

    if not candidates:
        return None

    # Sort by part count descending — highest-quality set first
    candidates.sort(key=lambda s: s.get('num_parts') or 0, reverse=True)

    # Step 4: try to enrich each candidate with gallery images
    for s in candidates:
        gallery = lego_com_get_gallery(s)
        if len(gallery) >= MIN_GALLERY_IMAGES:
            s['gallery_images'] = gallery
            # Use first gallery image as primary image_url if absent
            if not s.get('image_url'):
                s['image_url'] = gallery[0]
            # India availability: removed as selection filter.
            # Sets in store_prices produce BETTER captions (real INR prices).
            # Dedup is handled by posted_sets check above — same set never repeats.

            # Supabase pieces fallback — sets table has 100% coverage
            if not s.get('num_parts'):
                pieces = db.get_pieces_from_supabase(s['set_num'])
                if pieces:
                    s['num_parts'] = pieces
                    print(f'[scraper] num_parts from Supabase sets table: {pieces}')

            # Supabase India price — real INR for the stats card
            india_price = db.get_india_price(s['set_num'])
            if india_price:
                s['india_price'] = india_price
                print(f'[scraper] India price from store_prices: {india_price}')

            print(
                f'[scraper] Selected: {s["set_num"]} - {s["name"]} '
                f'({s["num_parts"]} parts, {len(gallery)} gallery images, '
                f'availability="{s.get("availability","?")}")'
            )
            return s
        else:
            print(f'[scraper] Skipping {s["set_num"]} -- only {len(gallery)} gallery images '
                  f'(need {MIN_GALLERY_IMAGES})')

    print('[scraper] No candidates met the gallery image requirement.')
    return None


if __name__ == '__main__':
    import pprint
    print('Step 1 -- Testing scraper with LEGO.com gallery enrichment\n')
    print(f'Gallery requirement: >= {MIN_GALLERY_IMAGES} images per set\n')

    # Test 1: LEGO.com coming-soon
    print('--- Test 1: LEGO.com coming-soon page ---')
    lego_sets = lego_com_coming_soon()
    print(f'Sets found: {len(lego_sets)}')
    for s in lego_sets[:5]:
        print(f'  {s["set_num"]:15s} {s["name"][:50]}')

    if not lego_sets:
        print('\nFalling back to Rebrickable + Brickset...')
        rb = rebrickable_get_sets()
        bs = brickset_get_sets()
        lego_sets = _merge_and_dedup(rb, bs)
        print(f'Fallback sets: {len(lego_sets)}')

    # Test 2: gallery for first candidate
    if lego_sets:
        test_set = lego_sets[0]
        print(f'\n--- Test 2: Gallery images for "{test_set["name"]}" ---')
        gallery = lego_com_get_gallery(test_set)
        print(f'Gallery images found: {len(gallery)}')
        for url in gallery[:5]:
            print(f'  {url}')
        if len(gallery) > 5:
            print(f'  ... and {len(gallery) - 5} more')

    # Test 3: full get_new_set()
    print('\n--- Test 3: Full get_new_set() ---')
    result = get_new_set()
    if result:
        print('Selected set:')
        pprint.pprint({k: v for k, v in result.items()
                       if k not in ('gallery_images', 'image_url')})
        print(f'gallery_images count: {len(result.get("gallery_images", []))}')
    else:
        print('No set selected.')
