import { describe, it, expect } from 'vitest';
import { evaluatePriceVolume, formatVolumeAlert, FLOOR_CALLS } from './price-volume-alert.mjs';

const week = [100, 110, 90, 105, 95, 100, 102];

describe('price volume rule', () => {
  it('alerts when today is above 3x the 7-day median and at or over the floor', () => {
    const b = evaluatePriceVolume({ get_set_prices: { today: 3000, prior: week } });
    expect(b).toHaveLength(1);
    expect(b[0].fn).toBe('get_set_prices');
    expect(b[0].median).toBe(100);
  });

  it('does not alert below the floor, even if the multiple is exceeded', () => {
    const b = evaluatePriceVolume({ get_set_prices: { today: FLOOR_CALLS - 1, prior: [1, 1, 1, 1, 1, 1, 1] } });
    expect(b).toHaveLength(0);
  });

  it('does not alert at exactly 3x the median', () => {
    const b = evaluatePriceVolume({ get_set_prices: { today: 3000, prior: [1000, 1000, 1000, 1000, 1000, 1000, 1000] } });
    expect(b).toHaveLength(0);
  });

  it('uses only the last 7 days of baseline', () => {
    // Old high days are dropped; the last seven median is 100.
    const b = evaluatePriceVolume({ get_price_history: { today: 3000, prior: [9000, 9000, ...week] } });
    expect(b).toHaveLength(1);
  });

  it('does not judge a function with no baseline days', () => {
    expect(evaluatePriceVolume({ get_price_summary_for_set: { today: 5000, prior: [] } })).toHaveLength(0);
  });

  it('reports each breaching function separately', () => {
    const b = evaluatePriceVolume({
      get_set_prices: { today: 3000, prior: week },
      get_price_history: { today: 100, prior: week },
      get_best_prices_for_sets: { today: 4000, prior: week },
    });
    expect(b.map((x) => x.fn).sort()).toEqual(['get_best_prices_for_sets', 'get_set_prices']);
  });

  it('formats names and counts only', () => {
    const body = formatVolumeAlert(evaluatePriceVolume({ get_set_prices: { today: 3000, prior: week } }));
    expect(body).toMatch(/get_set_prices: 3000 calls today/);
    expect(body).not.toMatch(/SERVICE|KEY|secret/i);
  });
});
