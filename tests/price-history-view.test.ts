// Price history view (H5, flag off): freshness from the current store_prices row, coverage, stock state, and the marker.
import { describe, it, expect } from 'vitest';
import { buildStoreHistories, dateLabel, DAY_MS, STALE_MS, type CurrentPrice, type HistoryRow } from '../src/lib/price-history-view';

const NOW = Date.parse('2026-10-28T06:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * DAY_MS).toISOString();
const row = (store_id: string, price: number | null, in_stock: boolean | null, days: number): HistoryRow =>
  ({ store_id, price_inr: price, in_stock, recorded_at: daysAgo(days) });
const cur = (store_id: string, price: number | null, in_stock: boolean | null, scrapedDays: number): CurrentPrice =>
  ({ store_id, price_inr: price, in_stock, scraped_at: daysAgo(scrapedDays) });

// The usual fresh case: a store with 200 days of history, its last change 1 day ago, and a current row scraped 1 hour ago.
const freshCurrent = (store_id: string, price: number | null, in_stock: boolean | null) =>
  ({ store_id, price_inr: price, in_stock, scraped_at: new Date(NOW - 60 * 60 * 1000).toISOString() });

describe('coverage', () => {
  it('a store whose first row is older than 90 days has coverage', () => {
    const v = buildStoreHistories([row('lego', 1000, true, 120), row('lego', 900, true, 10)], [freshCurrent('lego', 900, true)], NOW);
    expect(v[0].coverage90).toBe(true);
    expect(v[0].spanFrom).toBe(NOW - 90 * DAY_MS);
  });
  it('a store whose first row is younger than 90 days has no coverage: no marker, the span starts at the first row', () => {
    const v = buildStoreHistories([row('lego', 1000, true, 30), row('lego', 900, true, 2)], [freshCurrent('lego', 900, true)], NOW);
    expect(v[0].coverage90).toBe(false);
    expect(v[0].spanFrom).toBe(Date.parse(daysAgo(30)));
    expect(v[0].lowest90).toBe(false);
  });
});

describe('the line (freshness from the current row)', () => {
  it('old last change, fresh scrape with the same price: the line runs to now', () => {
    // The last change was 10 days ago; the store still shows that price in a scrape 1 hour ago.
    const v = buildStoreHistories([row('lego', 1200, true, 200), row('lego', 900, true, 10)], [freshCurrent('lego', 900, true)], NOW);
    expect(v[0].trailingToNow).toBe(true);
    expect(v[0].segments[v[0].segments.length - 1].to).toBe(NOW);
  });
  it('stale scrape (older than 48 hours): the line stops at its scraped_at, and there is no marker', () => {
    const scraped = cur('lego', 900, true, 3); // scraped 3 days ago
    const v = buildStoreHistories([row('lego', 1200, true, 200), row('lego', 900, true, 10)], [scraped], NOW);
    expect(v[0].trailingToNow).toBe(false);
    expect(v[0].segments[v[0].segments.length - 1].to).toBe(Date.parse(scraped.scraped_at));
    expect(v[0].lowest90).toBe(false);
  });
  it('price mismatch between the current row and the last change: no marker, and the line stops at the last change', () => {
    const v = buildStoreHistories([row('lego', 1200, true, 200), row('lego', 900, true, 10)], [freshCurrent('lego', 950, true)], NOW);
    expect(v[0].trailingToNow).toBe(false);
    expect(v[0].segments[v[0].segments.length - 1].to).toBe(Date.parse(daysAgo(10)));
    expect(v[0].lowest90).toBe(false);
  });
  it('no current row for a store: its line stops at the last change and there is no marker', () => {
    const v = buildStoreHistories([row('lego', 1200, true, 200), row('lego', 900, true, 10)], [], NOW);
    expect(v[0].trailingToNow).toBe(false);
    expect(v[0].lowest90).toBe(false);
  });
});

describe('the lowest-in-90-days marker', () => {
  it('shows when the current in-stock price is the lowest of a full 90 days with coverage', () => {
    const v = buildStoreHistories([row('lego', 1200, true, 200), row('lego', 1000, true, 40), row('lego', 900, true, 10)], [freshCurrent('lego', 900, true)], NOW);
    expect(v[0].lowest90).toBe(true);
  });
  it('no marker when a higher price was lower than the current one in the window', () => {
    const v = buildStoreHistories([row('lego', 800, true, 80), row('lego', 900, true, 10)], [freshCurrent('lego', 900, true)], NOW);
    expect(v[0].lowest90).toBe(false);
  });
  it('no marker when the current row is out of stock', () => {
    const v = buildStoreHistories([row('lego', 1200, true, 200), row('lego', 900, false, 10)], [freshCurrent('lego', 900, false)], NOW);
    expect(v[0].lowest90).toBe(false);
  });
  it('an out-of-stock segment in the window neither counts toward the minimum nor blocks the marker', () => {
    // 700 was out of stock (known false): it must not be the minimum, and it must not block the marker.
    const v = buildStoreHistories(
      [row('lego', 1200, true, 200), row('lego', 700, false, 60), row('lego', 1000, true, 40), row('lego', 900, true, 10)],
      [freshCurrent('lego', 900, true)],
      NOW,
    );
    expect(v[0].lowest90).toBe(true);
  });
  it('an in-stock segment cheaper than the current price in the window means no marker', () => {
    const v = buildStoreHistories(
      [row('lego', 1200, true, 200), row('lego', 850, true, 60), row('lego', 900, true, 10)],
      [freshCurrent('lego', 900, true)],
      NOW,
    );
    expect(v[0].lowest90).toBe(false);
  });
  it('a null stock segment in the window blocks the marker (unknown is never a low)', () => {
    const v = buildStoreHistories(
      [row('lego', 1200, null, 200), row('lego', 900, true, 10)],
      [freshCurrent('lego', 900, true)],
      NOW,
    );
    expect(v[0].lowest90).toBe(false);
  });
  it('no marker when the store has less than 90 days of history, even if its price is the lowest seen', () => {
    const v = buildStoreHistories([row('lego', 900, true, 30), row('lego', 800, true, 1)], [freshCurrent('lego', 800, true)], NOW);
    expect(v[0].lowest90).toBe(false);
  });
});

describe('per store, and input order', () => {
  it('each store is judged on its own rows and its own current row; input order does not matter', () => {
    const rows = [row('lego', 1200, true, 200), row('toycra', 700, true, 200), row('toycra', 700, true, 10), row('lego', 900, true, 10)];
    const currents = [freshCurrent('lego', 900, true), freshCurrent('toycra', 700, true)];
    const a = buildStoreHistories(rows, currents, NOW);
    const b = buildStoreHistories([...rows].reverse(), [...currents].reverse(), NOW);
    expect(a.map((s) => [s.store_id, s.lowest90])).toEqual(b.map((s) => [s.store_id, s.lowest90]));
    expect(a.find((s) => s.store_id === 'toycra')!.lowest90).toBe(true);
    expect(a.find((s) => s.store_id === 'lego')!.lowest90).toBe(true);
  });
  it('an empty input gives no stores', () => {
    expect(buildStoreHistories([], [], NOW)).toEqual([]);
  });
});

describe('dateLabel', () => {
  it('formats a date without the locale (Netlify ICU)', () => {
    expect(dateLabel(Date.parse('2026-10-18T00:00:00Z'))).toBe('18 Oct 2026');
  });
  it('the 48-hour constant is two days', () => {
    expect(STALE_MS).toBe(2 * DAY_MS);
  });
});
