"""Every publish_attempts row the slot watchdog writes must use a kind the table allows (order 1902).

The allowed list is read from the newest migration that changes the constraint, so this test
follows the database, not a copy of it. An in-memory stand-in for the database client records
the writes. No network, no database.
"""
import os
import re
import unittest
from datetime import datetime, timedelta, timezone

import slot_coverage as sc
import slot_coverage_db as db

IST = sc.IST
MIGRATION = os.path.join(os.path.dirname(__file__), '..', '..', 'supabase', 'migrations',
                         '20260929060000_publish_attempts_skipped_kind.sql')


def allowed_kinds() -> set:
    """The kind list of the LAST 'ADD CONSTRAINT publish_attempts_kind_check' in the newest migration."""
    with open(MIGRATION, encoding='utf-8') as f:
        text = f.read()
    lists = re.findall(r"ADD CONSTRAINT publish_attempts_kind_check\s+CHECK \(kind = ANY \(ARRAY\[(.*?)\]\)\)",
                       text, flags=re.S)
    assert lists, 'no kind constraint found in the migration'
    return set(re.findall(r"'([a-z_]+)'::text", lists[-1]))


class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    """Enough of the client for the reads and writes in slot_coverage_db.py. Filters: eq only."""

    def __init__(self, store, table):
        self.store, self.table, self.filters, self.payload = store, table, [], None

    def select(self, *_):
        return self

    def eq(self, col, val):
        self.filters.append((col, val))
        return self

    def __getattr__(self, name):  # gte, lte, in_, is_, order, limit: accepted, not applied
        return lambda *a, **k: self

    def insert(self, row):
        self.payload = row
        return self

    def execute(self):
        rows = self.store.setdefault(self.table, [])
        if self.payload is not None:
            rows.append(dict(self.payload))
            return _Result([dict(self.payload)])
        return _Result([r for r in rows if all(r.get(c) == v for c, v in self.filters)])


class FakeDB:
    def __init__(self):
        self.store = {'publish_attempts': [], 'video_posts': [], 'quiet_panic_posts': [], 'posted_sets': []}

    def table(self, name):
        return _Query(self.store, name)

    def written(self):
        return [r for r in self.store['publish_attempts']]


def utc(dt):
    return dt.astimezone(timezone.utc)


def ist(y, mo, d, h, mi):
    return datetime(y, mo, d, h, mi, tzinfo=IST)


class KindsAreAllowed(unittest.TestCase):
    def test_the_migration_list_is_read(self):
        kinds = allowed_kinds()
        self.assertEqual(kinds, {'publish', 'retry', 'missed_slot_alert', 'error_alert', 'skipped'})

    def test_every_kind_the_watchdog_writes_is_allowed(self):
        allowed = allowed_kinds()
        fake = FakeDB()
        now = utc(ist(2026, 11, 13, 12, 0))
        sent = []

        # 1. First real run: writes the start marker, sends nothing.
        db.check_and_send(fake, 'VID-QP', now, sent.append, dry_run=False)
        self.assertEqual(sent, [])
        marker = [r for r in fake.written() if r['detail'] == db.WATCH_DETAIL]
        self.assertEqual(len(marker), 1)

        # 2. Move the marker before the Thu 12 Nov Quiet Panic slot is due, then run: one no-post alert.
        marker[0]['attempted_at'] = utc(ist(2026, 11, 11, 12, 0)).isoformat()
        db.check_and_send(fake, 'VID-QP', now, sent.append, dry_run=False)
        self.assertEqual([a.key for a in sent], ['slot-no-post:VID-QP:2026-11-12 00:00'])

        # 3. A repeat run sends nothing more (the dedupe row is found).
        sent.clear()
        db.check_and_send(fake, 'VID-QP', now, sent.append, dry_run=False)
        self.assertEqual(sent, [])

        # Every row the code wrote: kind allowed, pipeline not a real pipeline key.
        rows = fake.written()
        self.assertTrue(rows, 'the test wrote nothing; it proves nothing')
        for r in rows:
            self.assertIn(r['kind'], allowed, f"kind {r['kind']!r} is not allowed by the table")
            self.assertNotIn(r['pipeline'], {'vidp4', 'vidqp'}, 'would be counted by the existing watchdog')
            self.assertFalse(str(r['detail']).startswith('slot_day='), 'would be counted by the existing watchdog')

    def test_the_two_row_shapes(self):
        self.assertEqual(db.WATCH_KIND, 'missed_slot_alert')
        self.assertEqual(db.WATCH_PIPELINE, 'slot-watch')
        self.assertEqual(db.WATCH_DETAIL, 'slot-watch-start')
        self.assertEqual(db.ALERT_KIND, 'missed_slot_alert')
        self.assertEqual(db.ALERT_PIPELINE, 'slot-watch')


if __name__ == '__main__':
    unittest.main()
