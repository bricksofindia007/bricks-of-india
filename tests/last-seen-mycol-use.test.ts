// My Collection and the last-seen price. Updated for order 0280 item 5 and D-2026-10-30-01: a retired set with a last seen
// price shows it on its row and counts in the total at that price; a retired set without one shows the approved line.
// The page makes one batched last-seen read, for retired owned sets only.
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
  it('the total adds a retired set at its last seen price (order 0300, D-2026-10-30-01)', () => {
    const src = page();
    expect(src).toContain('worthTotal(worthItems, rate, isRetired, capped, (s) => lastSeen.get(s) ?? null)');
  });
});

describe('the page does not use the last-seen price', () => {
  it('the page calls the last-seen route once, for retired owned sets (order 0280 item 5)', () => {
    expect(page().match(/\/api\/last-seen-prices/g)).toHaveLength(1);
  });
  it('the page holds last-seen state for retired sets and passes it to the worth rules', () => {
    const src = page();
    expect(src).toMatch(/setLastSeen/);
    expect(src).toMatch(/worthOf\(worthInputFor\(o, p, priceState === 'ok'\), rate, isRetired\(o\.set\), lastSeen\.get\(o\.set\) \?\? null\);/);
  });
  it('the page does not read the INR MRP column, and shows no set-level price for a retired set', () => {
    const src = page();
    expect(src).not.toMatch(/lego_mrp_inr/);
    expect(src).not.toMatch(/Last seen/);
  });
});
