// The set page estimate (order 0380 item 4, D-2026-10-30-10). Only for estimates: a set with a store price or a LEGO
// India list price never gets one. The switch is off in both flag files.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setPageEstimate } from '../src/lib/set-page-estimate';
import { ESTIMATE_NOTE } from '../src/lib/collection-worth';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const NOW = new Date('2026-10-18T06:00:00Z');
const RATE = { rate: 88, asOf: '2026-10-18' };
const set = (over: Record<string, unknown> = {}) => ({ set_number: '90001', us_price_usd: 100, lego_mrp_inr: null, retired: false, year: 2024, ...over });

describe('the switch is off in both flag files', () => {
  it('src/lib/feature-flags.ts has setPageUsEstimate: false', () => {
    expect(read('src/lib/feature-flags.ts')).toMatch(/setPageUsEstimate: false,/);
  });
  it('config/feature_flags.py has set_page_us_estimate: False', () => {
    expect(read('config/feature_flags.py')).toMatch(/"set_page_us_estimate": False,/);
  });
});

describe('an estimate for a set with a US price and no Indian price', () => {
  it('shows About rupees and the approved estimate line', () => {
    expect(setPageEstimate(set(), false, RATE, NOW)).toEqual({ text: 'About ₹8,800', note: ESTIMATE_NOTE });
  });
  it('the estimate line is exact', () => {
    expect(setPageEstimate(set(), false, RATE, NOW)?.note).toBe('Not sold in India through regular retailers. This is an estimated price based on US prices, so your actual buying price may vary. Customs may have opinions, which might make your wallet teary eyed.');
  });
  it('a US price as a string from the database is read as a number', () => {
    expect(setPageEstimate(set({ us_price_usd: '100.00' }), false, RATE, NOW)?.text).toBe('About ₹8,800');
  });
});

describe('no estimate', () => {
  it('a set with a store price never gets one', () => {
    expect(setPageEstimate(set(), true, RATE, NOW)).toBeNull();
  });
  it('a set with a verified LEGO India list price never gets one', () => {
    expect(setPageEstimate(set({ lego_mrp_inr: 9999, mrp_verified: true }), false, RATE, NOW)).toBeNull();
  });
  it('an unverified LEGO India figure is an estimate: the estimate line shows with the US price, not the figure', () => {
    expect(setPageEstimate(set({ lego_mrp_inr: 9999, mrp_verified: false }), false, RATE, NOW)?.text).toBe('About ₹8,800');
  });
  it('with no US price, an unverified LEGO India figure shows as the estimate', () => {
    expect(setPageEstimate(set({ us_price_usd: null, lego_mrp_inr: 9999, mrp_verified: false }), false, null, NOW)).toEqual({ text: 'About ₹9,999', note: ESTIMATE_NOTE });
  });
  it('a retired set gets none', () => {
    expect(setPageEstimate(set({ retired: true }), false, RATE, NOW)).toBeNull();
  });
  it('no US price gets none', () => {
    expect(setPageEstimate(set({ us_price_usd: null }), false, RATE, NOW)).toBeNull();
  });
  it('no rate gets none', () => {
    expect(setPageEstimate(set(), false, null, NOW)).toBeNull();
  });
  it('a rate older than the limit gets none', () => {
    expect(setPageEstimate(set(), false, { rate: 88, asOf: '2026-10-01' }, NOW)).toBeNull();
  });
  it('a rate outside the band gets none', () => {
    expect(setPageEstimate(set(), false, { rate: 150, asOf: '2026-10-18' }, NOW)).toBeNull();
  });
});

describe('the set page wiring', () => {
  const page = read('src/app/sets/[slug]/page.tsx');
  it('the estimate is behind the switch and uses the helper', () => {
    expect(page).toMatch(/FEATURE_FLAGS\.setPageUsEstimate\s*\?\s*setPageEstimate\(/);
  });
  it('the page reads no cookies or headers (G1)', () => {
    expect(page).not.toMatch(/from 'next\/headers'/);
  });
});
