"""
Unit tests for article_coherence.py (Gate 14 article judge). No network.

Run: cd scripts/video && python -m unittest test_article_coherence -v
"""

from __future__ import annotations

import unittest

import article_coherence as ac


class BudgetTests(unittest.TestCase):
    def test_estimate_includes_prompt_and_output(self):
        self.assertGreater(ac.estimate_tokens(''), ac.MAX_OUTPUT_TOKENS)
        self.assertGreater(ac.estimate_tokens('x' * 3500), ac.estimate_tokens(''))

    def test_budget_stops_before_crossing(self):
        texts = ['x' * 3500] * 10
        each = ac.estimate_tokens(texts[0])
        self.assertEqual(ac.plan_batch(texts, each * 3), 3)
        self.assertEqual(ac.plan_batch(texts, each * 3 - 1), 2)
        self.assertEqual(ac.plan_batch(texts, 0), 0)

    def test_prompt_asks_for_the_judge_contract(self):
        self.assertIn("'COHERENT'", ac.ARTICLE_JUDGE_PROMPT)
        self.assertIn("'INCOHERENT:", ac.ARTICLE_JUDGE_PROMPT)


if __name__ == '__main__':
    unittest.main()
