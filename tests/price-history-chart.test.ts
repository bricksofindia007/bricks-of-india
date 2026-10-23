import { describe, it, expect } from 'vitest';
import { cheapestInStockSeries, stepChartGeometry, type HistoryRow } from '../src/lib/price-history-chart';

const row = (store_id: string, price_inr: number | null, in_stock: boolean | null, recorded_at: string): HistoryRow =>
  ({ store_id, price_inr, in_stock, recorded_at });

describe('cheapestInStockSeries', () => {
  it('returns no points for no rows', () => {
    expect(cheapestInStockSeries([])).toEqual([]);
  });

  it('carries each store forward between its change rows', () => {
    const series = cheapestInStockSeries([
      row('a', 1000, true, '2026-10-01T00:00:00Z'),
      row('b', 900, true, '2026-10-05T00:00:00Z'),
      row('a', 800, true, '2026-10-10T00:00:00Z'),
    ]);
    expect(series.map((p) => p.price)).toEqual([1000, 900, 800]);
  });

  it('ignores out-of-stock rows and does not invent a price', () => {
    const series = cheapestInStockSeries([
      row('a', 1000, false, '2026-10-01T00:00:00Z'),
      row('b', 700, true, '2026-10-02T00:00:00Z'),
    ]);
    expect(series).toEqual([{ t: Date.parse('2026-10-02T00:00:00Z'), price: 700 }]);
  });

  it('drops rows with a missing price or a bad time instead of guessing', () => {
    const series = cheapestInStockSeries([
      row('a', null, true, '2026-10-01T00:00:00Z'),
      row('a', 500, true, 'not-a-date'),
      row('a', 600, true, '2026-10-03T00:00:00Z'),
    ]);
    expect(series.map((p) => p.price)).toEqual([600]);
  });

  it('does not repeat a point when the cheapest price did not change', () => {
    const series = cheapestInStockSeries([
      row('a', 1000, true, '2026-10-01T00:00:00Z'),
      row('b', 1200, true, '2026-10-02T00:00:00Z'),
    ]);
    expect(series).toHaveLength(1);
  });
});

describe('stepChartGeometry', () => {
  it('returns null with fewer than two points', () => {
    expect(stepChartGeometry([{ t: 1, price: 5 }])).toBeNull();
  });

  it('builds a step path and the price range', () => {
    const g = stepChartGeometry([
      { t: Date.parse('2026-10-01T00:00:00Z'), price: 1000 },
      { t: Date.parse('2026-10-10T00:00:00Z'), price: 800 },
    ]);
    expect(g).not.toBeNull();
    expect(g!.min).toBe(800);
    expect(g!.max).toBe(1000);
    expect(g!.d.startsWith('M ')).toBe(true);
    expect(g!.d.split(' L ').length).toBeGreaterThanOrEqual(3);
  });
});

import { loadPriceHistoryPoints } from '../src/lib/price-history-chart';

describe('loadPriceHistoryPoints failure behaviour', () => {
  const okRows = [
    { store_id: 'a', price_inr: 1000, in_stock: true, recorded_at: '2026-10-01T00:00:00Z' },
    { store_id: 'a', price_inr: 900, in_stock: true, recorded_at: '2026-10-05T00:00:00Z' },
  ];
  it('returns points when the read works', async () => {
    const client = { rpc: async () => ({ data: okRows, error: null }) };
    const p = await loadPriceHistoryPoints(client, '75192');
    expect(p?.map((x) => x.price)).toEqual([1000, 900]);
  });
  it('returns null when the read reports an error (page renders without the chart)', async () => {
    const client = { rpc: async () => ({ data: null, error: { message: 'down' } }) };
    expect(await loadPriceHistoryPoints(client, '75192')).toBeNull();
  });
  it('returns null when the read throws', async () => {
    const client = { rpc: async () => { throw new Error('network'); } };
    expect(await loadPriceHistoryPoints(client, '75192')).toBeNull();
  });
  it('asks the existing function for the set, with a row cap', async () => {
    let seen: unknown[] = [];
    const client = { rpc: async (fn: string, args: Record<string, unknown>) => { seen = [fn, args]; return { data: [], error: null }; } };
    await loadPriceHistoryPoints(client, '75192');
    expect(seen).toEqual(['get_price_history', { p_set_number: '75192', p_limit: 200 }]);
  });
});
