"""
Unit tests for config/quota_guard.py (FP6.4, P4 Step 2h). No network.
Run: python -m unittest config.test_quota_guard -v   (from the repo root)
"""

import unittest
from datetime import datetime, timezone

from config import quota_guard as qg

OK = {'storage_mb': 427.0, 'db_mb': 181.0, 'egress_projected_gb': 1.0}

# Same vector as tests/quota-guard.test.ts -- both languages must agree.
VECTOR_NOW = datetime(2026, 9, 27, 12, 0, tzinfo=timezone.utc)
VECTOR = [
    {'taken_at': '2026-09-11T00:00:00Z', 'api_calls': 7722258},
    {'taken_at': '2026-09-26T14:54:45Z', 'api_calls': 9388130},
    {'taken_at': '2026-09-27T08:24:07Z', 'api_calls': 9427196},
]


class Boundaries(unittest.TestCase):
    def check(self, fn, key, cases):
        for value, allowed, level in cases:
            d = fn({**OK, key: value})
            self.assertEqual((d['allowed'], d['level']), (allowed, level), f'{key}={value}')

    def test_storage(self):
        self.check(qg.may_upload, 'storage_mb', [(699, True, 'ok'), (700, True, 'warning'), (799, True, 'warning'), (800, False, 'critical')])

    def test_db(self):
        self.check(qg.may_write_non_essential, 'db_mb', [(349, True, 'ok'), (350, True, 'warning'), (399, True, 'warning'), (400, False, 'critical')])

    def test_egress(self):
        self.check(qg.may_read_non_essential, 'egress_projected_gb', [(3.49, True, 'ok'), (3.5, True, 'warning'), (3.99, True, 'warning'), (4.0, False, 'critical')])

    def test_unreadable_fails_closed(self):
        none = {'storage_mb': None, 'db_mb': None, 'egress_projected_gb': None}
        for fn in (qg.may_upload, qg.may_write_non_essential, qg.may_read_non_essential):
            self.assertEqual(fn(none)['reason'], 'usage-unreadable')
            self.assertFalse(fn(none)['allowed'])


class Estimate(unittest.TestCase):
    def test_shared_vector_matches_node(self):
        self.assertAlmostEqual(qg.projected_egress_gb(VECTOR, VECTOR_NOW), 3.8513, places=3)

    def test_simulation_parse(self):
        self.assertEqual(qg.parse_simulation('storage_mb=800, junk=1'), {'storage_mb': 800.0})
        self.assertIsNone(qg.parse_simulation(''))


class _FakeRpc:
    def __init__(self, data):
        self._d = data

    def execute(self):
        return type('R', (), {'data': self._d})()


class _FakeSb:
    def __init__(self, storage_mb=427.1, fail=False):
        self.storage_mb, self.fail = storage_mb, fail

    def rpc(self, name, params=None):
        if self.fail:
            raise RuntimeError('boom')
        if name == 'db_usage_report':
            return _FakeRpc({'storage_mb': self.storage_mb, 'db_size_mb': 181.0})
        return _FakeRpc(VECTOR)


class UploadGuard(unittest.TestCase):
    def setUp(self):
        qg.reset_cache()
        self.alerts = []

    def alert(self, s, b):
        self.alerts.append((s, b))

    def test_refuses_before_storage_and_alerts_at_800(self):
        with self.assertRaises(qg.QuotaBlockedError):
            qg.check_upload(_FakeSb(storage_mb=800), 'TEST', 'a video', self.alert)
        self.assertEqual(len(self.alerts), 1)
        self.assertIn('refused', self.alerts[0][0])

    def test_allows_at_799_without_alert(self):
        qg.check_upload(_FakeSb(storage_mb=799), 'TEST', 'a video', self.alert)
        self.assertEqual(self.alerts, [])

    def test_unreadable_usage_refuses_upload(self):
        with self.assertRaises(qg.QuotaBlockedError):
            qg.check_upload(_FakeSb(fail=True), 'TEST', 'a video', self.alert)


if __name__ == '__main__':
    unittest.main()
