"""Order 1944 item 5 (PR 993): the owner email for a Quiet Panic row that becomes publish_blocked, sent once per row."""
import os
import types
import unittest

import qp_blocked_notice as qbn


class FakeTable:
    def __init__(self, db, name):
        self.db, self.name = db, name
        self._op = None
        self._filter = None

    def select(self, _cols):
        self._op = 'select'
        return self

    def eq(self, col, val):
        self._filter = (col, val)
        return self

    def limit(self, _n):
        return self

    def upsert(self, row):
        self._op = 'upsert'
        self._row = row
        return self

    def execute(self):
        if self.db.fail_reads and self._op == 'select':
            raise RuntimeError('read down')
        rows = self.db.rows.setdefault(self.name, [])
        if self._op == 'select':
            col, val = self._filter
            return types.SimpleNamespace(data=[r for r in rows if r.get(col) == val])
        if self._op == 'upsert':
            rows[:] = [r for r in rows if r['key'] != self._row['key']] + [self._row]
            return types.SimpleNamespace(data=[self._row])
        raise AssertionError('unexpected op')


class FakeSB:
    def __init__(self, fail_reads=False):
        self.rows, self.fail_reads = {}, fail_reads

    def table(self, name):
        return FakeTable(self, name)


class Sender:
    def __init__(self, fail=False):
        self.calls, self.fail = [], fail

    def __call__(self, **kw):
        if self.fail:
            raise RuntimeError('resend down')
        self.calls.append(kw)


class NotifyBlockedTests(unittest.TestCase):
    def test_sends_once_per_row_and_records_the_key(self):
        sb, send = FakeSB(), Sender()
        self.assertTrue(qbn.notify_blocked(sb, 'row-1', reason='gate', send=send))
        self.assertFalse(qbn.notify_blocked(sb, 'row-1', reason='gate', send=send))
        self.assertEqual(len(send.calls), 1)
        self.assertEqual(sb.rows['alert_state'][0]['key'], 'qp-blocked:row-1')

    def test_each_row_gets_its_own_email(self):
        sb, send = FakeSB(), Sender()
        qbn.notify_blocked(sb, 'row-1', reason='a', send=send)
        qbn.notify_blocked(sb, 'row-2', reason='b', send=send)
        self.assertEqual([c['row_id'] for c in send.calls], ['row-1', 'row-2'])

    def test_send_failure_records_nothing_and_the_next_run_retries(self):
        sb = FakeSB()
        self.assertFalse(qbn.notify_blocked(sb, 'row-1', reason='gate', send=Sender(fail=True)))
        self.assertEqual(sb.rows.get('alert_state', []), [])
        send = Sender()
        self.assertTrue(qbn.notify_blocked(sb, 'row-1', reason='gate', send=send))
        self.assertEqual(len(send.calls), 1)

    def test_unreadable_record_sends_nothing(self):
        send = Sender()
        self.assertFalse(qbn.notify_blocked(FakeSB(fail_reads=True), 'row-1', reason='gate', send=send))
        self.assertEqual(send.calls, [])

    def test_reason_and_set_are_passed_to_the_sender(self):
        send = Sender()
        qbn.notify_blocked(FakeSB(), 'row-9', reason='coherence judge did not pass', set_title='Bugatti', set_number='42', send=send)
        self.assertEqual(send.calls[0], {'row_id': 'row-9', 'reason': 'coherence judge did not pass', 'set_title': 'Bugatti', 'set_number': '42'})


class EveryWriterCallsTheHelperTests(unittest.TestCase):
    """Each writer that sets publish_blocked must call the one helper (order 1944 item 5)."""

    def read(self, name):
        with open(os.path.join(os.path.dirname(__file__), name), encoding='utf-8') as f:
            return f.read()

    def test_publish_hard_guard_writer(self):
        self.assertIn('notify_blocked(sb, pid', self.read('publish_quiet_panic.py'))

    def test_generate_insert_writer_and_rework(self):
        src = self.read('generate_quiet_panic_video.py')
        self.assertIn("if status == 'publish_blocked':", src)
        self.assertIn('notify_blocked(sb, post_id', src)

    def test_rejudge_writer(self):
        self.assertIn("if patch.get('status') == 'publish_blocked':", self.read('rejudge_quiet_panic.py'))


if __name__ == '__main__':
    unittest.main()