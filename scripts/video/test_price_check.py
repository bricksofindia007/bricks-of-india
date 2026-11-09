"""Tests for price_check.py (P23, order 0960). Run: python -m unittest test_price_check -v"""

import unittest

import price_check
from price_check import Listing, evaluate, fetch_listing, fetch_mrp, check_row


class FakeQuery:
    FILTER_COLUMNS = ('set_id', 'store_id', 'set_number')

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
                   if all(str(r.get(k)) == str(v) for k, v in self.filters.items() if k in self.FILTER_COLUMNS)]
        return type('Res', (), {'data': matched})()


class FakeSb:
    def __init__(self, store_prices=None, sets=None):
        self.store_prices = store_prices or []
        self.sets = sets or []
        self.updates = []

    def table(self, name):
        if name == 'store_prices':
            return FakeQuery(self.store_prices)
        if name == 'sets':
            return FakeQuery(self.sets)
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
    # store price 1499 in stock, MRP 1599 unless a test says otherwise

    def test_store_price_matches_posts(self):
        v = evaluate(1499, 'mybrickhouse', Listing(1499, True), mrp=1599)
        self.assertEqual(v['decision'], 'post')
        self.assertEqual(v['reason'], 'match')

    def test_out_of_stock_with_matching_price_posts(self):
        v = evaluate(1499, 'toycra', Listing(1499, False), mrp=1599)
        self.assertEqual(v['decision'], 'post')
        self.assertIn('stock does not block a post', v['note'])

    def test_no_listing_but_mrp_match_posts(self):
        v = evaluate(1599, 'toycra', None, mrp=1599)
        self.assertEqual(v['decision'], 'post')
        self.assertEqual(v['reason'], 'match_mrp')

    def test_mismatch_with_both_holds_and_names_all_three_prices(self):
        v = evaluate(1200, 'mybrickhouse', Listing(1499, True), mrp=1599)
        self.assertEqual(v['decision'], 'block')
        self.assertEqual(v['reason'], 'price_differs')
        self.assertIn('₹1,200', v['note'])
        self.assertIn('₹1,499', v['note'])
        self.assertIn('₹1,599', v['note'])
        self.assertIn('LEGO.in', v['note'])

    def test_nothing_to_compare_holds(self):
        v = evaluate(1499, 'toycra', None, mrp=None)
        self.assertEqual(v['decision'], 'block')
        self.assertEqual(v['reason'], 'nothing_to_compare')
        self.assertIn('no MRP', v['note'])

    def test_listing_without_price_and_no_mrp_holds(self):
        v = evaluate(1499, 'toycra', Listing(None, True), mrp=None)
        self.assertEqual(v['decision'], 'block')
        self.assertEqual(v['reason'], 'nothing_to_compare')

    def test_listing_without_price_but_mrp_match_posts(self):
        v = evaluate(1599, 'toycra', Listing(None, True), mrp=1599)
        self.assertEqual(v['decision'], 'post')

    def test_sub_rupee_float_noise_still_matches_store(self):
        v = evaluate(1499, 'toycra', Listing(1499.2, True), mrp=None)
        self.assertEqual(v['decision'], 'post')

    def test_sub_rupee_float_noise_still_matches_mrp(self):
        v = evaluate(1599, 'toycra', Listing(1499, True), mrp=1599.4)
        self.assertEqual(v['decision'], 'post')

    def test_missing_stored_price_holds_when_something_is_comparable(self):
        v = evaluate(None, 'toycra', Listing(1499, True), mrp=1599)
        self.assertEqual(v['decision'], 'block')
        self.assertEqual(v['reason'], 'no_stored_price')

    def test_stock_never_blocks_at_any_store(self):
        for store in ('mybrickhouse', 'toycra', 'somewhere-else'):
            v = evaluate(1499, store, Listing(1499, False), mrp=None)
            self.assertEqual(v['decision'], 'post', store)


class FetchAndRowTests(unittest.TestCase):
    STORE_PRICES = [
        {'set_id': '76337', 'store_id': 'toycra', 'price_inr': 1599, 'in_stock': True},
        {'set_id': '75442', 'store_id': 'mybrickhouse', 'price_inr': 26999, 'in_stock': False},
    ]
    SETS = [
        {'set_number': '76337', 'lego_mrp_inr': 1599},
        {'set_number': '75442', 'lego_mrp_inr': None},
    ]

    def test_fetch_listing_returns_the_matching_row(self):
        sb = FakeSb(self.STORE_PRICES)
        self.assertEqual(fetch_listing(sb, '76337', 'toycra'), Listing(1599.0, True))

    def test_fetch_listing_missing_store_returns_none(self):
        sb = FakeSb(self.STORE_PRICES)
        self.assertIsNone(fetch_listing(sb, '76337', 'mybrickhouse'))

    def test_fetch_listing_without_set_number_returns_none(self):
        self.assertIsNone(fetch_listing(FakeSb(self.STORE_PRICES), None, 'toycra'))

    def test_fetch_mrp_returns_the_set_mrp(self):
        self.assertEqual(fetch_mrp(FakeSb(sets=self.SETS), '76337'), 1599.0)

    def test_fetch_mrp_none_when_the_set_has_no_mrp_or_is_unknown(self):
        sb = FakeSb(sets=self.SETS)
        self.assertIsNone(fetch_mrp(sb, '75442'))
        self.assertIsNone(fetch_mrp(sb, '99999'))
        self.assertIsNone(fetch_mrp(sb, None))

    def test_check_row_passes_the_mrp_through_and_posts_on_mrp_match(self):
        row = {'id': 'r1', 'set_number': '76337', 'store': 'mybrickhouse', 'price_inr': 1599}
        v = check_row(FakeSb(self.STORE_PRICES), row, mrp=1599.0)
        self.assertEqual(v['decision'], 'post')
        self.assertEqual(v['reason'], 'match_mrp')
        self.assertEqual(v['mrp_inr'], 1599.0)

    def test_check_row_end_to_end_mismatch_holds(self):
        row = {'id': 'r1', 'set_number': '76337', 'store': 'toycra', 'price_inr': 1499}
        v = check_row(FakeSb(self.STORE_PRICES), row, mrp=1599.0)
        self.assertEqual(v['decision'], 'block')
        self.assertEqual(v['stored_price_inr'], 1499.0)
        self.assertEqual(v['current_price_inr'], 1599.0)

    def test_check_row_without_mrp_argument_still_works(self):
        row = {'id': 'r1', 'set_number': '76337', 'store': 'toycra', 'price_inr': 1599}
        v = check_row(FakeSb(self.STORE_PRICES), row)
        self.assertEqual(v['decision'], 'post')
        self.assertIsNone(v['mrp_inr'])

    def test_hold_sets_only_status_and_note_and_keeps_prior_note(self):
        sb = FakeSb()
        row = {'id': 'r1', 'escalation_note': {'other': 'kept'}}
        verdict = {'note': 'Price check: x', 'reason': 'price_differs', 'stored_price_inr': 1.0,
                   'current_price_inr': 2.0, 'mrp_inr': 3.0, 'in_stock': True}
        price_check.hold(sb, row, verdict)
        col, val, payload = sb.updates[0]
        self.assertEqual((col, val), ('id', 'r1'))
        self.assertEqual(payload['status'], 'publish_blocked')
        self.assertEqual(set(payload), {'status', 'escalation_note'})
        self.assertEqual(payload['escalation_note']['other'], 'kept')
        self.assertEqual(payload['escalation_note']['price_check']['note'], 'Price check: x')
        self.assertEqual(payload['escalation_note']['price_check']['mrp_inr'], 3.0)


if __name__ == '__main__':
    unittest.main()
