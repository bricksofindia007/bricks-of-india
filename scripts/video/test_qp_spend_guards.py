"""Tests for the Quiet Panic fallback call guard and the voice-text character budget.

Run from scripts/video: python -m unittest test_qp_spend_guards -v

No request is sent: HTTP calls are replaced by fakes. No secret is read.
"""
import os
import re
import sys
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
# The G19 term list is read once, at import, from the repository secret. A placeholder keeps the tests runnable
# where the secret is absent (same setup as test_rework_literal.py).
os.environ.setdefault('G19_TERMS', '{"terms": {"test": ["zzqqxxyy"]}, "allow": []}')

import quiet_panic_script_gen as qpg  # noqa: E402
import ai_guard as g  # noqa: E402

OK_BODY = {
    'choices': [{'message': {'content': 'Verdict: buy it. Snow.'}}],
    'usage': {'prompt_tokens': 100, 'completion_tokens': 9},
}

# Voice-text lengths of the largest measured Quiet Panic runs in the 30 days to 7 Nov 2026 (characters per run).
# Source: the run logs of the voice segments. The largest is 113; one price line is cut at 50 characters in the
# log, so the bound used for the budget is 115.
MEASURED_RUN_CHARACTERS = [113, 113, 107, 104, 103, 103, 102, 99, 98, 98]


class FakeResponse:
    def __init__(self, status, body=None, headers=None):
        self.status_code = status
        self._body = body or {}
        self.headers = headers or {}

    def json(self):
        return self._body

    def raise_for_status(self):
        if self.status_code >= 400 and self.status_code != 429:
            raise RuntimeError(f'HTTP {self.status_code}')


def fresh_budget(max_calls=4, max_input_tokens=50000):
    return {'name': 'test', 'maxCalls': max_calls, 'maxInputTokens': max_input_tokens,
            'calls': 0, 'inputTokens': 0, 'outputTokens': 0, 'models': {}, 'alerted': False,
            'alert': mock.Mock()}


class GroqGuardTests(unittest.TestCase):
    def setUp(self):
        patcher = mock.patch.object(qpg, 'GROQ_API_KEY', 'test-key')
        patcher.start()
        self.addCleanup(patcher.stop)
        self.model = qpg.FEATURE_FLAGS.get('qp_groq_fallback_model', 'llama-3.3-70b-versatile')

    def test_fallback_model_is_on_the_allowlist(self):
        self.assertIn(self.model, g.CONFIG['allowedModels'])

    def test_successful_call_counts_once_against_the_run_budget(self):
        b = fresh_budget()
        with mock.patch.object(qpg, 'run_budget', return_value=b), \
                mock.patch.object(qpg.requests, 'post', return_value=FakeResponse(200, OK_BODY)) as post:
            result = qpg._call_groq('system text', 'task text')
        self.assertEqual(result.provider, 'groq')
        self.assertEqual(result.text, 'Verdict: buy it. Snow.')
        self.assertEqual(post.call_count, 1)
        self.assertEqual(b['calls'], 1)
        self.assertEqual(b['models'], {self.model: 1})

    def test_refused_before_any_request_when_the_call_cap_is_reached(self):
        b = fresh_budget(max_calls=1)
        b['calls'] = 1
        with mock.patch.object(qpg, 'run_budget', return_value=b), \
                mock.patch.object(qpg.requests, 'post') as post:
            with self.assertRaises(g.AiLimitError):
                qpg._call_groq('system text', 'task text')
        post.assert_not_called()

    def test_rate_limit_retry_counts_each_attempt(self):
        b = fresh_budget()
        responses = [FakeResponse(429, headers={'Retry-After': '0'}), FakeResponse(200, OK_BODY)]
        with mock.patch.object(qpg, 'run_budget', return_value=b), \
                mock.patch.object(qpg.requests, 'post', side_effect=responses), \
                mock.patch.object(qpg.time, 'sleep'):
            result = qpg._call_groq('system text', 'task text')
        self.assertEqual(result.text, 'Verdict: buy it. Snow.')
        self.assertEqual(b['calls'], 2)

    def test_two_rate_limits_fail_and_both_attempts_count(self):
        b = fresh_budget()
        responses = [FakeResponse(429, headers={'Retry-After': '0'}), FakeResponse(429, headers={'Retry-After': '0'})]
        with mock.patch.object(qpg, 'run_budget', return_value=b), \
                mock.patch.object(qpg.requests, 'post', side_effect=responses), \
                mock.patch.object(qpg.time, 'sleep'):
            with self.assertRaises(RuntimeError):
                qpg._call_groq('system text', 'task text')
        self.assertEqual(b['calls'], 2)

    def test_fallback_does_not_swallow_a_guard_refusal(self):
        src = (HERE / 'quiet_panic_script_gen.py').read_text(encoding='utf-8')
        self.assertRegex(
            src,
            r"call_result = _call_groq\(trimmed_system_prompt, task_prompt\)\n\s+except AiLimitError:\n\s+raise"
            r"[^\n]*\n\s+except Exception as e:\n\s+print\(f'WARN: Groq script-gen failed",
        )


class CharacterBudgetTests(unittest.TestCase):
    def test_configured_limit_covers_the_largest_measured_run(self):
        b = g.char_budget('generate_quiet_panic_video.py')
        self.assertEqual(b['maxCharacters'], 115)
        self.assertGreaterEqual(b['maxCharacters'], max(MEASURED_RUN_CHARACTERS))

    def test_text_within_budget_is_counted(self):
        b = {'name': 't', 'maxCharacters': 10, 'characters': 0, 'alerted': False, 'alert': mock.Mock()}
        self.assertEqual(g.charge_characters(b, 'abcd'), 4)
        self.assertEqual(b['characters'], 4)

    def test_over_budget_is_refused_alerted_once_and_not_counted(self):
        alert = mock.Mock()
        b = {'name': 't', 'maxCharacters': 10, 'characters': 0, 'alerted': False, 'alert': alert}
        g.charge_characters(b, 'abcdef')
        with self.assertRaises(g.AiLimitError):
            g.charge_characters(b, 'ghijkl')
        with self.assertRaises(g.AiLimitError):
            g.charge_characters(b, 'xxxxx')  # 5 more: over the 4 characters left
        self.assertEqual(alert.call_count, 1)
        self.assertEqual(b['characters'], 6)

    def test_a_run_with_no_configured_budget_is_refused(self):
        b = g.char_budget('no-such-run-for-test.py')
        self.assertEqual(b['maxCharacters'], 0)
        with self.assertRaises(g.AiLimitError):
            g.charge_characters(b, 'a')

    def test_renderer_charges_the_run_before_any_text_is_sent(self):
        src = (HERE / 'generate_quiet_panic_video.py').read_text(encoding='utf-8')
        charge = src.index("charge_characters(char_budget('generate_quiet_panic_video.py')")
        self.assertLess(charge, src.index('segment_audio_paths = []'))
        self.assertLess(src.index('segment_audio_paths = []'), src.index('render_segment_tts(client, seg'))


if __name__ == '__main__':
    unittest.main()
