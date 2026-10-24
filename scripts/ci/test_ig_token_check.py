"""Run with: cd scripts/ci && python -m unittest test_ig_token_check -v"""
import datetime as dt
import inspect
import os
import subprocess
import unittest
from unittest import mock

import ig_token_check as itc

NOW = dt.datetime(2026, 10, 15, 12, 0, tzinfo=dt.timezone.utc)


def valid_for(days):
    return {"is_valid": True, "expires_at": int((NOW + dt.timedelta(days=days)).timestamp())}


class Days(unittest.TestCase):
    def test_days_from_expiry(self):
        self.assertAlmostEqual(itc.days_left(valid_for(40), NOW), 40, places=3)

    def test_not_valid_is_none(self):
        self.assertIsNone(itc.days_left({"is_valid": False}, NOW))

    def test_zero_expiry_never_expires(self):
        self.assertEqual(itc.days_left({"is_valid": True, "expires_at": 0}, NOW), float("inf"))

    def test_failure_threshold(self):
        self.assertTrue(itc.is_failure(None))
        self.assertTrue(itc.is_failure(9.9))
        self.assertFalse(itc.is_failure(10.1))
        self.assertFalse(itc.is_failure(float("inf")))


class Main(unittest.TestCase):
    def run_main(self, data, env=None, heartbeat=None):
        beats = []
        hb = heartbeat or (lambda now, ok, reason: beats.append((ok, reason)) or True)
        env = env if env is not None else {"IG_ACCESS_TOKEN": "t", "FB_APP_ID": "a", "FB_APP_SECRET": "s"}
        code = itc.main(env_check=lambda name: env.get(name, ""), fetch=lambda *a: data,
                        heartbeat=hb, now_fn=lambda: NOW)
        return code, beats

    def test_healthy_token_passes_and_writes_ok_heartbeat(self):
        code, beats = self.run_main(valid_for(40))
        self.assertEqual(code, 0)
        self.assertEqual(beats, [(True, "40 days left")])

    def test_rejected_token_fails_the_run(self):
        code, beats = self.run_main({})
        self.assertEqual(code, 1)
        self.assertEqual(beats[0][0], False)

    def test_under_ten_days_fails_the_run(self):
        code, beats = self.run_main(valid_for(5))
        self.assertEqual(code, 1)
        self.assertEqual(beats, [(False, "5 days left")])

    def test_missing_secret_fails_and_records_it(self):
        code, beats = self.run_main(valid_for(40), env={"IG_ACCESS_TOKEN": "t"})
        self.assertEqual(code, 1)
        self.assertEqual(beats[0][0], False)
        self.assertIn("setup", beats[0][1])

    def test_heartbeat_write_failure_fails_a_healthy_run(self):
        code, _ = self.run_main(valid_for(40), heartbeat=lambda now, ok, reason: False)
        self.assertEqual(code, 1)

    def test_no_email_code_remains(self):
        source = inspect.getsource(itc)
        self.assertNotIn("resend", source.lower())
        self.assertFalse(hasattr(itc, "send"))
        self.assertNotIn("RESEND_API_KEY", source)


class Heartbeat(unittest.TestCase):
    def test_writes_one_line_with_time_status_and_reason(self):
        calls = []

        def fake_run(args, **kw):
            calls.append((args, kw))
            return subprocess.CompletedProcess(args, 0)

        with mock.patch.dict(os.environ, {"GITHUB_REPOSITORY": "o/r"}):
            ok = itc.write_heartbeat(NOW, True, "40 days left", run=fake_run)
        self.assertTrue(ok)
        args = calls[0][0]
        self.assertEqual(args[:3], ["gh", "variable", "set"])
        self.assertIn("IG_TOKEN_CHECK_HEARTBEAT", args)
        self.assertEqual(args[args.index("--body") + 1], "2026-10-15T12:00:00Z|ok|40 days left")

    def test_failed_write_returns_false_without_raising(self):
        def boom(args, **kw):
            raise subprocess.CalledProcessError(1, args)

        self.assertFalse(itc.write_heartbeat(NOW, False, "x", run=boom))


class Secrets(unittest.TestCase):
    def test_strips_a_real_byte_order_mark(self):
        with mock.patch.dict(os.environ, {"IG_ACCESS_TOKEN": "﻿abc \n"}):
            self.assertEqual(itc.strip("IG_ACCESS_TOKEN"), "abc")


if __name__ == "__main__":
    unittest.main()
