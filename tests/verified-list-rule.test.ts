// The value order (D-2026-10-31-03 item 3): store price, verified LEGO India list price, US price times the rate,
// unverified LEGO India figure (an estimate), else no value. Retired and pre-2020 rules unchanged.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { worthOf, worthTotal, ESTIMATE_NOTE, RETIRED_LINE, WORTH_UNKNOWN_LINE, type StoredRate, type WorthItem } from '../src/lib/collection-worth';

const root = join(__dirname, '..');
const RATE: StoredRate = { rate: 88, asOf: '2026-10-18' };
const SEEN = { priceInr: 4999, observedAt: '2026-05-14T10:00:00Z' };
const item = (over: Partial<WorthItem> = {}): WorthItem => ({ set: '90001', indianPriceInr: null, usPriceUsd: null, qty: 1, ...over });
const read = (f: string) => readFileSync(join(root, f), 'utf8');

describe('the order of value', () => {
  it('1. a store price wins over everything', () => {
    const w = worthOf(item({ indianPriceInr: 8999, listPriceInr: 9999, usPriceUsd: 100, storedEstimateInr: 7777 }), RATE, false);
    expect(w).toMatchObject({ rule: 'indian', inr: 8999, note: null });
  });
  it('2. a verified list price beats the US price and the unverified figure', () => {
    const w = worthOf(item({ listPriceInr: 9999, usPriceUsd: 100, storedEstimateInr: 7777 }), RATE, false);
    expect(w).toMatchObject({ rule: 'list-price', inr: 9999, note: null });
  });
  it('3. with no store and no verified list price, the US price times the rate is an estimate', () => {
    const w = worthOf(item({ usPriceUsd: 100, storedEstimateInr: 7777 }), RATE, false);
    expect(w).toMatchObject({ rule: 'estimate', inr: 8800, note: ESTIMATE_NOTE });
    expect(w.line).toBe('About ₹8,800');
  });
  it('4. an unverified figure with no US price is an estimate, with the estimate line', () => {
    const w = worthOf(item({ storedEstimateInr: 7777 }), RATE, false);
    expect(w).toMatchObject({ rule: 'stored-estimate', inr: 7777, note: ESTIMATE_NOTE });
    expect(w.line).toBe('About ₹7,777');
  });
  it('5. nothing: no value, the no-price line', () => {
    const w = worthOf(item(), RATE, false);
    expect(w).toMatchObject({ rule: 'unknown', inr: null, line: WORTH_UNKNOWN_LINE });
  });
});

describe('the estimate line only appears on estimates', () => {
  it('store and verified list prices carry no estimate line', () => {
    expect(worthOf(item({ indianPriceInr: 8999 }), RATE, false).note).toBeNull();
    expect(worthOf(item({ listPriceInr: 9999 }), RATE, false).note).toBeNull();
  });
  it('the total counts an unverified figure as an estimate, and a verified list price as an indian price', () => {
    const t = worthTotal([item({ set: 'a', storedEstimateInr: 7777 }), item({ set: 'b', listPriceInr: 9999 })], RATE, () => false);
    expect(t.estimate).toBe(1);
    expect(t.indian).toBe(1);
    expect(t.inr).toBe(7777 + 9999);
  });
});

describe('retired and pre-2020 rules are unchanged', () => {
  it('a retired set never uses a list price or an unverified figure', () => {
    expect(worthOf(item({ listPriceInr: 9999 }), RATE, true).rule).toBe('retired');
    expect(worthOf(item({ storedEstimateInr: 7777 }), RATE, true).rule).toBe('retired');
  });
  it('a retired set with a last seen price shows it', () => {
    expect(worthOf(item({ storedEstimateInr: 7777 }), RATE, true, SEEN)).toMatchObject({ rule: 'last-seen', inr: 4999 });
  });
  it('a 2019 set with an unverified figure is valued (not Priceless)', () => {
    expect(worthOf(item({ year: 2019, storedEstimateInr: 7777 }), RATE, false)).toMatchObject({ rule: 'stored-estimate', inr: 7777 });
  });
  it('a 2019 set with no value is Priceless and not counted', () => {
    const w = worthOf(item({ year: 2019 }), RATE, false);
    expect(w).toMatchObject({ rule: 'pre-2020', line: RETIRED_LINE });
  });
});

describe('the route and the code', () => {
  const route = read('src/app/api/saved-sets/route.ts');
  it('the route returns the list price only when verified', () => {
    expect(route).toMatch(/if \(r\.lego_mrp_inr != null && r\.mrp_verified === true\) listPrice\.set\(/);
  });
  it('the route returns the unverified figure as the stored estimate only when not verified', () => {
    expect(route).toMatch(/if \(r\.lego_mrp_inr != null && r\.mrp_verified !== true\) stored\.set\(/);
  });
  it('the old never-counted wording is gone from the worth code', () => {
    const worth = read('src/lib/collection-worth.ts');
    expect(worth).not.toMatch(/shown, not counted/);
    expect(worth).not.toMatch(/Estimates can differ from what Indian shops charge/);
  });
});
