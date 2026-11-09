"""The video pipelines' Google SDK is pinned to the version the 4 Nov 2026 run installed, and that accepted the call.

On 6 Nov the run installed the next major version (3.0.0) because the requirement had no version. Every Gemini call
then failed with a 400 on the API version, on all six attempts. The pin keeps the known-good version until a newer one
is tested. Run: python -m unittest test_requirements_pin -v   (from scripts/video)
"""

import pathlib
import re
import unittest

REQ = pathlib.Path(__file__).resolve().parent / "requirements.txt"


class SdkPin(unittest.TestCase):
    def test_google_genai_is_pinned_to_the_known_good_version(self):
        lines = [line.strip() for line in REQ.read_text(encoding="utf-8").splitlines()]
        genai = [line for line in lines if re.match(r"^google-genai\b", line)]
        self.assertEqual(genai, ["google-genai==3.0.0"])


if __name__ == "__main__":
    unittest.main()
