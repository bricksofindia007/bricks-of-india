"""
price_check.py -- pre-publish price check (P23).

Before a video is posted, the price stored on it must match either the current
price at its store or the set's MRP (within half a rupee). Stock status never
blocks a post, at any store. The row is held only when the stored price matches
neither, or when no price can be compared at all (no store price and no MRP).

A held row gets status 'publish_blocked' and a plain note that names the stored
price, the store price and the MRP. Nothing is deleted, and no field other than
status and escalation_note is written.

Store matching: video_posts.store is the store id (for example 'mybrickhouse'),
the same value as store_prices.store_id. store_prices.set_id holds the set
number as text. The MRP is sets.lego_mrp_inr for the same set number.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

# Stored and current prices are whole rupees in practice; half a rupee of
# slack absorbs float rounding and nothing else.
PRICE_TOLERANCE_INR = 0.5

STORE_DISPLAY_NAME = {
    'mybrickhouse': 'LEGO.in',
    'toycra': 'Toycra',
}


@dataclass(frozen=True)
class Listing:
    price_inr: float | None
    in_stock: bool


def _rupees(value: float) -> str:
    return f'₹{int(round(value)):,}'


def _store_name(store: str | None) -> str:
    return STORE_DISPLAY_NAME.get(store or '', store or 'unknown store')


def _same(a: float, b: float) -> bool:
    return abs(float(a) - float(b)) <= PRICE_TOLERANCE_INR


def evaluate(stored_price: float | None, store: str | None, listing: Listing | None, mrp: float | None = None) -> dict:
    """Pure decision. Returns {'decision': 'post'|'block', 'reason': str, 'note': str}.

    Post when the stored price matches the store price or the MRP. Stock status is
    written into the note but never changes the decision. Block when the stored
    price matches neither, or when there is nothing to compare against.
    """
    where = _store_name(store)
    stored_txt = _rupees(stored_price) if stored_price is not None else 'no stored price'
    store_price = listing.price_inr if listing is not None else None
    store_txt = _rupees(store_price) if store_price is not None else f'no price at {where}'
    mrp_txt = _rupees(mrp) if mrp is not None else 'no MRP'
    if listing is None:
        stock_txt = 'no current listing'
    else:
        stock_txt = 'in stock' if listing.in_stock else 'out of stock'

    if stored_price is not None:
        if store_price is not None and _same(stored_price, store_price):
            return {
                'decision': 'post',
                'reason': 'match',
                'note': f'Price check: stored {stored_txt} matches the price at {where} ({store_txt}). MRP {mrp_txt}. Stock: {stock_txt}; stock does not block a post.',
            }
        if mrp is not None and _same(stored_price, mrp):
            return {
                'decision': 'post',
                'reason': 'match_mrp',
                'note': f'Price check: stored {stored_txt} matches the MRP ({mrp_txt}). Price at {where} {store_txt}. Stock: {stock_txt}; stock does not block a post.',
            }

    if store_price is None and mrp is None:
        return {
            'decision': 'block',
            'reason': 'nothing_to_compare',
            'note': f'Price check: stored {stored_txt}. No price to compare: {store_txt} and no MRP. Not posted.',
        }
    if stored_price is None:
        return {
            'decision': 'block',
            'reason': 'no_stored_price',
            'note': f'Price check: no stored price. Price at {where} {store_txt}; MRP {mrp_txt}. Not posted: the stored price matches neither.',
        }
    return {
        'decision': 'block',
        'reason': 'price_differs',
        'note': f'Price check: stored {stored_txt}, price at {where} {store_txt}, MRP {mrp_txt}. Not posted: the stored price matches neither.',
    }


def fetch_listing(sb, set_number: str | None, store: str | None) -> Listing | None:
    """The current store_prices row for this set and store, or None if there is none."""
    if not set_number or not store:
        return None
    res = (
        sb.table('store_prices')
        .select('price_inr, in_stock')
        .eq('set_id', str(set_number))
        .eq('store_id', store)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return None
    r = rows[0]
    price = r.get('price_inr')
    return Listing(price_inr=float(price) if price is not None else None, in_stock=bool(r.get('in_stock')))


def fetch_mrp(sb, set_number: str | None) -> float | None:
    """The set's MRP (sets.lego_mrp_inr), or None if the set or its MRP is missing.

    A read error is not caught here: the caller stops before posting (fail closed).
    """
    if not set_number:
        return None
    res = sb.table('sets').select('lego_mrp_inr').eq('set_number', str(set_number)).limit(1).execute()
    rows = res.data or []
    if not rows or rows[0].get('lego_mrp_inr') is None:
        return None
    return float(rows[0]['lego_mrp_inr'])


def check_row(sb, row: dict, mrp: float | None = None) -> dict:
    """Check one video_posts row against the store price and the MRP the caller passes in."""
    listing = fetch_listing(sb, row.get('set_number'), row.get('store'))
    stored = row.get('price_inr')
    verdict = evaluate(float(stored) if stored is not None else None, row.get('store'), listing, mrp)
    verdict['stored_price_inr'] = float(stored) if stored is not None else None
    verdict['current_price_inr'] = listing.price_inr if listing else None
    verdict['in_stock'] = listing.in_stock if listing else None
    verdict['mrp_inr'] = mrp
    return verdict


def hold(sb, row: dict, verdict: dict) -> None:
    """Set status publish_blocked and a plain note. Keeps any existing escalation_note."""
    prior = row.get('escalation_note')
    merged = dict(prior) if isinstance(prior, dict) else {}
    merged['price_check'] = {
        'note': verdict['note'],
        'reason': verdict['reason'],
        'stored_price_inr': verdict.get('stored_price_inr'),
        'current_price_inr': verdict.get('current_price_inr'),
        'mrp_inr': verdict.get('mrp_inr'),
        'in_stock': verdict.get('in_stock'),
        'checked_at': datetime.now(timezone.utc).isoformat(),
    }
    sb.table('video_posts').update({'status': 'publish_blocked', 'escalation_note': merged}).eq('id', row['id']).execute()
