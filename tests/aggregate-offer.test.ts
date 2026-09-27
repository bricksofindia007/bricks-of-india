import { describe, it, expect } from 'vitest';
import { buildAggregateOffer } from '../src/lib/schemas';

// #220: JSON-LD offers use only in-stock rows scraped within 12h.
const NOW = Date.parse('2026-09-27T12:00:00Z');
const hAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const NAMES = { mybrickhouse: 'MyBrickHouse', toycra: 'Toycra' };
const URL = 'https://bricksofindia.com/sets/71043';

describe('buildAggregateOffer (#220)', () => {
  it('ignores a cheaper sold-out store (the /sets/71043 case)', () => {
    const o: any = buildAggregateOffer([
      { store_id: 'toycra', price_inr: 37799, in_stock: false, scraped_at: hAgo(1) },
      { store_id: 'mybrickhouse', price_inr: 50399, in_stock: true, scraped_at: hAgo(1) },
    ], NAMES, URL, NOW);
    expect(o['@type']).toBe('AggregateOffer');
    expect(o.lowPrice).toBe(50399);
    expect(o.highPrice).toBe(50399);
    expect(o.offerCount).toBe(1);
    expect(o.offers).toHaveLength(1);
    expect(o.offers[0].seller.name).toBe('MyBrickHouse');
  });
  it('ignores an in-stock row older than 12h', () => {
    const o: any = buildAggregateOffer([
      { store_id: 'toycra', price_inr: 900, in_stock: true, scraped_at: hAgo(13) },
      { store_id: 'mybrickhouse', price_inr: 1000, in_stock: true, scraped_at: hAgo(2) },
      { store_id: 'x', price_inr: 1200, in_stock: true, scraped_at: hAgo(11.9) },
    ], NAMES, URL, NOW);
    expect([o.lowPrice, o.highPrice, o.offerCount]).toEqual([1000, 1200, 2]);
  });
  it('no qualifying row: per-store OutOfStock offers and no lowPrice', () => {
    const o: any = buildAggregateOffer([
      { store_id: 'toycra', price_inr: 900, in_stock: false, scraped_at: hAgo(1) },
      { store_id: 'mybrickhouse', price_inr: 1000, in_stock: true, scraped_at: hAgo(30) },
      { store_id: 'x', price_inr: 1100, in_stock: true, scraped_at: null },
    ], NAMES, URL, NOW);
    expect(Array.isArray(o)).toBe(true);
    expect(o).toHaveLength(3);
    for (const offer of o) {
      expect(offer['@type']).toBe('Offer');
      expect(offer.availability).toBe('https://schema.org/OutOfStock');
    }
    expect(JSON.stringify(o)).not.toContain('lowPrice');
  });
});
