"""Tests for token_scopes.evaluate (YouTube read-only login check). Run: python -m unittest test_token_scopes -v"""
import unittest

from token_scopes import ANALYTICS, FORCE_SSL, READ, UPLOAD, evaluate


class EvaluateTests(unittest.TestCase):
    def test_upload_and_read_only_passes_with_warnings(self):
        ok, missing, warnings = evaluate([UPLOAD, READ], 'Bricks of India', True)
        self.assertTrue(ok)
        self.assertEqual(missing, [])
        self.assertEqual(sorted(warnings), sorted([FORCE_SSL, ANALYTICS]))

    def test_all_scopes_passes_without_warnings(self):
        ok, missing, warnings = evaluate([UPLOAD, READ, FORCE_SSL, ANALYTICS], 'Bricks of India', True)
        self.assertTrue(ok)
        self.assertEqual(missing, [])
        self.assertEqual(warnings, [])

    def test_missing_upload_fails(self):
        ok, missing, _ = evaluate([READ], 'Bricks of India', True)
        self.assertFalse(ok)
        self.assertEqual(missing, [UPLOAD])

    def test_missing_read_fails(self):
        ok, missing, _ = evaluate([UPLOAD], 'Bricks of India', True)
        self.assertFalse(ok)
        self.assertEqual(missing, [READ])

    def test_wrong_channel_fails_even_with_scopes(self):
        ok, missing, _ = evaluate([UPLOAD, READ], 'Some Other Channel', True)
        self.assertFalse(ok)
        self.assertEqual(missing, [])

    def test_failed_request_fails(self):
        ok, _, _ = evaluate([UPLOAD, READ], 'Bricks of India', False)
        self.assertFalse(ok)

    def test_no_scopes_granted_fails_and_warns_on_optional(self):
        ok, missing, warnings = evaluate(None, 'Bricks of India', True)
        self.assertFalse(ok)
        self.assertEqual(sorted(missing), sorted([UPLOAD, READ]))
        self.assertEqual(sorted(warnings), sorted([FORCE_SSL, ANALYTICS]))


if __name__ == '__main__':
    unittest.main()
