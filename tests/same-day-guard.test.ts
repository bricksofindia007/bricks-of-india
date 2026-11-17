import { describe, it, expect } from 'vitest';
import { decide, istDay } from '../scripts/ci/same-day-guard.mjs';

// Order 1060: a scheduled or Worker-dispatched run is skipped only when an earlier run of the same IST day succeeded
// or is still running. The earliest run goes ahead; a failed slot gets its one retry.
const MINE = '2026-11-08T00:31:00Z';                    // 06:01 IST, Sunday 8 Nov

const run = (id: number, createdAt: string, status: string, conclusion: string | null) =>
  ({ databaseId: id, createdAt, status, conclusion });

describe('same-day guard (order 1060)', () => {
  it('the IST day is taken from UTC plus 5h30', () => {
    expect(istDay('2026-11-08T00:31:00Z')).toBe('2026-11-08'); // 06:01 IST, 8 Nov
    expect(istDay('2026-11-07T18:20:00Z')).toBe('2026-11-07'); // 23:50 IST, still 7 Nov
    expect(istDay('2026-11-07T18:40:00Z')).toBe('2026-11-08'); // 00:10 IST, 8 Nov
  });

  it('skips a duplicate when an earlier run today succeeded', () => {
    const d = decide({ runId: 2, mine: MINE, runs: [run(1, '2026-11-08T00:30:05Z', 'completed', 'success')] });
    // the earlier run is 00:30:05 UTC, before MINE (00:31) -> this run is the duplicate
    expect(d.run).toBe(false);
    expect(d.reason).toMatch(/earlier run 1 today is success/);
  });

  it('skips a duplicate when an earlier run today is still running', () => {
    const d = decide({ runId: 2, mine: MINE, runs: [run(1, '2026-11-08T00:30:05Z', 'in_progress', null)] });
    expect(d.run).toBe(false);
  });

  it('lets the run go ahead when the only earlier run failed (one retry)', () => {
    const d = decide({ runId: 2, mine: MINE, runs: [run(1, '2026-11-08T00:30:05Z', 'completed', 'failure')] });
    expect(d.run).toBe(true);
  });

  it('lets the earliest run go ahead, even when a later run succeeded', () => {
    const d = decide({ runId: 1, mine: '2026-11-08T00:30:05Z', runs: [run(2, MINE, 'completed', 'success')] });
    expect(d.run).toBe(true);
  });

  it('ignores an earlier run from the previous IST day', () => {
    const d = decide({ runId: 2, mine: MINE, runs: [run(1, '2026-11-07T18:20:00Z', 'completed', 'success')] });
    expect(d.run).toBe(true);
  });

  it('never counts the current run as its own duplicate', () => {
    const d = decide({ runId: 2, mine: MINE, runs: [run(2, '2026-11-08T00:30:05Z', 'in_progress', null)] });
    expect(d.run).toBe(true);
  });

  it('with no runs listed, the run goes ahead', () => {
    expect(decide({ runId: 2, mine: MINE, runs: [] }).run).toBe(true);
  });
});
