"""
price_check.py -- pre-publish price check (P23).

Before a video is posted, its stored price must match the current price for
the same store, and the item must be in stock. Otherwise the row is held:
status 'publish_blocked' with a plain note giving both prices. Nothing is
deleted, and no field other than status and escalation_note is written.

Store matching: video_posts.store is the store id (for example 'mybrickhouse'),
the same value as store_prices.store_id. store_prices.set_id holds the set
number as text.
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


def evaluate(stored_price: float | None, store: str | None, listing: Listing | None) -> dict:
    """Pure decision. Returns {'decision': 'post'|'block', 'reason': str, 'note': str}.

    Blocks when there is no current listing for this store, when it has no
    price, when it is out of stock, or when the prices differ beyond the
    tolerance. The note always names both prices when both are known.
    """
    where = _store_name(store)
    stored_txt = _rupees(stored_price) if stored_price is not None else 'no stored price'

    if listing is None:
        return {
            'decision': 'block',
            'reason': 'no_listing',
            'note': f'Price check: stored {stored_txt} on {where}. No current listing for this set at this store. Not posted.',
        }
    if listing.price_inr is None:
        return {
            'decision': 'block',
            'reason': 'no_current_price',
            'note': f'Price check: stored {stored_txt} on {where}. The current listing has no price. Not posted.',
        }
    current_txt = _rupees(listing.price_inr)
    if not listing.in_stock:
        return {
            'decision': 'block',
            'reason': 'out_of_stock',
            'note': f'Price check: stored {stored_txt}, current {current_txt} on {where} (out of stock). Not posted: out of stock.',
        }
    if stored_price is None or abs(float(stored_price) - float(listing.price_inr)) > PRICE_TOLERANCE_INR:
        return {
            'decision': 'block',
            'reason': 'price_differs',
            'note': f'Price check: stored {stored_txt}, current {current_txt} on {where} (in stock). Not posted: prices differ.',
        }
    return {
        'decision': 'post',
        'reason': 'match',
        'note': f'Price check: stored {stored_txt} matches current {current_txt} on {where} (in stock).',
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


def check_row(sb, row: dict) -> dict:
    """Check one video_posts row against the current listing for its store."""
    listing = fetch_listing(sb, row.get('set_number'), row.get('store'))
    stored = row.get('price_inr')
    verdict = evaluate(float(stored) if stored is not None else None, row.get('store'), listing)
    verdict['stored_price_inr'] = float(stored) if stored is not None else None
    verdict['current_price_inr'] = listing.price_inr if listing else None
    verdict['in_stock'] = listing.in_stock if listing else None
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
        'in_stock': verdict.get('in_stock'),
        'checked_at': datetime.now(timezone.utc).isoformat(),
    }
    sb.table('video_posts').update({'status': 'publish_blocked', 'escalation_note': merged}).eq('id', row['id']).execute()
