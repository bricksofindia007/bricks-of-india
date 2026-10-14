"""
Unit tests for price_baseline.py (#383). Run:
cd scripts/video && python -m unittest test_price_baseline -v
"""

import unittest

from price_baseline import pick_baselines


def row(set_id, price, recorded_at):
    return {"set_id": set_id, "price_inr": price, "recorded_at": recorded_at}


class BaselineTests(unittest.TestCase):
    def test_only_pre_window_row_older_than_30_days_and_drop_inside_window(self):
        # change-only history: 64,999 first seen 45 days ago, dropped to 54,999 10 days ago.
        pre = [row("10294", 64999, "d-45")]
        in_win = [row("10294", 54999, "d-10")]
        self.assertEqual(pick_baselines(pre, in_win)["10294"], 64999.0)
        # the old rule (oldest row inside the window) would have returned 54,999 -> no drop found

    def test_latest_pre_window_row_wins(self):
        self.assertEqual(pick_baselines([row("a", 600, "d-35"), row("a", 700, "d-90")], [])["a"], 600.0)

    def test_first_seen_inside_window_falls_back_to_oldest_in_window(self):
        self.assertEqual(pick_baselines([], [row("b", 500, "d-20"), row("b", 450, "d-5")])["b"], 500.0)

    def test_null_prices_skipped(self):
        self.assertEqual(pick_baselines([row("c", None, "d-31"), row("c", 300, "d-40")], [])["c"], 300.0)


if __name__ == "__main__":
    unittest.main()
