import { describe, it, expect } from 'vitest';
import { priceLabel, type SetPriceSummary } from '../src/lib/price-summary';

const base: SetPriceSummary = {
  set_id: '1', anchor_mrp_inr: 1000, anchor_source: 'mybrickhouse', best_price_inr: 900,
  best_store_ids: ['toycra'], best_scraped_at: '2026-09-26T00:00:00Z', in_stock_store_count: 2,
  discount_pct: 10, deal_tier: 'deal',
};

describe('priceLabel (R5/R6)', () => {
  it('Best Price only when 2+ stores in stock and one is cheapest', () => {
    expect(priceLabel(base)).toEqual({ kind: 'best', stores: ['toycra'] });
  });
  it('ties: all lowest stores together, no trophy', () => {
    expect(priceLabel({ ...base, best_store_ids: ['mybrickhouse', 'toycra'] })).toEqual({ kind: 'tie', stores: ['mybrickhouse', 'toycra'] });
  });
  it('one store in stock: Only at <store>', () => {
    expect(priceLabel({ ...base, in_stock_store_count: 1 })).toEqual({ kind: 'only', stores: ['toycra'] });
  });
  it('no fresh in-stock price: no label (R4 -- out of stock never Best Price)', () => {
    expect(priceLabel({ ...base, best_price_inr: null, best_store_ids: null, in_stock_store_count: 0 })).toBeNull();
    expect(priceLabel(null)).toBeNull();
  });
});
