// My Collection: the last-seen price is shown only on retired owned sets, comes from the one capped read, and falls back
// to the approved retired line whenever it is missing or the read fails. Retired status is never guessed.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { worthOf, retiredLine, RETIRED_LINE } from '../src/lib/collection-worth';

const root = join(__dirname, '..');
const RATE = { rate: 88, asOf: '2026-10-18' };
const page = () => readFileSync(join(root, 'src/app/my/MyCollection.tsx'), 'utf8');
const route = () => readFileSync(join(root, 'src/app/api/saved-sets/route.ts'), 'utf8');

describe('retired line with a last-seen price', () => {
  it('shows the last seen Indian price and its month', () => {
    const w = worthOf({ set: '10307', indianPriceInr: null, usPriceUsd: 499, qty: 1, storedEstimateInr: null }, RATE, true,
      { priceInr: 41199, observedAt: '2026-08-14T10:00:00Z' });
    expect(w.rule).toBe('retired');
    expect(w.line).toBe('Last seen in India at ₹41,199 (August 2026)');
    expect(w.inr).toBeNull();
  });
  it('without a last-seen price, the approved retired line', () => {
    const w = worthOf({ set: '10307', indianPriceInr: null, usPriceUsd: 499, qty: 1, storedEstimateInr: null }, RATE, true, null);
    expect(w.line).toBe(RETIRED_LINE);
  });
  it('a zero or invalid last-seen price falls back to the approved line', () => {
    expect(retiredLine({ priceInr: 0, observedAt: '2026-08-14T10:00:00Z' })).toBe(RETIRED_LINE);
    expect(retiredLine({ priceInr: 41199, observedAt: 'not a date' })).toBe(RETIRED_LINE);
  });
  it('a set that is not retired never shows the retired line, even with a last-seen price', () => {
    const w = worthOf({ set: '10307', indianPriceInr: null, usPriceUsd: 499, qty: 1, storedEstimateInr: null }, RATE, false,
      { priceInr: 41199, observedAt: '2026-08-14T10:00:00Z' });
    expect(w.rule).not.toBe('retired');
  });
});

describe('the page', () => {
  it('reads no last-seen prices: retired sets show only the approved line (owner ruling)', () => {
    const src = page();
    expect(src).not.toContain('/api/last-seen-prices');
    expect(src).toMatch(/const isRetired = \(set: string\): boolean \| null => \(priceState === 'ok' \? prices\.get\(set\)\?\.retired \?\? null : null\)/);
  });
  it('never fetches last-seen prices, for a set that is not retired or while the price read is pending', () => {
    expect(page()).not.toMatch(/last-seen|setLastSeen/);
  });
  it('a retired set with no last-seen value keeps the approved retired line', () => {
    expect(retiredLine(null)).toBe(RETIRED_LINE);
  });
  it('retired status is unknown until the price read succeeds, and is never a guess', () => {
    expect(page()).toMatch(/const isRetired = \(set: string\): boolean \| null => \(priceState === 'ok' \? prices\.get\(set\)\?\.retired \?\? null : null\)/);
  });
  it('each row is worked out from its own price and retired status, and the page never reads the INR MRP column', () => {
    const src = page();
    expect(src).toContain('worthOf(worthInputFor(o, p, priceState === \'ok\'), rate, isRetired(o.set))');
    expect(src).not.toMatch(/lego_mrp_inr/);
  });
});

describe('the saved-sets route', () => {
  it('returns retired as true or false when the sets read succeeds, and null when it does not', () => {
    expect(route()).toContain('retired: retired.get(set) ?? null');
    expect(route()).toContain("retired.set(r.set_number, r.retired === true)");
  });
});
