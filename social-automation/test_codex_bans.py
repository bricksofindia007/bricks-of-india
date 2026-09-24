"""
Issue #181 tests -- the Voice Codex ban list is parsed from
docs/codex/BOI_Codex_v2.md PAGE 17 (not a hand copy), and a banned-phrase
hit regenerates the caption (max 2 retries) instead of failing the run.
No network: generate_caption is stubbed for the pipeline-loop tests.

Run: cd social-automation && python -m unittest test_codex_bans -v
"""

import unittest
from unittest import mock

import caption_writer

# The hand-copied tuple that lived in caption_writer.py before #181. The
# parser must reproduce it exactly from the codex text, so moving to
# codex-sourced parsing changes nothing about what gets blocked today.
PRE_181_LIST = (
    'LEGO has announced', 'In a surprise move', 'Have you ever wondered',
    "Today we're looking at", 'Stunning', 'breathtaking', 'must-have',
    'does not disappoint', 'welcome addition to any collection',
    'Definitely worth considering', 'Great value for money',
    'As you may know', "I'm not an expert", 'Just my opinion',
)


class CodexParsing(unittest.TestCase):
    def test_parsed_list_equals_pre_181_list(self):
        self.assertEqual(caption_writer.OFFVOICE_PHRASES, PRE_181_LIST)

    def test_new_codex_entry_is_picked_up_without_code_change(self):
        codex = caption_writer._load_codex().replace(
            '“Just my opinion” — every BOI take is opinion; never apologise',
            '“Just my opinion” — every BOI take is opinion; never apologise\n\n“Jaw-dropping” — test entry',
        )
        self.assertIn('Jaw-dropping', caption_writer.parse_banned_phrases(codex))

    def test_structural_section_not_parsed(self):
        # "Banned Structural Patterns" has no quoted literals and is behavioural.
        self.assertNotIn('Star ratings', ' '.join(caption_writer.OFFVOICE_PHRASES))

    def test_missing_page17_raises(self):
        with self.assertRaises(RuntimeError):
            caption_writer.parse_banned_phrases('# PAGE 16: nothing here')

    def test_detects_stunning_case_insensitive(self):
        self.assertEqual(caption_writer.find_offvoice_phrases('A stunning supercar.'), ['Stunning'])


class RegenerateLoop(unittest.TestCase):
    """Drives pipeline.main() only as far as the caption gate, with every
    earlier step stubbed, to prove the loop's behaviour without posting."""

    def _run(self, captions):
        import pipeline
        calls = []

        def fake_generate(set_data, banned_feedback=None):
            calls.append(banned_feedback)
            return captions[len(calls) - 1]

        set_data = {'set_num': '42172-1', 'name': 'McLaren P1', 'gallery_images': [1] * 12}
        stop = RuntimeError('STOP-after-caption-gate')
        with mock.patch.object(pipeline, '_find_candidate_tiered', return_value=(set_data, '2020-2025')), \
             mock.patch.object(pipeline.media_processor, 'process_carousel_images', return_value=['a'] * 10), \
             mock.patch.object(pipeline.media_processor, 'process_reels_video', return_value='r'), \
             mock.patch.object(pipeline.media_processor, 'process_shorts_video', return_value='s'), \
             mock.patch.object(pipeline.db, 'upload_many_to_storage', return_value=['u'] * 10), \
             mock.patch.object(pipeline.db, 'upload_to_storage', return_value='u'), \
             mock.patch.object(pipeline.caption_writer, 'generate_caption', side_effect=fake_generate), \
             mock.patch.object(pipeline.caption_writer, 'find_length_violation', return_value=[]), \
             mock.patch.object(pipeline.caption_writer, 'find_invented_structure', side_effect=stop):
            with self.assertRaises(RuntimeError) as ctx:
                pipeline.main()
        return calls, str(ctx.exception)

    def test_banned_then_clean_regenerates_once_and_proceeds(self):
        calls, err = self._run(['A stunning car.', 'A car your wallet fears.'])
        self.assertEqual(calls, [None, ['Stunning']])
        self.assertEqual(err, 'STOP-after-caption-gate')  # got past the ban gate

    def test_raises_only_after_two_retries(self):
        calls, err = self._run(['Stunning.', 'Still stunning.', 'Breathtaking and stunning.'])
        self.assertEqual(len(calls), 3)  # 1 original + 2 retries, no more
        self.assertIn('Voice Codex', err)

    def test_clean_first_draft_never_regenerates(self):
        calls, _ = self._run(['A car your wallet fears.'])
        self.assertEqual(calls, [None])


if __name__ == '__main__':
    unittest.main()
