import { describe, it, expect } from 'vitest';
import { PING_COLUMNS, PING_TIERS, CHANGED_WINDOW_HOURS, changedSince, pendingFromRows, type PingRow } from '../scripts/lib/indexnow-pending';

const row = (set_number: string, updated_at: string | null, indexnow_submitted_at: string | null): PingRow =>
  ({ set_number, name: `Set ${set_number}`, updated_at, indexnow_submitted_at });

describe('what the ping reads', () => {
  it('reads only the four columns it needs, for tier1 and tier2 only', () => {
    expect(PING_COLUMNS.split(',').sort()).toEqual(['indexnow_submitted_at', 'name', 'set_number', 'updated_at']);
    expect([...PING_TIERS]).toEqual(['tier1', 'tier2']);
  });

  it('the changed window is one day', () => {
    expect(CHANGED_WINDOW_HOURS).toBe(24);
    const now = Date.parse('2026-10-15T12:00:00Z');
    expect(changedSince(now)).toBe('2026-10-14T12:00:00.000Z');
  });
});

describe('pendingFromRows', () => {
  it('includes a set that was never sent', () => {
    expect(pendingFromRows([row('1', '2026-10-01T00:00:00Z', null)]).map((r) => r.set_number)).toEqual(['1']);
  });

  it('includes a set changed after it was last sent', () => {
    expect(pendingFromRows([row('2', '2026-10-15T08:00:00Z', '2026-10-15T06:00:00Z')]).map((r) => r.set_number)).toEqual(['2']);
  });

  it('excludes a set sent after its last change', () => {
    expect(pendingFromRows([row('3', '2026-10-15T05:00:00Z', '2026-10-15T06:00:00Z')])).toEqual([]);
  });

  it('excludes a set sent and never changed since (same instant)', () => {
    expect(pendingFromRows([row('4', '2026-10-15T06:00:00Z', '2026-10-15T06:00:00Z')])).toEqual([]);
  });

  it('a set with no change date and a send date is not pending', () => {
    expect(pendingFromRows([row('5', null, '2026-10-15T06:00:00Z')])).toEqual([]);
  });

  it('compares instants, not strings, so offsets do not mislead', () => {
    // 09:00 at +05:30 is 03:30 UTC, earlier than 06:00 UTC: not changed since the send.
    expect(pendingFromRows([row('6', '2026-10-15T09:00:00+05:30', '2026-10-15T06:00:00Z')])).toEqual([]);
  });

  it('drops a duplicate set number', () => {
    const out = pendingFromRows([row('7', null, null), row('7', null, null)]);
    expect(out).toHaveLength(1);
  });

  it('keeps the mix: never-sent and changed in one list, unchanged ones out', () => {
    const out = pendingFromRows([
      row('10', null, null),
      row('11', '2026-10-15T08:00:00Z', '2026-10-15T06:00:00Z'),
      row('12', '2026-10-15T05:00:00Z', '2026-10-15T06:00:00Z'),
    ]);
    expect(out.map((r) => r.set_number)).toEqual(['10', '11']);
  });
});
