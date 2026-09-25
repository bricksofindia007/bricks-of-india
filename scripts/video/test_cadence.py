"""
Unit tests for cadence.py (issue #178). No network, no DB: an in-memory fake
supabase client implements just the query-builder calls cadence.py uses.

Run: cd scripts/video && python -m unittest test_cadence -v
"""

from __future__ import annotations

import fnmatch
import unittest
from datetime import date, datetime, timezone

import cadence
from cadence import VIDP4, VIDQP


# ── fake supabase ────────────────────────────────────────────────────────────

class _Res:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, db, table):
        self.db, self.table, self.filters = db, table, []
        self._order = None
        self._limit = None
        self._insert = None

    def select(self, _cols):
        return self

    def insert(self, row):
        self._insert = row
        return self

    def eq(self, c, v):
        self.filters.append(lambda r: r.get(c) == v); return self

    def in_(self, c, vs):
        self.filters.append(lambda r: r.get(c) in vs); return self

    def gte(self, c, v):
        self.filters.append(lambda r: r.get(c) is not None and _ts(r[c]) >= _ts(v)); return self

    def lt(self, c, v):
        self.filters.append(lambda r: r.get(c) is not None and _ts(r[c]) < _ts(v)); return self

    def like(self, c, pat):
        self.filters.append(lambda r: r.get(c) is not None and fnmatch.fnmatchcase(r[c], pat.replace('%', '*'))); return self

    def is_(self, c, v):
        assert v == 'null'
        self.filters.append(lambda r: r.get(c) is None); return self

    def order(self, c):
        self._order = c; return self

    def limit(self, n):
        self._limit = n; return self

    def execute(self):
        rows = self.db.setdefault(self.table, [])
        if self._insert is not None:
            row = dict(self._insert)
            row.setdefault('attempted_at', self.db['_now'].isoformat())
            rows.append(row)
            return _Res([row])
        out = [r for r in rows if all(f(r) for f in self.filters)]
        if self._order:
            out.sort(key=lambda r: (r.get(self._order) is None, r.get(self._order)))
        if self._limit is not None:
            out = out[: self._limit]
        return _Res(out)


def _ts(v):
    return datetime.fromisoformat(v.replace('Z', '+00:00')) if isinstance(v, str) else v


class FakeSB:
    def __init__(self, now_utc, **tables):
        self.db = {k: list(v) for k, v in tables.items()}
        self.db['_now'] = now_utc

    def table(self, name):
        return _Query(self.db, name)


def utc(s):
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)


# ── pure slot logic ─────────────────────────────────────────────────────────

class SlotLogic(unittest.TestCase):
    def test_ist_day_boundary(self):
        # 18:29 UTC = 23:59 IST same day; 18:30 UTC = 00:00 IST next day
        self.assertEqual(cadence.ist_date(utc('2026-09-24T18:29:00')), date(2026, 9, 24))
        self.assertEqual(cadence.ist_date(utc('2026-09-24T18:30:00')), date(2026, 9, 25))

    def test_vidp4_window(self):
        self.assertFalse(cadence.slot_status(VIDP4, utc('2026-09-24T13:59:00'))[0])  # 19:29 IST
        self.assertTrue(cadence.slot_status(VIDP4, utc('2026-09-24T14:00:00'))[0])   # 19:30 IST

    def test_vidqp_mon_wed_fri_only(self):
        # IST dates: 2026-09-21 Mon ... 2026-09-27 Sun. 06:00 UTC = 11:30 IST.
        expected = {21: True, 22: False, 23: True, 24: False, 25: True, 26: False, 27: False}
        for d, ok in expected.items():
            self.assertEqual(cadence.slot_status(VIDQP, utc(f'2026-09-{d}T06:00:00'))[0], ok, d)

    def test_vidqp_thursday_just_after_ist_midnight_is_closed(self):
        # The exact case found live 2026-09-24: QP #34 approved early Thu
        # (IST) -- any Thursday tick must NOT publish; first tick after IST
        # midnight into Friday may.
        self.assertFalse(cadence.slot_status(VIDQP, utc('2026-09-23T18:47:00'))[0])  # 00:17 IST Thu
        self.assertFalse(cadence.slot_status(VIDQP, utc('2026-09-24T04:00:00'))[0])  # 09:30 IST Thu
        self.assertTrue(cadence.slot_status(VIDQP, utc('2026-09-24T18:47:00'))[0])   # 00:17 IST Fri

    def test_watchdog_judges_previous_ist_day_despite_lag(self):
        for run in ('2026-09-25T00:15:00', '2026-09-25T04:30:00', '2026-09-25T06:29:00'):
            self.assertEqual(cadence.watchdog_slot_day(utc(run)), date(2026, 9, 24), run)

    def test_watchdog_never_judges_an_unfinished_day(self):
        # #178 (c): a slot is missed only at the end of its IST day. A manual
        # run at 23:30 IST Thu (18:00 UTC) must judge Wed, not the still-open Thu.
        self.assertEqual(cadence.watchdog_slot_day(utc('2026-09-24T18:00:00')), date(2026, 9, 23))
        # ...and the first run after IST midnight judges the day that just ended.
        self.assertEqual(cadence.watchdog_slot_day(utc('2026-09-24T18:31:00')), date(2026, 9, 24))
        for run in ('2026-09-24T14:30:00', '2026-09-24T18:29:00', '2026-09-25T00:15:00'):
            day = cadence.watchdog_slot_day(utc(run))
            self.assertLessEqual(cadence.ist_day_bounds_utc(day)[1], utc(run), run)

    def test_approved_at_null_counts_as_waiting(self):
        slot = utc('2026-09-24T14:00:00')
        self.assertTrue(cadence.row_was_waiting_before({'approved_at': None}, slot))
        self.assertTrue(cadence.row_was_waiting_before({'approved_at': '2026-09-24T10:00:00+00:00'}, slot))
        self.assertFalse(cadence.row_was_waiting_before({'approved_at': '2026-09-24T15:00:00+00:00'}, slot))


# ── per-platform cap ────────────────────────────────────────────────────────

class PlatformCap(unittest.TestCase):
    NOW = utc('2026-09-24T14:30:00')  # 20:00 IST Thu
    TODAY = date(2026, 9, 24)

    def test_retry_today_blocks_that_platform_only(self):
        sb = FakeSB(self.NOW, video_posts=[
            {'id': 'a', 'status': 'posted_both', 'posted_at': '2026-09-20T15:00:00+00:00',
             'ig_posted_at': '2026-09-24T06:00:00+00:00', 'yt_posted_at': '2026-09-20T15:00:00+00:00'},
        ])
        self.assertEqual(cadence.platform_posted_on(sb, VIDP4, 'ig', self.TODAY), 'a')
        self.assertIsNone(cadence.platform_posted_on(sb, VIDP4, 'yt', self.TODAY))
        self.assertEqual(cadence.anything_posted_on(sb, VIDP4, self.TODAY), 'a')

    def test_legacy_row_posted_at_counts(self):
        sb = FakeSB(self.NOW, video_posts=[
            {'id': 'b', 'status': 'posted_yt', 'posted_at': '2026-09-24T14:10:00+00:00'},
        ])
        self.assertEqual(cadence.platform_posted_on(sb, VIDP4, 'yt', self.TODAY), 'b')
        self.assertIsNone(cadence.platform_posted_on(sb, VIDP4, 'ig', self.TODAY))

    def test_merge_day_legacy_post_blocks_both_platforms(self):
        # #178 (a): a row that went live earlier today under the OLD code has
        # NULL ig_posted_at/yt_posted_at (columns didn't exist). The cap must
        # fall back to posted_at so the new code can't post a second row today.
        sb = FakeSB(self.NOW, video_posts=[
            {'id': 'm', 'status': 'posted_both', 'posted_at': '2026-09-24T14:05:00+00:00',
             'ig_posted_at': None, 'yt_posted_at': None},
        ])
        self.assertEqual(cadence.platform_posted_on(sb, VIDP4, 'ig', self.TODAY), 'm')
        self.assertEqual(cadence.platform_posted_on(sb, VIDP4, 'yt', self.TODAY), 'm')
        self.assertEqual(cadence.anything_posted_on(sb, VIDP4, self.TODAY), 'm')

    def test_merge_day_fallback_is_per_platform(self):
        # #178 (a): legacy posted_ig row (IG live this morning, old code) whose
        # YT half was completed by a new-code retry -- yt_posted_at is set, but
        # ig_posted_at is still NULL. The IG post must still count today.
        sb = FakeSB(self.NOW, quiet_panic_posts=[
            {'id': 'n', 'status': 'posted_both', 'posted_at': '2026-09-24T03:00:00+00:00',
             'ig_posted_at': None, 'yt_posted_at': '2026-09-24T14:20:00+00:00'},
        ])
        self.assertEqual(cadence.platform_posted_on(sb, VIDQP, 'ig', self.TODAY), 'n')
        self.assertEqual(cadence.platform_posted_on(sb, VIDQP, 'yt', self.TODAY), 'n')

    def test_yesterday_does_not_count(self):
        sb = FakeSB(self.NOW, video_posts=[
            {'id': 'c', 'status': 'posted_both', 'posted_at': '2026-09-23T17:00:00+00:00',
             'ig_posted_at': '2026-09-23T17:00:00+00:00', 'yt_posted_at': '2026-09-23T17:00:00+00:00'},
        ])
        self.assertIsNone(cadence.anything_posted_on(sb, VIDP4, self.TODAY))


# ── missed-slot watchdog ────────────────────────────────────────────────────

class MissedSlot(unittest.TestCase):
    RUN = utc('2026-09-25T00:15:00')  # judges Thu 2026-09-24

    def _run(self, sb, pipeline=VIDP4):
        sent = []
        summary = cadence.check_missed_slot(sb, pipeline, self.RUN, lambda p, d, rows: sent.append((p.key, d, rows)))
        return summary, sent

    def test_alerts_when_approved_waiting_and_nothing_posted(self):
        sb = FakeSB(self.RUN, video_posts=[
            {'id': 'r62', 'story_number': 62, 'set_title': 'Ferrari F2004', 'status': 'approved', 'approved_at': None},
        ], publish_attempts=[
            {'pipeline': 'vidp4', 'row_id': 'r62', 'kind': 'publish', 'outcome': 'failed', 'platform': None,
             'detail': 'RuntimeError: download failed', 'attempted_at': '2026-09-24T14:05:00+00:00'},
        ])
        summary, sent = self._run(sb)
        self.assertEqual(summary['action'], 'alerted')
        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0][2][0]['row_number'], 62)
        self.assertIn('download failed', sent[0][2][0]['reason'])
        # second run same day: deduped
        summary2, sent2 = self._run(sb)
        self.assertEqual(summary2['action'], 'already_alerted')
        self.assertEqual(sent2, [])

    def test_no_attempt_recorded_reason_is_explicit(self):
        sb = FakeSB(self.RUN, video_posts=[
            {'id': 'r64', 'story_number': 64, 'set_title': 'X', 'status': 'approved', 'approved_at': '2026-09-20T00:00:00+00:00'},
        ], publish_attempts=[])
        _, sent = self._run(sb)
        self.assertIn('never reached', sent[0][2][0]['reason'])

    def test_blocked_row_moved_out_of_approved_still_reported(self):
        sb = FakeSB(self.RUN, video_posts=[
            {'id': 'r40', 'story_number': 40, 'set_title': 'Bugatti', 'status': 'publish_blocked', 'approved_at': None},
        ], publish_attempts=[
            {'pipeline': 'vidp4', 'row_id': 'r40', 'kind': 'publish', 'outcome': 'blocked', 'platform': None,
             'detail': 'StoryBadgeMissingError: no badge', 'attempted_at': '2026-09-24T14:01:00+00:00'},
        ])
        _, sent = self._run(sb)
        self.assertEqual(sent[0][2][0]['status'], 'publish_blocked')
        self.assertIn('StoryBadgeMissingError', sent[0][2][0]['reason'])

    def test_posted_day_is_quiet(self):
        sb = FakeSB(self.RUN, video_posts=[
            {'id': 'p', 'status': 'posted_both', 'posted_at': '2026-09-24T14:20:00+00:00',
             'ig_posted_at': '2026-09-24T14:20:00+00:00', 'yt_posted_at': '2026-09-24T14:21:00+00:00'},
            {'id': 'q', 'story_number': 64, 'status': 'approved', 'approved_at': None},
        ])
        summary, sent = self._run(sb)
        self.assertEqual(summary['action'], 'posted')
        self.assertEqual(sent, [])

    def test_row_approved_after_slot_does_not_alert(self):
        sb = FakeSB(self.RUN, video_posts=[
            {'id': 'late', 'story_number': 73, 'status': 'approved', 'approved_at': '2026-09-24T16:00:00+00:00'},
        ])
        summary, sent = self._run(sb)
        self.assertEqual(summary['action'], 'queue_empty')
        self.assertEqual(sent, [])

    def test_qp_non_slot_day_is_quiet(self):
        sb = FakeSB(self.RUN, quiet_panic_posts=[
            {'id': 'qp34', 'sequence_number': 34, 'status': 'approved', 'approved_at': None},
        ])
        summary, sent = self._run(sb, VIDQP)  # Thu -- not a QP slot day
        self.assertEqual(summary['action'], 'not_a_slot_day')
        self.assertEqual(sent, [])


class RecordAttempt(unittest.TestCase):
    def test_never_raises(self):
        class Boom:
            def table(self, _):
                raise RuntimeError('db down')
        cadence.record_attempt(Boom(), VIDP4, {'id': 'x', 'story_number': 1}, 'publish', 'posted')


if __name__ == '__main__':
    unittest.main()
