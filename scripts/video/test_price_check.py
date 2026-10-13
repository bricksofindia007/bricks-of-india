"""
Unit tests for price_check.py. No network, no DB: an in-memory fake client
implements just the query-builder calls price_check.py uses.

Run: cd scripts/video && python -m unittest test_price_check -v
"""

from __future__ import annotations

import unittest

import price_check


class _Res:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, rows):
        self._rows = rows
        self._filters = {}

    def select(self, _cols):
        return self

    def eq(self, col, val):
        self._filters[col] = val
        return self

    def limit(self, _n):
        return self

    def execute(self):
        out = [r for r in self._rows if all(r.get(c) == v for c, v in self._filters.items())]
        return _Res(out)


class _Sb:
    """Fake client holding store_prices rows only. Any other table is a test bug."""

    def __init__(self, store_prices):
        self._store_prices = store_prices

    def table(self, name):
        assert name == "store_prices", f"unexpected table read: {name}"
        return _Query(self._store_prices)


def _post(**overrides):
    row = {"store": "toycra", "set_number": "10307", "price_inr": 65999.0}
    row.update(overrides)
    return row


def _store_row(set_id="10307", store_id="toycra", price=65999.0, in_stock=True):
    return {"set_id": set_id, "store_id": store_id, "price_inr": price, "in_stock": in_stock}


class PriceCheckTests(unittest.TestCase):

    def test_price_matches_allows_post(self):
        sb = _Sb([_store_row(price=65999.0)])
        self.assertIsNone(price_check.blocked_reason(sb, _post()))

    def test_price_differs_blocks_with_both_prices(self):
        sb = _Sb([_store_row(price=69999.0)])
        reason = price_check.blocked_reason(sb, _post())
        self.assertIsNotNone(reason)
        self.assertIn("65,999", reason)
        self.assertIn("69,999", reason)
        self.assertIn("price differs", reason)

    def test_price_within_half_rupee_is_a_match(self):
        sb = _Sb([_store_row(price=65999.4)])
        self.assertIsNone(price_check.blocked_reason(sb, _post()))

    def test_out_of_stock_blocks(self):
        sb = _Sb([_store_row(in_stock=False)])
        reason = price_check.blocked_reason(sb, _post())
        self.assertIsNotNone(reason)
        self.assertIn("out of stock", reason)

    def test_in_stock_unknown_counts_as_out_of_stock(self):
        sb = _Sb([_store_row(in_stock=None)])
        self.assertIn("out of stock", price_check.blocked_reason(sb, _post()))

    def test_store_missing_blocks(self):
        sb = _Sb([])
        reason = price_check.blocked_reason(sb, _post())
        self.assertIsNotNone(reason)
        self.assertIn("no current price for set 10307 at toycra", reason)

    def test_other_store_only_counts_as_missing(self):
        sb = _Sb([_store_row(store_id="mybrickhouse")])
        self.assertIn("no current price", price_check.blocked_reason(sb, _post()))

    def test_set_number_given_as_int_is_matched_as_text(self):
        sb = _Sb([_store_row(set_id="10307")])
        self.assertIsNone(price_check.blocked_reason(sb, _post(set_number=10307)))

    def test_no_store_recorded_blocks(self):
        sb = _Sb([_store_row()])
        self.assertIn("no store or set number", price_check.blocked_reason(sb, _post(store=None)))

    def test_no_stored_price_blocks(self):
        sb = _Sb([_store_row()])
        self.assertIn("no stored price", price_check.blocked_reason(sb, _post(price_inr=None)))


if __name__ == "__main__":
    unittest.main()
