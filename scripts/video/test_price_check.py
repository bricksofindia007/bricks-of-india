"""Tests for price_check.py (P23). Run: python -m unittest test_price_check -v"""

import unittest

import price_check
from price_check import Listing, evaluate, fetch_listing, check_row


class FakeQuery:
    def __init__(self, rows):
        self._rows = rows
        self.filters = {}

    def select(self, *_a, **_k):
        return self

    def eq(self, col, val):
        self.filters[col] = val
        return self

    def limit(self, _n):
        return self

    def execute(self):
        matched = [r for r in self._rows
                   if all(str(r.get(k)) == str(v) for k, v in self.filters.items() if k in ('set_id', 'store_id'))]
        return type('Res', (), {'data': matched})()


class FakeSb:
    def __init__(self, store_prices=None):
        self.store_prices = store_prices or []
        self.updates = []

    def table(self, name):
        if name == 'store_prices':
            return FakeQuery(self.store_prices)
        if name == 'video_posts':
            sb = self

            class Upd:
                def update(self_inner, payload):
                    self_inner.payload = payload
                    return self_inner

                def eq(self_inner, col, val):
                    sb.updates.append((col, val, self_inner.payload))
                    return type('R', (), {'execute': lambda s: None})()
            return Upd()
        raise AssertionError(name)


class EvaluateTests(unittest.TestCase):
    def test_price_matches_posts(self):
        v = evaluate(1499, 'mybrickhouse', Listing(1499, True))
        self.assertEqual(v['decision'], 'post')
        self.assertEqual(v['reason'], 'match')

    def test_price_differs_blocks_and_names_both_prices(self):
        v = evaluate(1499, 'mybrickhouse', Listing(1599, True))
        self.assertEqual(v['decision'], 'block')
        self.assertEqual(v['reason'], 'price_differs')
        self.assertIn('₹1,499', v['note'])
        self.assertIn('₹1,599', v['note'])
        self.assertIn('LEGO.in', v['note'])

    def test_sub_rupee_float_noise_still_matches(self):
        v = evaluate(1499, 'toycra', Listing(1499.2, True))
        self.assertEqual(v['decision'], 'post')

    def test_out_of_stock_blocks_even_when_price_matches(self):
        v = evaluate(1499, 'toycra', Listing(1499, False))
        self.assertEqual(v['decision'], 'block')
        self.assertEqual(v['reason'], 'out_of_stock')
        self.assertIn('out of stock', v['note'])
        self.assertIn('₹1,499', v['note'])

    def test_store_missing_blocks(self):
        v = evaluate(1499, 'toycra', None)
        self.assertEqual(v['decision'], 'block')
        self.assertEqual(v['reason'], 'no_listing')
        self.assertIn('No current listing', v['note'])
        self.assertIn('Toycra', v['note'])

    def test_listing_without_price_blocks(self):
        v = evaluate(1499, 'toycra', Listing(None, True))
        self.assertEqual(v['decision'], 'block')
        self.assertEqual(v['reason'], 'no_current_price')


class FetchAndRowTests(unittest.TestCase):
    STORE_PRICES = [
        {'set_id': '76337', 'store_id': 'toycra', 'price_inr': 1599, 'in_stock': True},
        {'set_id': '75442', 'store_id': 'mybrickhouse', 'price_inr': 26999, 'in_stock': False},
    ]

    def test_fetch_listing_returns_the_matching_row(self):
        sb = FakeSb(self.STORE_PRICES)
        self.assertEqual(fetch_listing(sb, '76337', 'toycra'), Listing(1599.0, True))

    def test_fetch_listing_missing_store_returns_none(self):
        sb = FakeSb(self.STORE_PRICES)
        self.assertIsNone(fetch_listing(sb, '76337', 'mybrickhouse'))

    def test_fetch_listing_without_set_number_returns_none(self):
        self.assertIsNone(fetch_listing(FakeSb(self.STORE_PRICES), None, 'toycra'))

    def test_check_row_end_to_end_price_differs(self):
        row = {'id': 'r1', 'set_number': '76337', 'store': 'toycra', 'price_inr': 1499}
        v = check_row(FakeSb(self.STORE_PRICES), row)
        self.assertEqual(v['decision'], 'block')
        self.assertEqual(v['stored_price_inr'], 1499.0)
        self.assertEqual(v['current_price_inr'], 1599.0)

    def test_hold_sets_only_status_and_note_and_keeps_prior_note(self):
        sb = FakeSb()
        row = {'id': 'r1', 'escalation_note': {'other': 'kept'}}
        verdict = {'note': 'Price check: x', 'reason': 'price_differs', 'stored_price_inr': 1.0,
                   'current_price_inr': 2.0, 'in_stock': True}
        price_check.hold(sb, row, verdict)
        col, val, payload = sb.updates[0]
        self.assertEqual((col, val), ('id', 'r1'))
        self.assertEqual(payload['status'], 'publish_blocked')
        self.assertEqual(set(payload), {'status', 'escalation_note'})
        self.assertEqual(payload['escalation_note']['other'], 'kept')
        self.assertEqual(payload['escalation_note']['price_check']['note'], 'Price check: x')


if __name__ == '__main__':
    unittest.main()
