import { describe, it, expect } from 'vitest';
// @ts-ignore -- plain .mjs module
import { cycleStart, cycleEnd, estimateCycleUsage, level, CALLS_PER_REQUEST, EGRESS_BYTES_PER_REQUEST } from '../scripts/lib/capacity-estimate.mjs';

const d = (s: string) => new Date(s);

describe('billing cycle', () => {
  it('anchors on the 11th', () => {
    expect(cycleStart(d('2026-09-26T12:00:00Z')).toISOString()).toBe('2026-09-11T00:00:00.000Z');
    expect(cycleStart(d('2026-10-05T12:00:00Z')).toISOString()).toBe('2026-09-11T00:00:00.000Z');
    expect(cycleStart(d('2026-01-03T00:00:00Z')).toISOString()).toBe('2025-12-11T00:00:00.000Z');
    expect(cycleEnd(d('2026-09-11T00:00:00Z')).toISOString()).toBe('2026-10-11T00:00:00.000Z');
  });
});

describe('estimateCycleUsage', () => {
  const now = d('2026-09-21T00:00:00Z'); // 10 days into the cycle
  it('needs two snapshots', () => {
    expect(estimateCycleUsage([{ taken_at: '2026-09-20T00:00:00Z', api_calls: 5 }], now).ok).toBe(false);
  });
  it('full coverage: sums growth and converts to bytes', () => {
    const calls = 1_000_000 * CALLS_PER_REQUEST;
    const e = estimateCycleUsage([
      { taken_at: '2026-09-11T00:00:00Z', api_calls: 0 },
      { taken_at: '2026-09-21T00:00:00Z', api_calls: calls },
    ], now);
    expect(e.ok).toBe(true);
    expect(e.extrapolated).toBe(false);
    expect(e.requests).toBe(1_000_000);
    expect(e.egressGB).toBeCloseTo((1_000_000 * EGRESS_BYTES_PER_REQUEST) / 1e9, 6);
    expect(e.projectedEgressGB).toBeCloseTo(e.egressGB * 3, 6); // 30-day cycle, day 10
  });
  it('counter reset counts the new value from zero', () => {
    const e = estimateCycleUsage([
      { taken_at: '2026-09-11T00:00:00Z', api_calls: 900 },
      { taken_at: '2026-09-16T00:00:00Z', api_calls: 1_000 },
      { taken_at: '2026-09-21T00:00:00Z', api_calls: 50 }, // reset in between
    ], now);
    expect(e.requests).toBe(Math.round(150 / CALLS_PER_REQUEST));
  });
  it('partial coverage extrapolates the observed rate', () => {
    const e = estimateCycleUsage([
      { taken_at: '2026-09-20T00:00:00Z', api_calls: 0 },
      { taken_at: '2026-09-21T00:00:00Z', api_calls: 22_500 },
    ], now);
    expect(e.extrapolated).toBe(true);
    expect(e.requests).toBe(100_000); // 10k/day observed x 10 elapsed days
  });
});

describe('level', () => {
  it('70/85 thresholds', () => {
    expect(level(69.9)).toBeNull();
    expect(level(70)).toBe('warning');
    expect(level(85)).toBe('critical');
  });
});
