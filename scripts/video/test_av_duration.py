"""Audio and video length for the Quiet Panic assembly. Run: python -m unittest test_av_duration -v

Cases are the two failed runs: 5 Nov (reader 63.0 s, probed 63.53 s) and 7 Nov (reader 55.0 s, probed 55.8 s).
"""

import pathlib
import unittest

from av_duration import usable_av_duration


class UsableAvDuration(unittest.TestCase):
    def test_reader_shorter_than_probe_uses_reader(self):
        self.assertEqual(usable_av_duration(63.0, 63.53), 63.0)

    def test_second_failed_run_case(self):
        self.assertEqual(usable_av_duration(55.0, 55.8), 55.0)

    def test_reader_longer_than_probe_uses_probe(self):
        self.assertEqual(usable_av_duration(60.2, 59.9), 59.9)

    def test_missing_reader_duration_uses_probe(self):
        self.assertEqual(usable_av_duration(None, 42.0), 42.0)

    def test_non_positive_probe_is_refused(self):
        with self.assertRaises(ValueError):
            usable_av_duration(10.0, 0)

    def test_non_positive_reader_is_refused(self):
        with self.assertRaises(ValueError):
            usable_av_duration(0, 10.0)

    def test_assembly_uses_the_helper_and_not_the_probe_alone(self):
        src = (pathlib.Path(__file__).parent / "generate_quiet_panic_video.py").read_text(encoding="utf-8")
        self.assertIn("usable_av_duration(final_audio.duration, actual_audio_duration)", src)
        self.assertNotIn(".set_duration(actual_audio_duration)", src)


if __name__ == "__main__":
    unittest.main()
