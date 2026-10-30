// Counting rule (order 0350 item 2, D-2026-10-30-03): store price, else LEGO India list price, else US price, else no
// value. A retired set never uses the list price. Tests cover each case, and the total line.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { worthOf, worthTotal, worthInputFor, usableRate, type WorthItem } from '../src/lib/collection-worth';

const root = join(__dirname, '..');
const RATE = usableRate({ rate: 88, asOf: '2026-10-18' }, new Date('2026-10-18T06:00:00Z'));
const base = (over: Partial<WorthItem> = {}): WorthItem => ({ set: '90001', indianPriceInr: null, usPriceUsd: null, qty: 1, ...over });

describe('the four cases', () => {
  it('(a) a store price counts at the store price', () => {
    const w = worthOf(base({ indianPriceInr: 8999, listPriceInr: 9999, usPriceUsd: 120 }), RATE, false);
    expect(w.rule).toBe('indian');
    expect(w.inr).toBe(8999);
  });

  it('(b) with no store price, the LEGO India list price counts at its rupee value', () => {
    const w = worthOf(base({ listPriceInr: 9999, usPriceUsd: 120 }), RATE, false);
    expect(w.rule).toBe('list-price');
    expect(w.inr).toBe(9999);
    expect(w.line).toBe('₹9,999');
    expect(w.note).toBeNull();
  });

  it('(c) with no store and no list price, the US price (converted) counts as an estimate', () => {
    const w = worthOf(base({ usPriceUsd: 100 }), RATE, false);
    expect(w.rule).toBe('estimate');
    expect(w.inr).toBe(Math.round(100 * 88));
  });

  it('(d) with nothing, there is no value', () => {
    const w = worthOf(base(), RATE, false);
    expect(w.rule).toBe('unknown');
    expect(w.inr).toBeNull();
  });
});

describe('retired sets', () => {
  it('a retired set never uses the list price (it shows its last seen price, or Priceless)', () => {
    const w = worthOf(base({ listPriceInr: 9999 }), RATE, true);
    expect(w.rule).not.toBe('list-price');
    expect(w.inr).toBeNull();
  });

  it('a retired set with a last seen price still counts at that price', () => {
    const w = worthOf(base({ listPriceInr: 9999 }), RATE, true, { priceInr: 4999, observedAt: '2026-05-14T10:00:00Z' });
    expect(w.rule).toBe('last-seen');
    expect(w.inr).toBe(4999);
  });
});

describe('the total counts the list price', () => {
  it('a list-price set is counted with the Indian prices, at its rupee value times copies', () => {
    const t = worthTotal([base({ listPriceInr: 9999, qty: 2 })], RATE, () => false);
    expect(t.inr).toBe(9999 * 2);
    expect(t.counted).toBe(1);
    expect(t.indian).toBe(1);
    expect(t.line).toBe('1 sets on your shelf. Worth about ₹19,998. Your wallet has questions.');
  });

  it('a set with nothing is not counted', () => {
    const t = worthTotal([base()], RATE, () => false);
    expect(t.counted).toBe(0);
    expect(t.inr).toBe(0);
  });
});

describe('the page and the route pass the list price through', () => {
  it('worthInputFor carries the list price, and only when prices are loaded', () => {
    const loaded = worthInputFor({ set: '90001', qty: 1 }, { best_price_inr: null, us_price_usd: null, list_price_inr: 9999 }, true);
    expect(loaded.listPriceInr).toBe(9999);
    const notLoaded = worthInputFor({ set: '90001', qty: 1 }, { best_price_inr: null, us_price_usd: null, list_price_inr: 9999 }, false);
    expect(notLoaded.listPriceInr).toBeNull();
  });

  it('the route returns list_price_inr for every set that has a LEGO India list price', () => {
    const route = readFileSync(join(root, 'src/app/api/saved-sets/route.ts'), 'utf8');
    expect(route).toContain('list_price_inr: listPrice.get(set) ?? null');
    expect(route).toMatch(/if \(r\.lego_mrp_inr != null\) listPrice\.set\(r\.set_number, Number\(r\.lego_mrp_inr\)\);/);
  });
});
