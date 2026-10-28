// Price history view (H5, flag off): coverage, the 48-hour trailing rule, stock state, and the lowest-in-90-days marker.
import { describe, it, expect } from 'vitest';
import { buildStoreHistories, dateLabel, DAY_MS, STALE_MS, type HistoryRow } from '../src/lib/price-history-view';

const NOW = Date.parse('2026-10-28T06:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * DAY_MS).toISOString();
const row = (store_id: string, price: number | null, in_stock: boolean | null, days: number): HistoryRow =>
  ({ store_id, price_inr: price, in_stock, recorded_at: daysAgo(days) });

describe('coverage', () => {
  it('a store whose first row is older than 90 days has coverage', () => {
    const v = buildStoreHistories([row('lego', 1000, true, 120), row('lego', 900, true, 10)], NOW);
    expect(v[0].coverage90).toBe(true);
    expect(v[0].spanFrom).toBe(NOW - 90 * DAY_MS);
  });
  it('a store whose first row is younger than 90 days has no coverage: the span starts at its first row, no marker', () => {
    const first = daysAgo(30);
    const v = buildStoreHistories([row('lego', 1000, true, 30), row('lego', 900, true, 2)], NOW);
    expect(v[0].coverage90).toBe(false);
    expect(v[0].spanFrom).toBe(Date.parse(first));
    expect(v[0].lowest90).toBe(false);
  });
});

describe('segments', () => {
  it('uses the baseline row before the window and the change rows after it (step series)', () => {
    const v = buildStoreHistories([row('lego', 1200, true, 200), row('lego', 1000, true, 40), row('lego', 900, true, 1)], NOW);
    const s = v[0].segments;
    expect(s[0]).toMatchObject({ from: NOW - 90 * DAY_MS, price: 1200 });
    expect(s[1]).toMatchObject({ price: 1000 });
    expect(s[2]).toMatchObject({ price: 900 });
    expect(s[s.length - 1].to).toBe(NOW); // the last row is fresh, so the line reaches today
  });
  it('the trailing line stops 48 hours after a stale last row, never at today', () => {
    const v = buildStoreHistories([row('lego', 900, true, 10)], NOW);
    const s = v[0].segments;
    expect(s[s.length - 1].to).toBe(Date.parse(daysAgo(10)) + STALE_MS);
  });
  it('a null price is skipped and is not drawn', () => {
    const v = buildStoreHistories([row('lego', 1000, true, 100), row('lego', null, null, 50), row('lego', 900, true, 5)], NOW);
    expect(v[0].segments.every((s) => s.price != null)).toBe(true);
  });
});

describe('the lowest-in-90-days marker', () => {
  it('shows only when the current in-stock price is the lowest of a full 90 days with coverage', () => {
    const v = buildStoreHistories([row('lego', 1200, true, 200), row('lego', 1000, true, 40), row('lego', 900, true, 1)], NOW);
    expect(v[0].lowest90).toBe(true);
  });
  it('no marker when a higher price in the window was lower-or-equal to the current one', () => {
    const v = buildStoreHistories([row('lego', 800, true, 80), row('lego', 900, true, 1)], NOW);
    expect(v[0].lowest90).toBe(false);
  });
  it('no marker when the current price is out of stock (an out-of-stock price is never a low)', () => {
    const v = buildStoreHistories([row('lego', 1200, true, 200), row('lego', 900, false, 1)], NOW);
    expect(v[0].lowest90).toBe(false);
  });
  it('no marker when the stock state of a row in the window is unknown (null)', () => {
    const v = buildStoreHistories([row('lego', 1200, null, 200), row('lego', 900, true, 1)], NOW);
    expect(v[0].lowest90).toBe(false);
  });
  it('no marker when the store has less than 90 days of history, even if its price is the lowest seen', () => {
    const v = buildStoreHistories([row('lego', 900, true, 30), row('lego', 800, true, 1)], NOW);
    expect(v[0].lowest90).toBe(false);
  });
  it('no marker when the last row is older than 48 hours (not current)', () => {
    const v = buildStoreHistories([row('lego', 1200, true, 200), row('lego', 900, true, 5)], NOW);
    expect(v[0].lowest90).toBe(false);
  });
});

describe('per store, and input order', () => {
  it('each store is judged on its own rows; input order does not matter', () => {
    const rows = [row('lego', 1200, true, 200), row('toycra', 700, true, 200), row('toycra', 700, true, 1), row('lego', 900, true, 1)];
    const a = buildStoreHistories(rows, NOW);
    const b = buildStoreHistories([...rows].reverse(), NOW);
    expect(a.map((s) => [s.store_id, s.lowest90])).toEqual(b.map((s) => [s.store_id, s.lowest90]));
    expect(a.find((s) => s.store_id === 'toycra')!.lowest90).toBe(true);
    expect(a.find((s) => s.store_id === 'lego')!.lowest90).toBe(true);
  });
  it('an empty input gives no stores', () => {
    expect(buildStoreHistories([], NOW)).toEqual([]);
  });
});

describe('dateLabel', () => {
  it('formats a date without the locale (Netlify ICU)', () => {
    expect(dateLabel(Date.parse('2026-10-18T00:00:00Z'))).toBe('18 Oct 2026');
  });
});
