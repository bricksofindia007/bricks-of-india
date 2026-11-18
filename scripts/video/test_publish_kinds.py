"""Every publish_attempts row the slot watchdog writes must use values the table accepts (order 1906).

The four allowed lists (kind, outcome, pipeline, platform) are read from the schema source in the repo:
kind from the newest migration that changes the constraint; outcome, pipeline and platform from the
baseline migration. An in-memory stand-in for the database client records the writes. No network,
no database. The rows the test writes are printed as JSON (column names and values only).
"""
import json
import os
import re
import unittest
from datetime import datetime, timezone

import slot_coverage as sc
import slot_coverage_db as db

IST = sc.IST
MIG_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'supabase', 'migrations')
BASELINE = os.path.join(MIG_DIR, '20260927140000_baseline.sql')
KIND_MIGRATION = os.path.join(MIG_DIR, '20260929060000_publish_attempts_skipped_kind.sql')
NOW = None  # set below


def _values(text: str) -> set:
    return set(re.findall(r"'([a-z0-9_]+)'::text", text))


def allowed_lists() -> dict:
    """The accepted values per column, read from the schema source in the repo."""
    with open(KIND_MIGRATION, encoding='utf-8') as f:
        kind_sql = f.read()
    kind_blocks = re.findall(r"ADD CONSTRAINT publish_attempts_kind_check\s+CHECK \(kind = ANY \(ARRAY\[(.*?)\]\)\)",
                             kind_sql, flags=re.S)
    with open(BASELINE, encoding='utf-8') as f:
        base = f.read()

    def block(name):
        m = re.search(r"CONSTRAINT " + name + r" CHECK \(\((\w+) = ANY \(ARRAY\[(.*?)\]\)\)\)", base, flags=re.S)
        assert m, f'{name} not found in the baseline migration'
        return _values(m.group(2))

    platform = re.search(r"CONSTRAINT publish_attempts_platform_check CHECK \(\(\(platform IS NULL\) OR "
                         r"\(platform = ANY \(ARRAY\[(.*?)\]\)\)\)\)", base, flags=re.S)
    assert kind_blocks and platform, 'a constraint was not found in the schema source'
    return {
        'kind': _values(kind_blocks[-1]),
        'outcome': block('publish_attempts_outcome_check'),
        'pipeline': block('publish_attempts_pipeline_check'),
        'platform': _values(platform.group(1)) | {None},  # NULL is allowed (IS NULL)
    }


def violations(rows: list, allowed: dict) -> list:
    out = []
    for r in rows:
        for col in ('kind', 'outcome', 'pipeline', 'platform'):
            if r.get(col) not in allowed[col]:
                out.append((col, r.get(col), r))
    return out


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
        return list(self.store['publish_attempts'])


def utc(dt):
    return dt.astimezone(timezone.utc)


def ist(y, mo, d, h, mi):
    return datetime(y, mo, d, h, mi, tzinfo=IST)


NOW = utc(ist(2026, 11, 13, 12, 0))
MARKER_AT = utc(ist(2026, 11, 11, 12, 0))  # before the Wed 11 Nov P4 and Thu 12 Nov QP slots fell due
NOW_SOCIAL = utc(ist(2026, 11, 17, 12, 0))  # the Mon 16 Nov social slot is due (00:00 on 17 Nov) and falls after the marker


def run_flow():
    """First real run (writes the marker), then the marker moved before two slots fell due, then a repeat."""
    fake = FakeDB()
    sent = []
    db.check_and_send(fake, 'VID-P4', NOW, sent.append, dry_run=False)
    db.check_and_send(fake, 'VID-QP', NOW, sent.append, dry_run=False)
    assert sent == [], 'the first real run must send nothing'
    for r in fake.written():
        if r['detail'] == db.MARKER_DETAIL:
            r['attempted_at'] = MARKER_AT.isoformat()
    db.check_and_send(fake, 'VID-P4', NOW, sent.append, dry_run=False)
    db.check_and_send(fake, 'VID-QP', NOW, sent.append, dry_run=False)
    db.check_and_send(fake, 'VID-P4', NOW, sent.append, dry_run=False)  # repeat: must add nothing
    db.check_and_send(fake, 'VID-QP', NOW, sent.append, dry_run=False)  # repeat: must add nothing
    db.check_and_send(fake, 'SOCIAL', NOW_SOCIAL, sent.append, dry_run=False)
    db.check_and_send(fake, 'SOCIAL', NOW_SOCIAL, sent.append, dry_run=False)  # repeat: must add nothing
    return fake.written(), sent


class RowsUseAllowedValues(unittest.TestCase):
    def test_the_lists_are_read_from_the_schema(self):
        a = allowed_lists()
        self.assertEqual(a['kind'], {'publish', 'retry', 'missed_slot_alert', 'error_alert', 'skipped'})
        self.assertEqual(a['outcome'], {'posted', 'partial', 'failed', 'blocked', 'deferred', 'alerted'})
        self.assertEqual(a['pipeline'], {'vidp4', 'vidqp'})
        self.assertEqual(a['platform'], {None, 'ig', 'yt'})

    def test_every_row_the_watchdog_writes_uses_allowed_values(self):
        allowed = allowed_lists()
        rows, sent = run_flow()
        print('ROWS_JSON ' + json.dumps(rows, sort_keys=True, default=str))
        self.assertEqual(len(sent), 3, 'one alert per missed slot (Wed 11 P4, Thu 12 QP, Mon 16 social)')
        self.assertTrue(rows, 'the test wrote nothing; it proves nothing')
        self.assertEqual(violations(rows, allowed), [])

    def test_the_marker_and_the_alert_rows_have_the_agreed_shape(self):
        rows, _ = run_flow()
        marker = [r for r in rows if r['detail'] == 'slot-watch-start']
        self.assertEqual(len(marker), 1, 'exactly one start marker')
        self.assertEqual(marker[0]['pipeline'], 'vidp4')
        self.assertEqual(marker[0]['kind'], 'missed_slot_alert')
        self.assertEqual(marker[0]['outcome'], 'deferred')
        self.assertIsNone(marker[0]['platform'])
        self.assertIsNone(marker[0]['row_id'])
        self.assertIsNone(marker[0]['row_number'])
        alerts = {r['detail']: r for r in rows if r['detail'].startswith('slot-no-post:')}
        self.assertEqual(set(alerts), {'slot-no-post:vidp4:2026-11-11 19:30', 'slot-no-post:vidqp:2026-11-12 00:00',
                                       'slot-no-post:social:2026-11-16 12:00'})
        self.assertEqual(alerts['slot-no-post:social:2026-11-16 12:00']['pipeline'], 'vidp4')
        for r in alerts.values():
            self.assertEqual(r['kind'], 'missed_slot_alert')
            self.assertEqual(r['outcome'], 'alerted')
            self.assertIsNone(r['platform'])

    def test_the_social_slot_is_recorded_under_vidp4_with_its_own_detail(self):
        rows, sent = run_flow()
        social = [r for r in rows if r['detail'].startswith('slot-no-post:social:')]
        self.assertEqual(len(social), 1, 'one social alert row')
        self.assertEqual(social[0]['pipeline'], 'vidp4')
        self.assertEqual(social[0]['kind'], 'missed_slot_alert')
        self.assertEqual(social[0]['outcome'], 'alerted')
        self.assertEqual(len([a for a in sent if a.key.startswith('slot-no-post:social:')]), 1)


class FailsWhenAColumnIsBad(unittest.TestCase):
    """Patch one column to a value the table refuses, in memory, and show the check fails."""

    def _with(self, attr, value, fn):
        saved = getattr(db, attr)
        setattr(db, attr, value)
        try:
            return fn()
        finally:
            setattr(db, attr, saved)

    def _fails(self, rows):
        return violations(rows, allowed_lists())

    def test_kind_bad(self):
        rows, _ = self._with('ALERT_KIND', 'slot_no_post', run_flow)
        bad = self._fails(rows)
        self.assertTrue(any(col == 'kind' for col, _, _ in bad))

    def test_outcome_bad(self):
        rows, _ = self._with('ALERT_OUTCOME', 'sent', run_flow)
        bad = self._fails(rows)
        self.assertTrue(any(col == 'outcome' for col, _, _ in bad))

    def test_pipeline_bad(self):
        rows, _ = self._with('RECORDABLE', {'VID-P4': 'slot-watch', 'VID-QP': 'vidqp', 'SOCIAL': 'vidp4'}, run_flow)
        bad = self._fails(rows)
        self.assertTrue(any(col == 'pipeline' for col, _, _ in bad))

    def test_platform_bad(self):
        rows, _ = self._with('ROW_PLATFORM', 'x', run_flow)
        bad = self._fails(rows)
        self.assertTrue(any(col == 'platform' for col, _, _ in bad))


if __name__ == '__main__':
    unittest.main()
