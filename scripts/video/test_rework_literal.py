"""Tests for the literal rework mode (order 0400 item 3). Run: python -m unittest scripts/video/test_rework_literal.py"""
import os
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# The G19 term list is read once, at import, from the repository secret. A placeholder keeps the tests runnable
# where the secret is absent; with the secret present, the real list is used.
os.environ.setdefault('G19_TERMS', '{"terms": {"test": ["zzqqxxyy"]}, "allow": []}')

import quiet_panic_script_gen as qpg  # noqa: E402
import rework_literal as rl  # noqa: E402

SEGMENTS_FILE = Path(__file__).resolve().parent / 'rework-literal' / 'row-660c4b8f-segments.json'
PRICE_INR = 1349  # row 45's price ("one thousand three hundred forty nine rupees", 7 words)
OWNER_VERDICT = 'Verdict: buy it. Naked trees look sad.'  # 7 words; the owner's line (the row's rejection reason)


def voice_words(segments):
    return sum(len(s['text'].split()) for s in segments if s.get('voice', True))


class OriginalSegmentsTest(unittest.TestCase):
    def test_file_has_eight_segments_and_sixteen_voice_words(self):
        segments = rl.load_segments(SEGMENTS_FILE)
        self.assertEqual(len(segments), 8)
        self.assertEqual(voice_words(segments), 16)

    def test_original_passes_the_default_cap(self):
        segments = rl.load_segments(SEGMENTS_FILE)
        budget = rl.check_literal_budget(segments, PRICE_INR)  # default extra = 0
        self.assertTrue(budget['pass'])
        self.assertEqual(budget['total_words'], 16)

    def test_load_refuses_a_file_without_segments(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'empty.json'
            p.write_text('{"segments": []}', encoding='utf-8')
            with self.assertRaises(ValueError):
                rl.load_segments(p)


class VerdictReplacementTest(unittest.TestCase):
    def setUp(self):
        self.original = rl.load_segments(SEGMENTS_FILE)

    def test_only_the_verdict_text_changes(self):
        new = rl.replace_verdict(self.original, OWNER_VERDICT)
        self.assertEqual(len(new), len(self.original))
        for i, (old, cur) in enumerate(zip(self.original, new)):
            if i == 7:
                self.assertEqual(cur['text'], OWNER_VERDICT)
                self.assertEqual(cur.get('voice'), old.get('voice'))
            else:
                self.assertEqual(cur, old, f'segment {i} must be unchanged')

    def test_sound_tags_and_voice_flags_are_kept(self):
        new = rl.replace_verdict(self.original, OWNER_VERDICT)
        self.assertEqual([s.get('sfx_tag') for s in new], [s.get('sfx_tag') for s in self.original])
        self.assertEqual([s.get('voice') for s in new], [s.get('voice') for s in self.original])

    def test_the_original_list_is_not_modified(self):
        before = [dict(s) for s in self.original]
        rl.replace_verdict(self.original, OWNER_VERDICT)
        self.assertEqual(self.original, before)

    def test_refuses_text_that_is_not_a_verdict(self):
        with self.assertRaises(ValueError):
            rl.replace_verdict(self.original, 'Naked trees look sad.')

    def test_refuses_when_there_is_no_single_verdict_segment(self):
        no_verdict = [dict(s, text='Snow.') if i == 7 else s for i, s in enumerate(self.original)]
        with self.assertRaises(ValueError):
            rl.replace_verdict(no_verdict, OWNER_VERDICT)
        two = [dict(s) for s in self.original]
        two[0]['text'] = 'Verdict: maybe.'
        with self.assertRaises(ValueError):
            rl.replace_verdict(two, OWNER_VERDICT)


class WordCapTest(unittest.TestCase):
    def setUp(self):
        self.original = rl.load_segments(SEGMENTS_FILE)
        self.with_owner = rl.replace_verdict(self.original, OWNER_VERDICT)

    def test_owner_verdict_makes_nineteen_words(self):
        self.assertEqual(voice_words(self.with_owner), 19)

    def test_default_extra_leaves_the_cap_at_sixteen(self):
        with self.assertRaises(qpg.WordBudgetExceededError) as cm:
            rl.check_literal_budget(self.with_owner, PRICE_INR)
        self.assertIn('16-word cap', str(cm.exception))

    def test_extra_three_allows_exactly_nineteen(self):
        budget = rl.check_literal_budget(self.with_owner, PRICE_INR, extra_total_words=3)
        self.assertTrue(budget['pass'])
        self.assertEqual(budget['total_words'], 19)

    def test_extra_three_still_refuses_twenty(self):
        too_long = rl.replace_verdict(self.original, 'Verdict: buy it. Naked trees look sad and cold.')
        with self.assertRaises(qpg.WordBudgetExceededError):
            rl.check_literal_budget(too_long, PRICE_INR, extra_total_words=3)

    def test_extra_is_bounded(self):
        for bad in (-1, 4, True, 1.5):
            with self.assertRaises(ValueError):
                qpg.check_word_budget(self.original, PRICE_INR, extra_total_words=bad)

    def test_check_word_budget_default_is_unchanged(self):
        budget = qpg.check_word_budget(self.original, PRICE_INR)
        self.assertEqual(budget['effective_total_cap'], 16)


class NoModelCallTest(unittest.TestCase):
    def test_literal_path_makes_no_script_generation_call(self):
        original = rl.load_segments(SEGMENTS_FILE)
        boom = mock.Mock(side_effect=AssertionError('a model call was made'))
        with mock.patch.object(qpg, 'generate_quiet_panic_script', boom), \
             mock.patch.object(qpg, 'gemini_generate', boom), \
             mock.patch.object(qpg, '_call_cerebras', boom):
            new = rl.replace_verdict(original, OWNER_VERDICT)
            rl.check_literal_budget(new, PRICE_INR, extra_total_words=3)
        boom.assert_not_called()


class DefaultsTest(unittest.TestCase):
    def test_rework_default_extra_is_zero(self):
        import rework_quiet_panic as rq
        self.assertEqual(rq.LITERAL_DEFAULT_EXTRA_WORDS, 0)


class ExplicitVerdictTest(unittest.TestCase):
    """The verdict comes only from the explicit input. The row's rejection reason is an instruction, never the verdict."""

    # A rejection-reason sentence of the kind row 45 carries: an instruction to the reworker, not the verdict line.
    REJECTION_REASON = 'Rework the verdict line only. Change the last line from Snow to Naked trees look sad.'

    def setUp(self):
        self.original = rl.load_segments(SEGMENTS_FILE)

    def test_the_rejection_reason_is_refused_as_the_verdict(self):
        with self.assertRaises(ValueError):
            rl.replace_verdict(self.original, self.REJECTION_REASON)

    def test_an_empty_verdict_is_refused(self):
        with self.assertRaises(ValueError):
            rl.replace_verdict(self.original, '')
        with self.assertRaises(ValueError):
            rl.replace_verdict(self.original, '   ')

    def test_the_rework_entry_point_refuses_an_empty_or_non_verdict_text_before_any_database_call(self):
        import rework_quiet_panic as rq
        db = mock.Mock(side_effect=AssertionError('the database was called'))
        for bad in ('', '   ', self.REJECTION_REASON):
            self.assertEqual(rq.rework_literal_by_id(db, 'row', str(SEGMENTS_FILE), bad, 3), 1)
        db.assert_not_called()

    def test_the_owner_line_gives_nineteen_and_passes_only_with_extra_three(self):
        owner = 'Verdict: buy it. Naked trees look sad.'
        new = rl.replace_verdict(self.original, owner)
        self.assertEqual(voice_words(new), 19)
        with self.assertRaises(qpg.WordBudgetExceededError):
            rl.check_literal_budget(new, PRICE_INR)
        self.assertTrue(rl.check_literal_budget(new, PRICE_INR, extra_total_words=3)['pass'])

    def test_the_cli_verdict_defaults_to_empty(self):
        import rework_quiet_panic as rq
        import argparse
        self.assertTrue(callable(rq.main))
        self.assertEqual(rq.LITERAL_DEFAULT_EXTRA_WORDS, 0)


if __name__ == '__main__':
    unittest.main()
