"""P23b tests: VID-P4 on Mon/Wed/Fri only, catch-up across weekends, watchdog on
slot days only, and the generation bank skip. Run: python -m unittest test_cadence_mwf -v

Dates (IST days): Mon 2026-10-12, Tue 2026-10-13, Wed 2026-10-14, Thu 2026-10-15,
Fri 2026-10-16, Sat 2026-10-17, Sun 2026-10-18.
"""

import unittest
from datetime import date, datetime, timezone

import cadence
import generation_bank
from cadence import VIDP4, VIDQP


def utc(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)


class _Res:
    def __init__(self, data=None, count=None):
        self.data = data or []
        self.count = count


class _CountQuery:
    def __init__(self, rows):
        self._rows = rows
        self._filters = {}

    def select(self, *_a, **_k):
        return self

    def eq(self, col, val):
        self._filters[col] = val
        return self

    def execute(self):
        matched = [r for r in self._rows if all(r.get(k) == v for k, v in self._filters.items())]
        return _Res(data=matched, count=len(matched))


class _CountSB:
    def __init__(self, rows):
        self._rows = rows

    def table(self, name):
        assert name == 'video_posts', name
        return _CountQuery(self._rows)


class SlotDays(unittest.TestCase):
    def test_vidp4_slot_days_are_mon_wed_fri_only(self):
        self.assertEqual(sorted(VIDP4.slot_weekdays), [0, 2, 4])
        for d, ok in [(date(2026, 10, 12), True), (date(2026, 10, 13), False), (date(2026, 10, 14), True),
                      (date(2026, 10, 15), False), (date(2026, 10, 16), True), (date(2026, 10, 17), False),
                      (date(2026, 10, 18), False)]:
            self.assertEqual(cadence.is_slot_day(VIDP4, d), ok, d)

    def test_tuesday_does_nothing(self):
        # Tue 2026-10-13 19:30 IST = 14:00 UTC: no slot, and no catch-up either.
        self.assertFalse(cadence.slot_status(VIDP4, utc('2026-10-13T14:00:00'))[0])
        self.assertFalse(cadence.slot_status(VIDP4, utc('2026-10-13T01:30:00'), catchup=True)[0])

    def test_wednesday_opens_one_slot_at_1930_ist(self):
        # Wed 2026-10-14 19:29 IST closed, 19:30 IST open.
        self.assertFalse(cadence.slot_status(VIDP4, utc('2026-10-14T13:59:00'))[0])
        self.assertTrue(cadence.slot_status(VIDP4, utc('2026-10-14T14:00:00'))[0])

    def test_thursday_saturday_sunday_closed(self):
        for t in ['2026-10-15T14:00:00', '2026-10-17T14:00:00', '2026-10-18T14:00:00']:
            self.assertFalse(cadence.slot_status(VIDP4, utc(t))[0], t)

    def test_quiet_panic_unchanged(self):
        self.assertEqual(sorted(VIDQP.slot_weekdays), [0, 2, 4])
        self.assertEqual(VIDQP.slot_start_ist, (0, 0))


class PreviousSlotDay(unittest.TestCase):
    def test_previous_slot_day_skips_non_slot_days(self):
        self.assertEqual(cadence.previous_slot_day(VIDP4, date(2026, 10, 14)), date(2026, 10, 12))  # Wed -> Mon
        self.assertEqual(cadence.previous_slot_day(VIDP4, date(2026, 10, 12)), date(2026, 10, 9))   # Mon -> Fri
        self.assertEqual(cadence.previous_slot_day(VIDP4, date(2026, 10, 16)), date(2026, 10, 14))  # Fri -> Wed
        self.assertEqual(cadence.previous_slot_day(VIDP4, date(2026, 10, 13)), date(2026, 10, 12))  # Tue -> Mon


class CatchUpAcrossWeekend(unittest.TestCase):
    HEAD = {'id': 'h', 'story_number': 80, 'status': 'approved', 'approved_at': '2026-10-10T10:00:00+00:00'}

    def test_missed_monday_catches_up_on_wednesday_at_0700(self):
        # Mon 12 Oct 19:30 IST slot missed (no post). Wed 14 Oct 08:00 IST: catch-up due.
        now = utc('2026-10-14T02:30:00')
        sb = type('S', (), {'table': lambda self, n: _Q(n)})()  # no posts at all
        self.assertTrue(cadence.catchup_due(sb, VIDP4, now, self.HEAD))
        self.assertTrue(cadence.slot_status(VIDP4, now, catchup=True)[0])
        # 06:59 IST on Wed is still before the catch-up opens.
        self.assertFalse(cadence.slot_status(VIDP4, utc('2026-10-14T01:29:00'), catchup=True)[0])

    def test_tuesday_after_missed_monday_has_no_catchup_slot(self):
        # Tue is not a slot day, so catch-up cannot open a slot on Tue.
        now = utc('2026-10-13T02:30:00')
        self.assertFalse(cadence.slot_status(VIDP4, now, catchup=True)[0])


class _Q:
    """Minimal fake for catchup_due / anything_posted_on: nothing was posted."""
    def __init__(self, name):
        self.name = name

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def gte(self, *_a, **_k):
        return self

    def lt(self, *_a, **_k):
        return self

    def in_(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def or_(self, *_a, **_k):
        return self

    def execute(self):
        return _Res(data=[])


class WatchdogJudgesSlotDaysOnly(unittest.TestCase):
    def _judge(self, run: str, pipeline):
        sent = []
        summary = cadence.check_missed_slot(None, pipeline, utc(run), lambda p, d, rows: sent.append(rows))
        return summary, sent

    def test_tuesday_run_judging_monday_is_a_slot_check(self):
        # Tue 14 Oct 00:15 UTC judges Mon 12 Oct, a slot day, so the DB is consulted.
        # Not exercised here (needs a DB); assert the day that would be judged.
        self.assertEqual(cadence.watchdog_slot_day(utc('2026-10-13T00:15:00')), date(2026, 10, 12))
        self.assertTrue(cadence.is_slot_day(VIDP4, date(2026, 10, 12)))

    def test_wednesday_run_judging_tuesday_is_quiet(self):
        summary, sent = self._judge('2026-10-14T00:15:00', VIDP4)  # judges Tue 13 Oct
        self.assertEqual(summary['action'], 'not_a_slot_day')
        self.assertEqual(sent, [])

    def test_thursday_run_judging_wednesday_is_a_slot_day(self):
        self.assertTrue(cadence.is_slot_day(VIDP4, cadence.watchdog_slot_day(utc('2026-10-15T00:15:00'))))

    def test_every_non_slot_day_is_quiet_for_vidp4(self):
        # Runs on Tue, Thu, Sat, Sun judge Mon, Wed, Fri, Sat -- and Sat is quiet.
        for run in ['2026-10-14T00:15:00', '2026-10-16T00:15:00', '2026-10-18T00:15:00', '2026-10-19T00:15:00']:
            summary, sent = self._judge(run, VIDP4)
            if not cadence.is_slot_day(VIDP4, cadence.watchdog_slot_day(utc(run))):
                self.assertEqual(summary['action'], 'not_a_slot_day', run)
                self.assertEqual(sent, [], run)


class GenerationBank(unittest.TestCase):
    FRI = utc('2026-10-16T10:00:00')  # Fri 2026-10-16 15:30 IST

    def test_friday_with_bank_at_four_skips_generation(self):
        ok, line = generation_bank.decide(4, self.FRI)
        self.assertFalse(ok)
        self.assertIn('skipped on Fri 2026-10-16', line)
        self.assertIn('4 approved, unposted', line)
        self.assertIn('limit 4', line)

    def test_bank_below_limit_generates(self):
        ok, line = generation_bank.decide(3, self.FRI)
        self.assertTrue(ok)
        self.assertIn('generating', line)

    def test_count_uses_approved_rows_only(self):
        rows = [{'id': 'a', 'status': 'approved'}, {'id': 'b', 'status': 'approved'},
                {'id': 'c', 'status': 'posted_both'}, {'id': 'd', 'status': 'pending_approval'}]
        self.assertEqual(generation_bank.count_approved(_CountSB(rows)), 2)

    def test_full_bank_on_friday_end_to_end(self):
        rows = [{'id': str(i), 'status': 'approved'} for i in range(4)]
        ok, line = generation_bank.bank_decision(_CountSB(rows), self.FRI)
        self.assertFalse(ok)
        self.assertIn('4 approved, unposted', line)


if __name__ == '__main__':
    unittest.main()
