import { describe, it, expect } from 'vitest';
import { bestInStock, badgeEligible, isPriceFresh, PRICE_STALE_HOURS } from '../src/lib/price-freshness';

const NOW = Date.parse('2026-09-26T12:00:00Z');
const hAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe('price freshness', () => {
  it('stale threshold is one daily scrape plus 2 h', () => {
    expect(PRICE_STALE_HOURS).toBe(26);
  });
  it('fresh within 26h, stale after, unknown never fresh', () => {
    expect(isPriceFresh(hAgo(25.9), NOW)).toBe(true);
    expect(isPriceFresh(hAgo(26.1), NOW)).toBe(false);
    expect(isPriceFresh(null, NOW)).toBe(false);
  });
  it('best price ignores sold-out rows even when cheaper', () => {
    const rows = [
      { store_id: 'mbh', price_inr: 900, in_stock: false, scraped_at: hAgo(1) },
      { store_id: 'toycra', price_inr: 1000, in_stock: true, scraped_at: hAgo(1) },
    ];
    expect(bestInStock(rows)?.store_id).toBe('toycra');
    expect(bestInStock(rows.slice(0, 1))).toBeNull();
  });
  it('badge only for an in-stock, fresh row', () => {
    expect(badgeEligible({ price_inr: 1000, in_stock: true, scraped_at: hAgo(2) }, NOW)).toBe(true);
    expect(badgeEligible({ price_inr: 1000, in_stock: true, scraped_at: hAgo(27) }, NOW)).toBe(false);
    expect(badgeEligible({ price_inr: 1000, in_stock: false, scraped_at: hAgo(2) }, NOW)).toBe(false);
    expect(badgeEligible({ price_inr: 1000, in_stock: true, scraped_at: null }, NOW)).toBe(false);
  });
});
