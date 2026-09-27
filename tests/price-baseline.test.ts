import { describe, it, expect } from 'vitest';
import { baselinePrices, type HistRow } from '../src/lib/price-baseline';

// #383: the baseline is the price AT the window start (latest row <= since),
// not the oldest row inside the window.
const NOW = Date.parse('2026-11-15T00:00:00Z');
const dAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const row = (price: number, daysAgo: number, set = '10294', store = 'mybrickhouse'): HistRow =>
  ({ set_id: set, store_id: store, price_inr: price, recorded_at: dAgo(daysAgo) });

describe('baselinePrices (#383)', () => {
  it('only pre-window row is older than 30 days, drop inside the window: baseline is the OLD price', () => {
    // change-only history: 64,999 first seen 45 days ago, dropped to 54,999 10 days ago.
    const pre = [row(64999, 45)];
    const inWin = [row(54999, 10)];
    const b = baselinePrices(pre, inWin);
    expect(b.get('10294:mybrickhouse')).toBe(64999);
    // the old rule (oldest row in the window) would have said 54,999 and hidden the drop:
    expect(inWin[0].price_inr).toBe(54999);
  });
  it('uses the LATEST pre-window row when several exist (input newest first)', () => {
    const b = baselinePrices([row(60000, 35), row(70000, 90)], []);
    expect(b.get('10294:mybrickhouse')).toBe(60000);
  });
  it('falls back to the oldest in-window row for a listing first seen inside the window', () => {
    const b = baselinePrices([], [row(5000, 20, '42236', 'toycra'), row(4500, 5, '42236', 'toycra')]);
    expect(b.get('42236:toycra')).toBe(5000);
  });
  it('unchanged price for > 30 days: no in-window row, baseline still found (no drop = current)', () => {
    const b = baselinePrices([row(3000, 120)], []);
    expect(b.get('10294:mybrickhouse')).toBe(3000);
  });
  it('keys by set AND store, and skips null prices', () => {
    const b = baselinePrices([row(100, 40, 'a', 's1'), { ...row(0, 41, 'a', 's2'), price_inr: null }, row(200, 42, 'a', 's2')], []);
    expect(b.get('a:s1')).toBe(100);
    expect(b.get('a:s2')).toBe(200);
  });
});
