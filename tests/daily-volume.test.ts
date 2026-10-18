// Daily volume from a cumulative count: a decrease is a reset, never a negative volume.
import { describe, it, expect } from 'vitest';
// @ts-ignore plain module, no types needed
import { dailyVolume } from '../scripts/ops/daily-volume.mjs';

describe('daily volume from a cumulative count', () => {
  it('a normal day is the change between readings', () => {
    const r = [
      { at: '2026-10-17T03:00:00Z', count: 1000 },
      { at: '2026-10-18T03:00:00Z', count: 1450 },
    ];
    expect(dailyVolume(r)).toEqual([{ day: '2026-10-18', volume: 450 }]);
  });

  it('a decrease is a reset: the volume is the new reading, not a negative number', () => {
    const r = [
      { at: '2026-10-17T03:00:00Z', count: 90000 },
      { at: '2026-10-18T03:00:00Z', count: 120 },
    ];
    const v = dailyVolume(r);
    expect(v).toEqual([{ day: '2026-10-18', volume: 120 }]);
    expect(v.every((row: { volume: number }) => row.volume >= 0)).toBe(true);
  });

  it('readings out of order are sorted first', () => {
    const r = [
      { at: '2026-10-18T03:00:00Z', count: 1450 },
      { at: '2026-10-17T03:00:00Z', count: 1000 },
    ];
    expect(dailyVolume(r)).toEqual([{ day: '2026-10-18', volume: 450 }]);
  });

  it('one reading gives no volume', () => {
    expect(dailyVolume([{ at: '2026-10-17T03:00:00Z', count: 5 }])).toEqual([]);
  });
});
