"""
G6 (2 Oct 2026): social posts state only our live Indian price, or none.
No network: the Supabase client is faked.

Run: cd social-automation && python -m unittest test_indian_price -v
"""

import unittest
from unittest import mock

import caption_writer
import db


class PriceViolations(unittest.TestCase):
    def test_our_indian_price_passes(self):
        self.assertEqual(caption_writer.price_violations('The McLaren P1 is ₹41,199 at LEGO.in.', 41199), [])

    def test_converted_us_price_fails(self):
        # 42172 posts said Rs 51,029 (USD x markup); the Indian MRP is Rs 41,199.
        issues = caption_writer.price_violations('₹51,029. That is the price of the McLaren P1.', 41199)
        self.assertEqual(len(issues), 1)

    def test_dollar_and_conversion_wording_fail(self):
        issues = caption_writer.price_violations('$349.99 converts to ₹39,689.', 39999)
        self.assertGreaterEqual(len(issues), 3)  # $, converts, and the wrong rupee figure

    def test_no_indian_price_means_no_rupee_figure(self):
        self.assertEqual(len(caption_writer.price_violations('A great set at ₹34,019.', None)), 1)
        self.assertEqual(caption_writer.price_violations('A great set. No price yet.', None), [])


class _Q:
    def __init__(self, rows): self.rows = rows
    def select(self, *_a): return self
    def eq(self, k, v): self.rows = [r for r in self.rows if r.get(k) == v]; return self
    def limit(self, _n): return self
    def execute(self): return mock.Mock(data=self.rows)


class _Client:
    def __init__(self, tables): self.tables = tables
    def table(self, name): return _Q(list(self.tables.get(name, [])))


STORES = [{'id': 'mybrickhouse', 'name': 'LEGO.in', 'display_enabled': True},
          {'id': 'toycra', 'name': 'Toycra', 'display_enabled': True}]


class IndianPriceInfo(unittest.TestCase):
    def _info(self, tables, set_num):
        with mock.patch.object(db, '_client', return_value=_Client(tables)):
            return db.get_india_price_info(set_num)

    def test_best_in_stock_price_wins(self):
        info = self._info({'stores': STORES, 'store_prices': [
            {'set_id': '42172', 'store_id': 'mybrickhouse', 'price_inr': 41199, 'in_stock': True},
            {'set_id': '42172', 'store_id': 'toycra', 'price_inr': 29399, 'in_stock': True}]}, '42172-1')
        self.assertEqual(info, {'inr': 29399, 'label': 'at Toycra', 'text': '₹29,399'})

    def test_out_of_stock_falls_back_to_store_mrp(self):
        info = self._info({'stores': STORES,
                           'store_prices': [{'set_id': '76178', 'store_id': 'toycra', 'price_inr': 39999, 'in_stock': False}],
                           'set_price_summary': [{'set_id': '76178', 'anchor_mrp_inr': 39999, 'anchor_source': 'mybrickhouse'}]}, '76178-1')
        self.assertEqual(info, {'inr': 39999, 'label': 'LEGO.in MRP', 'text': '₹39,999'})

    def test_no_indian_data_means_no_price(self):
        self.assertIsNone(self._info({'stores': STORES}, '21330-1'))


if __name__ == '__main__':
    unittest.main()
