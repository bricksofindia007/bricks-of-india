"""Gemini model for the video pipelines: the call sites, the allowlist and the canary name the new model.

gemini-2.5-flash is deprecated and routes to gemini-3.5-flash-lite on 1 Dec 2026 (Google's model documentation).
The code names the replacement directly so the change does not depend on the redirect.
Run: python -m unittest test_model_swap -v   (from scripts/video)
"""

import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
NEW = "gemini-3.5-flash-lite"
OLD = "gemini-2.5-flash"


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


class ModelSwap(unittest.TestCase):
    def test_engine_video_call_uses_the_new_model(self):
        src = read("scripts/video/engine.py")
        self.assertIn(f'model="{NEW}"', src)
        self.assertNotIn(f'model="{OLD}"', src)

    def test_quiet_panic_call_uses_the_new_model(self):
        src = read("scripts/video/quiet_panic_script_gen.py")
        self.assertIn(f"model='{NEW}'", src)
        self.assertNotIn(f"model='{OLD}'", src)

    def test_allowlist_names_the_new_model(self):
        cfg = json.loads(read("config/ai-limits.json"))
        self.assertIn(NEW, cfg["allowedModels"])

    def test_canary_checks_the_new_model_for_the_video_pipelines(self):
        src = read("scripts/canary/model_canary.py")
        self.assertIn(f"'{NEW}')", src)
        self.assertNotIn(f"'{OLD}'", src)


if __name__ == "__main__":
    unittest.main()
