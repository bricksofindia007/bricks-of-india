"""
scraper.py — Fetches the latest LEGO sets and their gallery images.

Source priority:
  1. LEGO.com coming-soon page (primary) — scrapes upcoming sets + gallery images
  2. Rebrickable API (fallback for set discovery)
  3. Brickset API (fallback for set discovery + availability data)

Gallery requirement: every selected set MUST have >= 10 gallery images from
LEGO.com. Sets that cannot be enriched with gallery images are skipped.
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

load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent / '.env.local')

REBRICKABLE_API_KEY = os.environ.get('REBRICKABLE_API_KEY', '')
BRICKSET_API_KEY    = os.environ.get('BRICKSET_API_KEY', '')

TODAY        = date.today()
CURRENT_YEAR = TODAY.year

MIN_GALLERY_IMAGES = 10   # minimum gallery images required to post

_UPCOMING  = {'Not yet available', 'Available soon'}
_ON_SHELVES = {'Retail', 'Discontinued', 'Retail - available direct only'}


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


def _lego_com_scrape_product_page(url: str) -> dict:
    """
    Scrapes a single LEGO.com product page for enrichment data.
    Returns dict with: num_parts, usd_price, theme, gallery_images (list of URLs).
    Returns empty dict on any failure.
    """
    try:
        resp = requests.get(url, headers=_lego_headers(), timeout=25)
        if resp.status_code != 200:
            return {}
        soup = BeautifulSoup(resp.text, 'html.parser')
        result: dict = {}

        # Try __NEXT_DATA__ first
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
                    # Gallery images from product media
                    media = product.get('images') or product.get('media') or []
                    imgs = []
                    for item in media:
                        if isinstance(item, dict):
                            u = item.get('url') or item.get('src', '')
                            if u and _is_image_url(u):
                                imgs.append(u)
                        elif isinstance(item, str) and _is_image_url(item):
                            imgs.append(item)
                    if imgs:
                        result['gallery_images'] = imgs
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
    Primary: Brickset API getAdditionalImages (needs setID lookup).
    Fallback: Rebrickable main image URL.
    """
    set_num = set_data.get('set_num', '')
    bare_num = set_num.split('-')[0]
    if not bare_num:
        return []

    # Primary: Brickset API gallery (uses stored setID or looks it up)
    images = _brickset_api_gallery(set_data)
    if len(images) >= MIN_GALLERY_IMAGES:
        print(f'[scraper] Gallery ({bare_num}): {len(images)} images via Brickset API')
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

def rebrickable_get_sets() -> list[dict]:
    if not REBRICKABLE_API_KEY:
        print('[scraper] REBRICKABLE_API_KEY not set -- skipping')
        return []
    try:
        resp = requests.get(
            'https://rebrickable.com/api/v3/lego/sets/',
            headers={'Authorization': f'key {REBRICKABLE_API_KEY}'},
            params={'ordering': '-year', 'page_size': 20, 'min_year': CURRENT_YEAR},
            timeout=15,
        )
        resp.raise_for_status()
        results = resp.json().get('results', [])
        sets = []
        for s in results:
            sets.append({
                'set_num':       s.get('set_num', ''),
                'name':          s.get('name', ''),
                'year':          s.get('year', 0),
                'theme_id':      s.get('theme_id', ''),
                'theme':         '',  # Rebrickable has no theme name — Brickset merge fills this
                'num_parts':     s.get('num_parts', 0),
                'image_url':     s.get('set_img_url', ''),
                'usd_price':     None,
                'us_date':       None,
                'uk_date':       None,
                'availability':  '',
                'gallery_images': [],
                'source':        'rebrickable',
            })
        print(f'[scraper] Rebrickable: {len(sets)} sets (min_year={CURRENT_YEAR})')
        return sets
    except Exception as exc:
        print(f'[scraper] Rebrickable error: {exc}')
        return []


# ── Source 3: Brickset (fallback for set discovery + availability data) ─────────

def brickset_get_sets() -> list[dict]:
    if not BRICKSET_API_KEY:
        print('[scraper] BRICKSET_API_KEY not set -- skipping')
        return []
    try:
        params_json = json.dumps({'year': str(CURRENT_YEAR), 'orderBy': 'YearFrom', 'pageSize': 50})
        resp = requests.get(
            'https://brickset.com/api/v3.asmx/getSets',
            params={'apiKey': BRICKSET_API_KEY, 'userHash': '', 'params': params_json},
            timeout=15,
        )
        resp.raise_for_status()
        raw_sets = resp.json().get('sets', [])
        sets = []
        for s in raw_sets:
            availability = s.get('availability') or ''
            lego_us   = (s.get('LEGOCom') or {}).get('US') or {}
            lego_uk   = (s.get('LEGOCom') or {}).get('UK') or {}
            us_date   = _parse_date(lego_us.get('dateFirstAvailable'))
            uk_date   = _parse_date(lego_uk.get('dateFirstAvailable'))
            number    = str(s.get('number') or '')
            set_num   = f'{number}-1' if number and '-' not in number else number
            image     = s.get('image') or {}
            sets.append({
                'set_num':            set_num,
                'name':               s.get('name', ''),
                'year':               s.get('year', 0),
                'theme_id':           '',
                'theme':              s.get('theme', ''),
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
        print(f'[scraper] Brickset: {len(sets)} sets ({upcoming} flagged upcoming)')
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

def get_new_set() -> dict | None:
    """
    Returns one set dict with gallery_images populated (>= 10 images), or None.

    Flow:
      1. Try LEGO.com coming-soon as primary source
      2. If that returns < 3 sets, augment with Rebrickable + Brickset
      3. Filter: genuinely new + not already posted
      4. For each candidate (highest part count first), try LEGO.com gallery
      5. First candidate with >= MIN_GALLERY_IMAGES is selected
      6. If no candidate gets enough gallery images, return None
    """
    # Step 1: primary + fallback discovery
    lego_sets = lego_com_coming_soon()

    rb_sets = brickset_sets = []
    if len(lego_sets) < 3:
        print('[scraper] LEGO.com returned few sets -- augmenting with API fallbacks')
        rb_sets       = rebrickable_get_sets()
        brickset_sets = brickset_get_sets()

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

    # Filter 1: genuinely new
    upcoming = [s for s in all_sets if _is_genuinely_new(s)]
    print(f'[scraper] Newness filter: {len(upcoming)} upcoming, '
          f'{len(all_sets) - len(upcoming)} removed')

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
