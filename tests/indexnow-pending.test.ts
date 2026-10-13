import { describe, it, expect } from 'vitest';
import { isPending, chunk, MAX_URLS_PER_REQUEST, UPDATE_BATCH } from '../scripts/lib/indexnow-pending';

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
