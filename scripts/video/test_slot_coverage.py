"""Tests for slot_coverage (stdlib unittest, no network, no database).

The replay cases use the outcome recorded for each slot date (posted, pending,
blocked or nothing produced). They are fixed inputs, not a database read.
"""
import unittest
from datetime import datetime, timezone

import slot_coverage as sc

IST = sc.IST


def ist(y, mo, d, h, mi):
    return datetime(y, mo, d, h, mi, tzinfo=IST)


def utc(dt):
    return dt.astimezone(timezone.utc)


class SlotTimes(unittest.TestCase):
    def test_wednesday_p4_slot_is_1930_ist(self):
        self.assertEqual(sc.slot_start_ist('VID-P4', ist(2026, 11, 11, 0, 0).date()), ist(2026, 11, 11, 19, 30))

    def test_monday_is_not_a_p4_or_qp_slot_day(self):
        self.assertFalse(sc.is_slot_day('VID-P4', ist(2026, 11, 16, 0, 0).date()))
        self.assertFalse(sc.is_slot_day('VID-QP', ist(2026, 11, 16, 0, 0).date()))
        self.assertTrue(sc.is_slot_day('SOCIAL', ist(2026, 11, 16, 0, 0).date()))

    def test_latest_due_slot_waits_for_the_hours(self):
        # QP slot Tue 10 Nov 00:00 IST is due at 18:00 IST (18 h). At 17:59 the previous due slot is returned.
        at_1759 = utc(ist(2026, 11, 10, 17, 59))
        self.assertEqual(sc.latest_due_slot('VID-QP', at_1759), ist(2026, 11, 7, 0, 0))  # Sat 7 Nov
        at_1800 = utc(ist(2026, 11, 10, 18, 0))
        self.assertEqual(sc.latest_due_slot('VID-QP', at_1800), ist(2026, 11, 10, 0, 0))


class Decision(unittest.TestCase):
    slot = ist(2026, 11, 12, 0, 0)  # a QP slot

    def test_a_post_in_the_window_means_no_alert(self):
        facts = sc.Facts(posted=[{'row_number': 1}])
        self.assertIsNone(sc.decide('VID-QP', self.slot, utc(ist(2026, 11, 12, 18, 0)), facts))

    def test_not_due_yet_means_no_alert(self):
        self.assertIsNone(sc.decide('VID-QP', self.slot, utc(ist(2026, 11, 12, 17, 59)), sc.Facts()))

    def test_no_row_at_all_is_nothing_produced_with_cause_not_known(self):
        a = sc.decide('VID-QP', self.slot, utc(ist(2026, 11, 12, 18, 0)), sc.Facts())
        self.assertEqual(a.kind, 'nothing')
        text = '\n'.join(a.body_lines)
        self.assertIn('cause not known', text)
        self.assertIn('Owner must act: yes.', text)
        self.assertIn('Visitors affected: not known', text)
        self.assertIn('hours without a post', text)

    def test_blocked_row_names_the_row_and_its_reason(self):
        facts = sc.Facts(blocked=[{'row_number': 45, 'status': 'publish_blocked', 'reason': 'banned term'}])
        a = sc.decide('VID-QP', self.slot, utc(ist(2026, 11, 12, 18, 0)), facts)
        self.assertEqual(a.kind, 'blocked')
        self.assertIn('#45 (publish_blocked): banned term', '\n'.join(a.body_lines))

    def test_pending_row_says_waiting_for_owner_approval(self):
        facts = sc.Facts(pending=[{'row_number': 83, 'set_title': 'x'}])
        a = sc.decide('VID-P4', ist(2026, 11, 13, 19, 30), utc(ist(2026, 11, 14, 7, 30)), facts)
        self.assertEqual(a.kind, 'pending')
        self.assertIn('waiting for owner approval: #83', '\n'.join(a.body_lines))

    def test_one_key_per_slot(self):
        a = sc.decide('VID-QP', self.slot, utc(ist(2026, 11, 12, 18, 0)), sc.Facts())
        self.assertEqual(a.key, 'slot-no-post:VID-QP:2026-11-12 00:00')

    def test_email_names_slot_and_threshold(self):
        a = sc.decide('SOCIAL', ist(2026, 11, 16, 12, 0), utc(ist(2026, 11, 17, 0, 0)), sc.Facts())
        self.assertIn('Weekly social post slot missed', a.subject)
        self.assertIn('no post after 12 hours', a.subject)


class ReplayOfRealSlots(unittest.TestCase):
    """Replay of 10 to 16 Nov 2026 with the recorded outcome of each slot.

    Each case: (pipeline, slot start IST, check time IST, facts, expected kind or None).
    """

    def test_replay(self):
        cases = [
            # 10 Nov, QP slot 00:00: a post went live at 07:07 IST. Check at 18:00.
            ('VID-QP', ist(2026, 11, 10, 0, 0), ist(2026, 11, 10, 18, 0),
             sc.Facts(posted=[{'row_number': 'bank'}]), None),
            # 11 Nov, P4 slot 19:30: a post went live at 23:32 IST. Check at 07:30 on 12 Nov.
            ('VID-P4', ist(2026, 11, 11, 19, 30), ist(2026, 11, 12, 7, 30),
             sc.Facts(posted=[{'row_number': 82}]), None),
            # 12 Nov, QP slot 00:00: nothing posted. A row was blocked by a gate, with its reason.
            ('VID-QP', ist(2026, 11, 12, 0, 0), ist(2026, 11, 12, 18, 0),
             sc.Facts(blocked=[{'row_number': 'QP-row', 'status': 'publish_blocked',
                                'reason': 'banned term (architectural)'}]), 'blocked'),
            # 13 Nov, P4 slot 19:30: nothing posted; one row waits for owner approval, and an
            # approved row is not posted. Check at 07:30 on 14 Nov.
            ('VID-P4', ist(2026, 11, 13, 19, 30), ist(2026, 11, 14, 7, 30),
             sc.Facts(pending=[{'row_number': 83}], blocked=[{'row_number': 81, 'status': 'approved, not posted',
                                                             'reason': 'not recorded in this replay'}]), 'blocked'),
            # 14 Nov, QP slot 00:00: nothing posted and no row at the 18:00 check. Nothing produced.
            ('VID-QP', ist(2026, 11, 14, 0, 0), ist(2026, 11, 14, 18, 0), sc.Facts(), 'nothing'),
            # 16 Nov, social slot 12:00: a post went live at 21:52 IST. Check at 24:00 (00:00 on 17 Nov).
            ('SOCIAL', ist(2026, 11, 16, 12, 0), ist(2026, 11, 17, 0, 0),
             sc.Facts(posted=[{'row_number': 'social'}]), None),
        ]
        for key, start, check, facts, expected in cases:
            with self.subTest(key=key, slot=start.isoformat()):
                a = sc.decide(key, start, utc(check), facts)
                got = None if a is None else a.kind
                self.assertEqual(got, expected)


if __name__ == '__main__':
    unittest.main()
