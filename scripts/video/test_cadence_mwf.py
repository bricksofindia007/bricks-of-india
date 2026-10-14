"""Posting-day tests for the 2026-10-14 week: VID-P4 on Wed/Fri/Sun, VID-QP on
Tue/Thu/Sat. Catch-up and the watchdog across both week-wrap gaps (Sun to Wed for
VID-P4, Sat to Tue for VID-QP), and the generation bank skip.
Run: python -m unittest test_cadence_mwf -v

Dates (IST days): Sat 2026-10-10, Sun 10-11, Mon 10-12, Tue 10-13, Wed 10-14,
Thu 10-15, Fri 10-16, Sat 10-17, Sun 10-18, Mon 10-19.
"""

import unittest
from datetime import date, datetime, timezone

import cadence
import generation_bank
from cadence import VIDP4, VIDQP
from test_cadence import FakeSB

WEEK = [  # (IST date, weekday name)
    (date(2026, 10, 12), 'Mon'), (date(2026, 10, 13), 'Tue'), (date(2026, 10, 14), 'Wed'),
    (date(2026, 10, 15), 'Thu'), (date(2026, 10, 16), 'Fri'), (date(2026, 10, 17), 'Sat'),
    (date(2026, 10, 18), 'Sun'),
]


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
    def test_vidp4_slot_days_are_wed_fri_sun(self):
        self.assertEqual(sorted(VIDP4.slot_weekdays), [2, 4, 6])
        for d, name in WEEK:
            self.assertEqual(cadence.is_slot_day(VIDP4, d), name in ('Wed', 'Fri', 'Sun'), name)

    def test_vidqp_slot_days_are_tue_thu_sat(self):
        self.assertEqual(sorted(VIDQP.slot_weekdays), [1, 3, 5])
        for d, name in WEEK:
            self.assertEqual(cadence.is_slot_day(VIDQP, d), name in ('Tue', 'Thu', 'Sat'), name)

    def test_vidqp_start_time_unchanged(self):
        self.assertEqual(VIDQP.slot_start_ist, (0, 0))
        self.assertEqual(VIDP4.slot_start_ist, (19, 30))
        self.assertEqual(VIDP4.catchup_start_ist, (7, 0))


class VidP4Slot(unittest.TestCase):
    def test_tuesday_does_nothing(self):
        # Tue 2026-10-13 19:30 IST = 14:00 UTC: no slot, and no catch-up either.
        self.assertFalse(cadence.slot_status(VIDP4, utc('2026-10-13T14:00:00'))[0])
        self.assertFalse(cadence.slot_status(VIDP4, utc('2026-10-13T01:30:00'), catchup=True)[0])

    def test_wednesday_opens_one_slot_at_1930_ist(self):
        # Wed 2026-10-14 19:29 IST closed, 19:30 IST open.
        self.assertFalse(cadence.slot_status(VIDP4, utc('2026-10-14T13:59:00'))[0])
        self.assertTrue(cadence.slot_status(VIDP4, utc('2026-10-14T14:00:00'))[0])

    def test_sunday_opens_at_1930_ist(self):
        # Sun 2026-10-18 19:29 IST closed, 19:30 IST open.
        self.assertFalse(cadence.slot_status(VIDP4, utc('2026-10-18T13:59:00'))[0])
        self.assertTrue(cadence.slot_status(VIDP4, utc('2026-10-18T14:00:00'))[0])

    def test_monday_thursday_saturday_closed(self):
        for t in ['2026-10-12T14:00:00', '2026-10-15T14:00:00', '2026-10-17T14:00:00']:
            self.assertFalse(cadence.slot_status(VIDP4, utc(t))[0], t)


class VidQpSlot(unittest.TestCase):
    def test_opens_at_ist_midnight_on_tue_thu_sat(self):
        # Tue 00:00 IST = Mon 18:30 UTC; Mon 23:59 IST is still closed.
        self.assertTrue(cadence.slot_status(VIDQP, utc('2026-10-12T18:30:00'))[0])   # Tue 00:00 IST
        self.assertFalse(cadence.slot_status(VIDQP, utc('2026-10-12T18:29:00'))[0])  # Mon 23:59 IST

    def test_mon_wed_fri_sun_closed(self):
        # 00:30 IST on each day = the previous day's 19:00 UTC.
        for t in ['2026-10-11T19:00:00',   # Mon 12 Oct 00:30 IST
                  '2026-10-13T19:00:00',   # Wed 14 Oct 00:30 IST
                  '2026-10-15T19:00:00',   # Fri 16 Oct 00:30 IST
                  '2026-10-17T19:00:00']:  # Sun 18 Oct 00:30 IST
            self.assertFalse(cadence.slot_status(VIDQP, utc(t))[0], t)


class PreviousSlotDay(unittest.TestCase):
    def test_vidp4_sunday_to_wednesday_gap(self):
        # Wed 14 -> Sun 11 (Mon and Tue are skipped). Sun 18 -> Fri 16 -> Wed 14.
        self.assertEqual(cadence.previous_slot_day(VIDP4, date(2026, 10, 14)), date(2026, 10, 11))
        self.assertEqual(cadence.previous_slot_day(VIDP4, date(2026, 10, 18)), date(2026, 10, 16))
        self.assertEqual(cadence.previous_slot_day(VIDP4, date(2026, 10, 16)), date(2026, 10, 14))

    def test_vidp4_non_slot_days_look_back_to_sunday(self):
        self.assertEqual(cadence.previous_slot_day(VIDP4, date(2026, 10, 12)), date(2026, 10, 11))  # Mon -> Sun
        self.assertEqual(cadence.previous_slot_day(VIDP4, date(2026, 10, 13)), date(2026, 10, 11))  # Tue -> Sun

    def test_vidqp_saturday_to_tuesday_gap(self):
        # Tue 13 -> Sat 10 (Sun and Mon are skipped). Sat 17 -> Thu 15 -> Tue 13.
        self.assertEqual(cadence.previous_slot_day(VIDQP, date(2026, 10, 13)), date(2026, 10, 10))
        self.assertEqual(cadence.previous_slot_day(VIDQP, date(2026, 10, 17)), date(2026, 10, 15))
        self.assertEqual(cadence.previous_slot_day(VIDQP, date(2026, 10, 15)), date(2026, 10, 13))

    def test_vidqp_non_slot_days_look_back(self):
        self.assertEqual(cadence.previous_slot_day(VIDQP, date(2026, 10, 12)), date(2026, 10, 10))  # Mon -> Sat
        self.assertEqual(cadence.previous_slot_day(VIDQP, date(2026, 10, 14)), date(2026, 10, 13))  # Wed -> Tue


class CatchUpAcrossWeekWrap(unittest.TestCase):
    # Approved Sat 10 Oct 15:30 IST: waiting before the Sun 11 Oct slot.
    HEAD = {'id': 'h', 'story_number': 80, 'status': 'approved', 'approved_at': '2026-10-10T10:00:00+00:00'}

    def test_missed_sunday_catches_up_on_wednesday_at_0700(self):
        # Sun 11 Oct 19:30 IST slot missed. Wed 14 Oct 08:00 IST: catch-up due.
        now = utc('2026-10-14T02:30:00')
        sb = FakeSB(now)  # no posts at all
        self.assertTrue(cadence.catchup_due(sb, VIDP4, now, self.HEAD))
        self.assertTrue(cadence.slot_status(VIDP4, now, catchup=True)[0])
        # 06:59 IST on Wed is still before the catch-up opens.
        self.assertFalse(cadence.slot_status(VIDP4, utc('2026-10-14T01:29:00'), catchup=True)[0])

    def test_sunday_post_means_no_catchup_on_wednesday(self):
        now = utc('2026-10-14T02:30:00')
        sb = FakeSB(now, video_posts=[{
            'id': 'sun', 'status': 'posted_both', 'posted_at': '2026-10-11T14:10:00+00:00',
            'ig_posted_at': '2026-10-11T14:10:00+00:00', 'yt_posted_at': '2026-10-11T14:11:00+00:00'}])
        self.assertFalse(cadence.catchup_due(sb, VIDP4, now, self.HEAD))

    def test_monday_after_missed_sunday_has_no_catchup_slot(self):
        # Mon is not a VID-P4 day, so catch-up cannot open a slot on Mon.
        self.assertFalse(cadence.slot_status(VIDP4, utc('2026-10-12T02:30:00'), catchup=True)[0])

    def test_vidqp_has_no_catchup(self):
        now = utc('2026-10-13T02:30:00')
        self.assertFalse(cadence.catchup_due(FakeSB(now), VIDQP, now, {'id': 'q', 'approved_at': None}))


class WatchdogJudgesPostingDaysOnly(unittest.TestCase):
    def _judge(self, run: str, pipeline):
        sent = []
        summary = cadence.check_missed_slot(None, pipeline, utc(run), lambda p, d, rows: sent.append(rows))
        return summary, sent

    def test_monday_run_judging_sunday_is_a_slot_check(self):
        # Mon 12 Oct 00:15 UTC judges Sun 11 Oct, a VID-P4 day, so the DB is consulted.
        # Not exercised here (needs a DB); assert the day that would be judged.
        self.assertEqual(cadence.watchdog_slot_day(utc('2026-10-12T00:15:00')), date(2026, 10, 11))
        self.assertTrue(cadence.is_slot_day(VIDP4, date(2026, 10, 11)))

    def test_vidp4_quiet_on_non_slot_days(self):
        # Runs judging Mon 12, Tue 13, Thu 15 and Sat 17 (none is a VID-P4 day).
        for run in ['2026-10-13T00:15:00', '2026-10-14T00:15:00', '2026-10-16T00:15:00', '2026-10-18T00:15:00']:
            summary, sent = self._judge(run, VIDP4)
            self.assertEqual(summary['action'], 'not_a_slot_day', run)
            self.assertEqual(sent, [], run)

    def test_vidqp_quiet_on_non_slot_days(self):
        # Runs judging Mon 12, Wed 14, Fri 16 and Sun 18 (none is a VID-QP day).
        for run in ['2026-10-13T00:15:00', '2026-10-15T00:15:00', '2026-10-17T00:15:00', '2026-10-19T00:15:00']:
            summary, sent = self._judge(run, VIDQP)
            self.assertEqual(summary['action'], 'not_a_slot_day', run)
            self.assertEqual(sent, [], run)

    def test_slot_days_are_judged_by_the_next_run(self):
        # Thu 15 run judges Wed 14 (VID-P4); Sat 17 run judges Fri 16 (VID-P4);
        # Mon 19 run judges Sun 18 (VID-P4). Tue 13 run judges Mon 12 (VID-QP quiet, above).
        for run, judged in [('2026-10-15T00:15:00', date(2026, 10, 14)),
                            ('2026-10-17T00:15:00', date(2026, 10, 16)),
                            ('2026-10-19T00:15:00', date(2026, 10, 18))]:
            self.assertEqual(cadence.watchdog_slot_day(utc(run)), judged, run)
            self.assertTrue(cadence.is_slot_day(VIDP4, judged), run)


class GenerationBank(unittest.TestCase):
    FRI = utc('2026-10-16T10:00:00')  # Fri 2026-10-16 15:30 IST
    SUN = utc('2026-10-18T10:00:00')  # Sun 2026-10-18 15:30 IST

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

    def test_bank_decision_does_not_depend_on_the_weekday(self):
        # The bank limit is a count. Every weekday gives the same answer for the same count.
        for d, name in WEEK:
            at = utc(f'{d.isoformat()}T10:00:00')
            self.assertFalse(generation_bank.decide(4, at)[0], name)
            self.assertTrue(generation_bank.decide(3, at)[0], name)

    def test_count_uses_approved_rows_only(self):
        rows = [{'id': 'a', 'status': 'approved'}, {'id': 'b', 'status': 'approved'},
                {'id': 'c', 'status': 'posted_both'}, {'id': 'd', 'status': 'pending_approval'}]
        self.assertEqual(generation_bank.count_approved(_CountSB(rows)), 2)

    def test_full_bank_on_friday_end_to_end(self):
        rows = [{'id': str(i), 'status': 'approved'} for i in range(4)]
        ok, line = generation_bank.bank_decision(_CountSB(rows), self.FRI)
        self.assertFalse(ok)
        self.assertIn('4 approved, unposted', line)

    def test_full_bank_on_sunday_end_to_end(self):
        rows = [{'id': str(i), 'status': 'approved'} for i in range(4)]
        ok, line = generation_bank.bank_decision(_CountSB(rows), self.SUN)
        self.assertFalse(ok)
        self.assertIn('skipped on Sun 2026-10-18', line)


if __name__ == '__main__':
    unittest.main()
