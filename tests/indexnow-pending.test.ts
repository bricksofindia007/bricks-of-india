import { describe, it, expect } from 'vitest';
import { isPending, selectForRun, chunk, MAX_URLS_PER_REQUEST, MAX_URLS_PER_RUN, UPDATE_BATCH, CHANGE_MARGIN_MS } from '../scripts/lib/indexnow-pending';

describe('change margin (the stamp we write moves updated_at)', () => {
  const submitted = '2026-10-14T06:00:00.000Z';
  const plusMs = (ms: number) => new Date(Date.parse(submitted) + ms).toISOString();

  it('the margin is five minutes', () => {
    expect(CHANGE_MARGIN_MS).toBe(5 * 60 * 1000);
  });

  it('is not pending when updated_at moved only by the trigger, a few milliseconds after the stamp', () => {
    expect(isPending({ updated_at: plusMs(40), indexnow_submitted_at: submitted })).toBe(false);
  });

  it('is not pending four minutes after the stamp', () => {
    expect(isPending({ updated_at: plusMs(4 * 60_000), indexnow_submitted_at: submitted })).toBe(false);
  });

  it('is not pending at exactly five minutes after the stamp', () => {
    expect(isPending({ updated_at: plusMs(5 * 60_000), indexnow_submitted_at: submitted })).toBe(false);
  });

  it('is pending six minutes after the stamp', () => {
    expect(isPending({ updated_at: plusMs(6 * 60_000), indexnow_submitted_at: submitted })).toBe(true);
  });

  it('a set marked as submitted is not pending on the next run (stamp, then trigger)', () => {
    const stamp = submitted;
    const afterTrigger = plusMs(25); // the UPDATE sets updated_at = now() a moment later
    expect(isPending({ updated_at: afterTrigger, indexnow_submitted_at: stamp })).toBe(false);
  });
});

describe('selectForRun (cap and order)', () => {
  const row = (n: number, submitted: string | null, updated: string) => ({
    set_number: String(n).padStart(5, '0'), updated_at: updated, indexnow_submitted_at: submitted,
  });

  it('caps at MAX_URLS_PER_RUN and is 5,000', () => {
    expect(MAX_URLS_PER_RUN).toBe(5_000);
  });

  it('sends never-submitted sets first, then the oldest changes', () => {
    const rows = [
      row(3, '2026-10-01T00:00:00Z', '2026-10-10T00:00:00Z'), // changed, newer
      row(2, null, '2026-10-01T00:00:00Z'),                    // never
      row(1, '2026-10-01T00:00:00Z', '2026-10-05T00:00:00Z'), // changed, oldest change
      row(4, null, '2026-10-02T00:00:00Z'),                    // never
    ];
    expect(selectForRun(rows, 10).map((r) => r.set_number)).toEqual(['00002', '00004', '00001', '00003']);
  });

  it('never-submitted sets are ordered by set number', () => {
    const rows = [row(9, null, '2026-10-01T00:00:00Z'), row(2, null, '2026-10-01T00:00:00Z')];
    expect(selectForRun(rows, 10).map((r) => r.set_number)).toEqual(['00002', '00009']);
  });

  it('caps a large backlog: all never-submitted first, then the oldest changes fill the rest', () => {
    const never = Array.from({ length: 600 }, (_, i) => row(100_000 + i, null, '2026-10-01T00:00:00Z'));
    const changed = Array.from({ length: 6_000 }, (_, i) =>
      row(200_000 + i, '2026-09-01T00:00:00Z', new Date(Date.UTC(2026, 9, 1) + i * 60_000).toISOString()));
    const picked = selectForRun([...changed, ...never], MAX_URLS_PER_RUN);
    expect(picked.length).toBe(5_000);
    expect(picked.slice(0, 600).every((r) => r.indexnow_submitted_at == null)).toBe(true);
    // the first changed row picked is the oldest change (i = 0)
    expect(picked[600].set_number).toBe('200000');
    // the newest changes are the ones left for later runs
    expect(picked.find((r) => r.set_number === '205999')).toBeUndefined();
  });

  it('returns nothing for an empty list', () => {
    expect(selectForRun([], 5_000)).toEqual([]);
  });
});

describe('isPending', () => {
  it('is pending when never submitted', () => {
    expect(isPending({ updated_at: '2026-10-01T00:00:00Z', indexnow_submitted_at: null })).toBe(true);
  });

  it('is pending when changed after its last submission', () => {
    expect(isPending({ updated_at: '2026-10-02T00:00:00Z', indexnow_submitted_at: '2026-10-01T00:00:00Z' })).toBe(true);
  });

  it('is not pending when submitted after its last change', () => {
    expect(isPending({ updated_at: '2026-10-01T00:00:00Z', indexnow_submitted_at: '2026-10-02T00:00:00Z' })).toBe(false);
  });

  it('is not pending when the times are equal', () => {
    expect(isPending({ updated_at: '2026-10-01T00:00:00Z', indexnow_submitted_at: '2026-10-01T00:00:00Z' })).toBe(false);
  });

  it('compares instants, not strings (offset forms of the same moment)', () => {
    // 05:30 IST is the same instant as 00:00 UTC: not changed after submission.
    expect(isPending({ updated_at: '2026-10-01T05:30:00+05:30', indexnow_submitted_at: '2026-10-01T00:00:00Z' })).toBe(false);
  });

  it('is not pending when updated_at is missing and the set was submitted', () => {
    expect(isPending({ updated_at: null, indexnow_submitted_at: '2026-10-01T00:00:00Z' })).toBe(false);
  });
});

describe('chunk', () => {
  it('splits at the per-request limit without losing or repeating items', () => {
    const items = Array.from({ length: 25_001 }, (_, i) => i);
    const parts = chunk(items, MAX_URLS_PER_REQUEST);
    expect(parts.map((p) => p.length)).toEqual([10_000, 10_000, 5_001]);
    expect(parts.flat()).toEqual(items);
  });

  it('returns no parts for an empty list', () => {
    expect(chunk([], UPDATE_BATCH)).toEqual([]);
  });

  it('keeps an exact multiple as full parts', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });
});
