// My Collection: the worth input takes the US price from the price read, never from the INR MRP column,
// and the route's US-price read falls back to no US prices without failing the price read.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { worthInputFor, worthOf, RETIRED_LINE } from '../src/lib/collection-worth';

const root = join(__dirname, '..');
const RATE = { rate: 88, asOf: '2026-10-18' };

describe('worthInputFor', () => {
  it('takes the US price from the price read', () => {
    const w = worthInputFor({ set: '10307', qty: 2 }, { best_price_inr: null, us_price_usd: 499 }, true);
    expect(w).toEqual({ set: '10307', indianPriceInr: null, usPriceUsd: 499, qty: 2, storedEstimateInr: null, listPriceInr: null, year: null });
    expect(worthOf(w, RATE, false).rule).toBe('estimate');
  });
  it('a loaded Indian price still wins (rule 1)', () => {
    const w = worthInputFor({ set: '10307', qty: 1 }, { best_price_inr: 41199, us_price_usd: 499 }, true);
    expect(worthOf(w, RATE, false).rule).toBe('indian');
  });
  it('before prices load, or when the read failed, neither price is used', () => {
    const w = worthInputFor({ set: '10307', qty: 1 }, { best_price_inr: 41199, us_price_usd: 499 }, false);
    expect(w.indianPriceInr).toBeNull();
    expect(w.usPriceUsd).toBeNull();
  });
  it('a set with no price row has no value', () => {
    expect(worthInputFor({ set: '10307', qty: 1 }, undefined, true)).toEqual({ set: '10307', indianPriceInr: null, usPriceUsd: null, qty: 1, storedEstimateInr: null, listPriceInr: null, year: null });
  });
  it('a retired set with a US price shows the retired line, not an estimate', () => {
    const w = worthInputFor({ set: '10307', qty: 1 }, { best_price_inr: null, us_price_usd: 499 }, true);
    expect(worthOf(w, RATE, true).line).toBe(RETIRED_LINE);
  });
});

describe('the price route reads US prices without putting the price read at risk', () => {
  const src = readFileSync(join(root, 'src/app/api/saved-sets/route.ts'), 'utf8');
  it('reads us_price_usd from sets, in its own query', () => {
    expect(src).toContain("from('sets').select('set_number, us_price_usd, lego_mrp_inr, mrp_verified, retired, year')");
  });
  it('a failed US read is logged and leaves US prices empty; it never returns an error', () => {
    expect(src).toMatch(/if \(us\.error\) console\.error\('\[my-collection\] US price read unavailable:', us\.error\.message\);/);
  });
  it('never reads the INR MRP column for worth', () => {
    expect(src).toMatch(/lego_mrp_inr/); // read only for the stored-estimate fallback
    expect(readFileSync(join(root, 'src/app/my/MyCollection.tsx'), 'utf8')).not.toMatch(/lego_mrp_inr/);
  });
});

describe('the stored figure is an estimate for unverified rows only', () => {
  const src = readFileSync(join(root, 'src/app/api/saved-sets/route.ts'), 'utf8');
  it('is kept only when the row is not verified', () => {
    expect(src).toContain('r.lego_mrp_inr != null && r.mrp_verified === false');
  });
  it('is returned under an estimate field, never as a price', () => {
    expect(src).toContain('stored_estimate_inr:');
    expect(src).not.toMatch(/price_inr:\s*(stored|r\.lego_mrp_inr)/);
  });
});
