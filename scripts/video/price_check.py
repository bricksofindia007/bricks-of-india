"""
Pre-publish price check for VID-P4 video_posts rows.

Before a video is posted, its stored price is compared with the current
in-stock price for the same store. If the price moved, the item is out of
stock, or the store has no current price for the set, the caller holds the
row (status publish_blocked) and records the reason. Nothing is deleted or
edited here.

store_prices.set_id holds the set number as text, so the lookup is by
str(set_number).
"""

from __future__ import annotations

# Prices are whole rupees in both tables; anything under half a rupee is equal.
PRICE_TOLERANCE_INR = 0.5


def blocked_reason(sb, video_post: dict) -> str | None:
    """
    Return None when the row may be posted, or a plain reason string when it
    must be held. Reads store_prices only; no writes.
    """
    store = video_post.get("store")
    set_number = video_post.get("set_number")
    stored_price = video_post.get("price_inr")

    if not store or set_number is None:
        return "no store or set number recorded on this video, so its price cannot be checked"
    if stored_price is None:
        return f"no stored price on this video (store {store}), so its price cannot be checked"

    res = (
        sb.table("store_prices")
        .select("price_inr, in_stock")
        .eq("store_id", store)
        .eq("set_id", str(set_number))
        .limit(1)
        .execute()
    )
    rows = res.data or []
    if not rows:
        return f"no current price for set {set_number} at {store}"

    current = rows[0]
    if current.get("in_stock") is not True:
        return f"out of stock at {store} (stored price Rs {float(stored_price):,.0f})"

    current_price = current.get("price_inr")
    if current_price is None:
        return f"no current price for set {set_number} at {store}"

    if abs(float(current_price) - float(stored_price)) >= PRICE_TOLERANCE_INR:
        return (
            f"price differs at {store}: stored Rs {float(stored_price):,.0f}, "
            f"current Rs {float(current_price):,.0f}"
        )
    return None
