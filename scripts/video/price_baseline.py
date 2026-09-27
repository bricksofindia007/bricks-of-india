"""
"Price N days ago" from price_history (#383, 27 Sep 2026). Stdlib only.

Since FP5.7 (migration 20260927135145) price_history is change-only: a row
means "from this time until the next row", and run_retention() compacts rows
older than 30 days to change points. The price at the window start is the
LATEST row at or before it -- not the oldest row inside the window, which is
the first CHANGE in the window (the already-dropped price, for a set that
dropped inside it). Fallback, for a listing first seen inside the window: its
oldest in-window row. Mirrors src/lib/price-baseline.ts.
"""

from __future__ import annotations


def pick_baselines(pre_window_desc: list[dict], in_window_asc: list[dict], key=lambda r: r["set_id"]) -> dict:
    """pre_window_desc: rows with recorded_at <= since, newest first.
    in_window_asc: rows with recorded_at > since, oldest first.
    Returns {key(row): float(price_inr)}."""
    out: dict = {}
    for rows in (pre_window_desc, in_window_asc):
        for r in rows:
            k = key(r)
            if k not in out and r.get("price_inr") is not None:
                out[k] = float(r["price_inr"])
    return out
