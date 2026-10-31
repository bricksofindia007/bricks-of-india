// Sets before 2020 (decision D-2026-10-30-09): with no rupee value they show line 3 (Priceless), not line 4,
// and are not counted. A store price or LEGO India list price still shows as usual. No year: line 4.
import { describe, it, expect } from 'vitest';
import { worthOf, worthTotal, worthInputFor, isPre2020Set, PRE_2020_CUTOFF_YEAR, RETIRED_LINE, WISHLIST_NO_PRICE_LINE, type WorthItem } from '../src/lib/collection-worth';

const base = (over: Partial<WorthItem> = {}): WorthItem => ({ set: '90001', indianPriceInr: null, usPriceUsd: null, qty: 1, ...over });
const no = () => false;

describe('the year test is in one place with one constant', () => {
  it('the cutoff is 2020', () => {
    expect(PRE_2020_CUTOFF_YEAR).toBe(2020);
  });
  it('before 2020 is true; 2020 and later, and no year, are false', () => {
    expect(isPre2020Set(2019)).toBe(true);
    expect(isPre2020Set(2020)).toBe(false);
    expect(isPre2020Set(2021)).toBe(false);
    expect(isPre2020Set(null)).toBe(false);
    expect(isPre2020Set(undefined)).toBe(false);
  });
});

describe('a set from 2019 with no rupee value', () => {
  it('shows line 3 (Priceless), not counted', () => {
    const w = worthOf(base({ year: 2019 }), null, false);
    expect(w.rule).toBe('pre-2020');
    expect(w.line).toBe(RETIRED_LINE);
    expect(w.inr).toBeNull();
  });
  it('shows its store price as usual', () => {
    const w = worthOf(base({ year: 2019, indianPriceInr: 4999 }), null, false);
    expect(w.rule).toBe('indian');
    expect(w.line).toBe('₹4,999');
  });
  it('shows its LEGO India list price as usual', () => {
    const w = worthOf(base({ year: 2019, listPriceInr: 3999 }), null, false);
    expect(w.rule).toBe('list-price');
    expect(w.line).toBe('₹3,999');
  });
  it('a retired 2019 set with a last seen price shows that price', () => {
    const w = worthOf(base({ year: 2019 }), null, true, { priceInr: 2500, observedAt: '2026-05-14T10:00:00Z' });
    expect(w.rule).toBe('last-seen');
  });
  it('a retired 2019 set with no last seen price keeps the retired rule (line 3)', () => {
    const w = worthOf(base({ year: 2019 }), null, true, null);
    expect(w.rule).toBe('retired');
    expect(w.line).toBe(RETIRED_LINE);
  });
});

describe('a set from 2020 with no rupee value', () => {
  it('shows line 4, not line 3', () => {
    const w = worthOf(base({ year: 2020 }), null, false);
    expect(w.rule).toBe('unknown');
    expect(w.line).toBe(WISHLIST_NO_PRICE_LINE);
  });
});

describe('a set with no year and no rupee value', () => {
  it('uses line 4', () => {
    const w = worthOf(base({ year: null }), null, false);
    expect(w.rule).toBe('unknown');
    expect(w.line).toBe(WISHLIST_NO_PRICE_LINE);
  });
  it('an absent year (not passed) uses line 4', () => {
    const w = worthOf(base(), null, false);
    expect(w.line).toBe(WISHLIST_NO_PRICE_LINE);
  });
});

describe('the total', () => {
  it('a 2019 set with no value is counted as other sets: not in the money, not in the retired count', () => {
    const t = worthTotal([base({ year: 2019 }), base({ set: '90002', year: 2020 })], null, no);
    expect(t.inr).toBe(0);
    expect(t.pre2020).toBe(1);
    expect(t.retired).toBe(0);
    expect(t.counted).toBe(0);
    expect(t.sets).toBe(2);
  });
});

describe('the price read passes the year only when prices are loaded', () => {
  it('a loaded price read carries the year', () => {
    const it = worthInputFor({ set: '90001', qty: 1 }, { best_price_inr: null, us_price_usd: null, year: 2019 }, true);
    expect(it.year).toBe(2019);
    expect(worthOf(it, null, false).line).toBe(RETIRED_LINE);
  });
  it('a failed or loading price read does not show line 3 for a 2019 set', () => {
    const it = worthInputFor({ set: '90001', qty: 1 }, { best_price_inr: null, us_price_usd: null, year: 2019 }, false);
    expect(it.year).toBeNull();
  });
});
