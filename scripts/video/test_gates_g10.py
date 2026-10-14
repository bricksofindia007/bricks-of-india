"""
Unit tests for VID-P4 gate G10 (#378): the coherence judge fails CLOSED.
No network: coherence_judge.judge_coherence is faked.

Run: cd scripts/video && python -m unittest test_gates_g10 -v
"""

from __future__ import annotations

import unittest
from unittest import mock

import coherence_judge
import gates


def _report(*results):
    r = gates.GateReport()
    r.results.extend(results)
    return r


class G10FailsClosed(unittest.TestCase):
    def _g10(self, judge_result):
        with mock.patch.object(coherence_judge, 'judge_coherence', return_value=judge_result):
            return gates.gate_coherence_llm_judge('A script.')

    def test_coherent_passes(self):
        r = self._g10({'pass': True, 'detail': 'COHERENT'})
        self.assertTrue(r.passed)
        self.assertFalse(r.held)

    def test_incoherent_fails_and_is_not_held(self):
        r = self._g10({'pass': False, 'detail': 'INCOHERENT: garbled ending'})
        self.assertFalse(r.passed)
        self.assertFalse(r.held)

    def test_judge_unavailable_is_held_not_passed(self):
        # The old gate returned pass=True here ("fail-open").
        r = self._g10({'pass': False, 'held': True, 'detail': 'HELD for manual review: no real coherence verdict'})
        self.assertFalse(r.passed)
        self.assertTrue(r.held)

    def test_missing_key_is_held_through_the_real_judge(self):
        with mock.patch.dict('os.environ', {'GROQ_API_KEY': ''}):
            r = gates.gate_coherence_llm_judge('A script.')
        self.assertFalse(r.passed)
        self.assertTrue(r.held)


class ReportHandling(unittest.TestCase):
    def test_held_only_goes_to_review_without_regeneration(self):
        rep = _report(gates.GateResult('G1_word_count', True),
                      gates.GateResult('G10_coherence', False, 'HELD', held=True))
        self.assertFalse(rep.all_passed)
        self.assertTrue(rep.only_held_failures)
        self.assertTrue(rep.passed_or_held)

    def test_a_real_failure_still_regenerates(self):
        rep = _report(gates.GateResult('G1_word_count', False, 'too long'),
                      gates.GateResult('G10_coherence', False, 'HELD', held=True))
        self.assertFalse(rep.passed_or_held)

    def test_stored_result_blocks_publish_until_a_person_overrides(self):
        import publish
        rep = _report(gates.GateResult('G10_coherence', False, 'HELD', held=True))
        stored = rep.as_dict()
        self.assertEqual(stored['G10_coherence'], {'pass': False, 'reason': 'HELD', 'held': True})
        with self.assertRaises(publish.GateFailureError):
            publish.assert_all_gates_passed({'gate_results': stored})
        publish.assert_all_gates_passed({'gate_results': stored, 'gate_override': True,
                                         'gate_override_reason': 'read it: coherent'})


if __name__ == '__main__':
    unittest.main()
