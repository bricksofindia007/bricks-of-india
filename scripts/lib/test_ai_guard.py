"""Tests for the Gemini safety limits (ai_guard.py). Run: python -m unittest scripts/lib/test_ai_guard.py

Uses a fake client: no request is ever sent.
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ai_guard as g  # noqa: E402


class FakeModels:
    def __init__(self, usage=(1000, 50), fail=False):
        self.calls = 0
        self.usage = usage
        self.fail = fail

    def generate_content(self, **kwargs):
        self.calls += 1
        if self.fail:
            raise RuntimeError('503 UNAVAILABLE')
        ins, outs = self.usage

        class Usage:
            prompt_token_count = ins
            candidates_token_count = outs

        class Resp:
            text = 'ok'
            usage_metadata = Usage()

        return Resp()


class FakeClient:
    def __init__(self, **kw):
        self.models = FakeModels(**kw)


SMALL = dict(system='You write short articles.', user='Write one article about a set.')


class ModelAllowlist(unittest.TestCase):
    def test_refuses_model_not_on_list_before_any_request(self):
        alerts = []
        budget = g.create_budget('generate-approved-drafts.ts', alert=lambda s, b: alerts.append(s))
        client = FakeClient()
        with self.assertRaises(g.AiLimitError):
            g.gemini_generate(client, site='draft', model='gemini-3.1-pro', budget=budget, **SMALL)
        self.assertEqual(client.models.calls, 0)
        self.assertEqual(len(alerts), 1)

    def test_refuses_any_pro_model(self):
        budget = g.create_budget('generate-approved-drafts.ts', alert=lambda s, b: None)
        with self.assertRaisesRegex(g.AiLimitError, 'allowlist'):
            g.gemini_generate(FakeClient(), site='draft', model='gemini-2.5-pro', budget=budget, **SMALL)


class PerCallSize(unittest.TestCase):
    def test_refuses_oversize_before_any_request(self):
        alerts = []
        budget = g.create_budget('generate-approved-drafts.ts', alert=lambda s, b: alerts.append(s))
        client = FakeClient()
        with self.assertRaisesRegex(g.AiLimitError, 'too large'):
            g.gemini_generate(client, site='draft', model='gemini-2.5-flash-lite', system='s', user='x' * 200_000, budget=budget)
        self.assertEqual(client.models.calls, 0)
        self.assertEqual(len(alerts), 1)

    def test_accepts_just_under_limit(self):
        budget = g.create_budget('generate-approved-drafts.ts', alert=lambda s, b: None)
        client = FakeClient()
        g.gemini_generate(client, site='draft', model='gemini-2.5-flash-lite', system='', user='x' * 14_000, budget=budget)
        self.assertEqual(client.models.calls, 1)


class PerRunCaps(unittest.TestCase):
    def test_call_cap_stops_and_alerts_once(self):
        alerts = []
        budget = g.create_budget('model_canary.py', alert=lambda s, b: alerts.append(s))  # 4 calls
        client = FakeClient(usage=(10, 1))
        for _ in range(4):
            g.gemini_generate(client, site='canary', model='gemini-2.5-flash', system='', user='hi', budget=budget)
        for _ in range(2):
            with self.assertRaisesRegex(g.AiLimitError, 'call cap'):
                g.gemini_generate(client, site='canary', model='gemini-2.5-flash', system='', user='hi', budget=budget)
        self.assertEqual(client.models.calls, 4)
        self.assertEqual(len(alerts), 1)

    def test_token_cap_stops_and_alerts(self):
        alerts = []
        budget = g.create_budget('model_canary.py', alert=lambda s, b: alerts.append(s))  # 4,000 input tokens
        client = FakeClient(usage=(4_000, 1))
        g.gemini_generate(client, site='canary', model='gemini-2.5-flash', system='', user='hi', budget=budget)
        with self.assertRaisesRegex(g.AiLimitError, 'input token cap'):
            g.gemini_generate(client, site='canary', model='gemini-2.5-flash', system='', user='hi', budget=budget)
        self.assertEqual(client.models.calls, 1)
        self.assertEqual(len(alerts), 1)

    def test_failed_request_still_counts(self):
        budget = g.create_budget('model_canary.py', alert=lambda s, b: None)
        client = FakeClient(fail=True)
        for _ in range(4):
            with self.assertRaisesRegex(RuntimeError, '503'):
                g.gemini_generate(client, site='canary', model='gemini-2.5-flash', system='', user='hi', budget=budget)
        with self.assertRaisesRegex(g.AiLimitError, 'call cap'):
            g.gemini_generate(client, site='canary', model='gemini-2.5-flash', system='', user='hi', budget=budget)
        self.assertEqual(budget['calls'], 4)


class NormalRun(unittest.TestCase):
    def test_normal_run_passes_and_counts_counts_only(self):
        alerts = []
        budget = g.create_budget('generate-approved-drafts.ts', alert=lambda s, b: alerts.append(s))
        client = FakeClient(usage=(500, 80))
        res = g.gemini_generate(client, site='draft', model='gemini-2.5-flash-lite', budget=budget, **SMALL)
        self.assertEqual(res['text'], 'ok')
        self.assertEqual(budget['calls'], 1)
        self.assertEqual(budget['inputTokens'], 500)
        self.assertEqual(budget['outputTokens'], 80)
        self.assertEqual(budget['models'], {'gemini-2.5-flash-lite': 1})
        self.assertEqual(alerts, [])

    def test_unlisted_script_gets_strict_default(self):
        budget = g.create_budget('some-new-script.py', alert=lambda s, b: None)
        self.assertEqual(budget['name'], 'default')
        self.assertEqual(budget['maxCalls'], 10)


if __name__ == '__main__':
    unittest.main()
