// My Collection and the last-seen price: by owner ruling, retired sets show only the approved "sought after" line.
// The page shows no price and no date for a retired set, and does not call the last-seen route. The route and the
// function stay in the tree (their own tests live with them). These tests check the page and the rule it uses.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { worthOf, worthInputFor, usableRate, RETIRED_LINE } from '../src/lib/collection-worth';

const root = join(__dirname, '..');
const page = () => readFileSync(join(root, 'src/app/my/MyCollection.tsx'), 'utf8');
const RATE = usableRate({ rate: 88, asOf: '2026-10-18' }, new Date('2026-10-18T06:00:00Z'));

describe('a retired set on My Collection', () => {
  it('shows the approved line only, with no rupee figure and no date, even with a last-seen price available', () => {
    const item = worthInputFor({ set: '10307', qty: 1 }, { best_price_inr: null, us_price_usd: 499 }, true);
    const w = worthOf(item, RATE, true, null);
    expect(w.line).toBe(RETIRED_LINE);
    expect(w.line).not.toMatch(/\d|₹|Last seen/);
    expect(w.inr).toBeNull();
  });
  it('the total never adds a retired set', () => {
    const src = page();
    expect(src).toContain('worthTotal(worthItems, rate, isRetired, capped)');
  });
});

describe('the page does not use the last-seen price', () => {
  it('the page does not call the last-seen route', () => {
    expect(page()).not.toContain('/api/last-seen-prices');
  });
  it('the page holds no last-seen state and passes no last-seen value to the worth rules', () => {
    const src = page();
    expect(src).not.toMatch(/lastSeen|LastSeen|setLastSeen|retiredIds/);
    expect(src).toMatch(/worthOf\(worthInputFor\(o, p, priceState === 'ok'\), rate, isRetired\(o\.set\)\);/);
  });
  it('the page does not read the INR MRP column, and shows no set-level price for a retired set', () => {
    const src = page();
    expect(src).not.toMatch(/lego_mrp_inr/);
    expect(src).not.toMatch(/Last seen/);
  });
});
