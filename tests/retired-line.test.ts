// Retired sets: the approved "sought after" line has no number; the "last seen" line always has a date and the
// words "last seen", comes only from a recorded Indian store price. Order 0300 (D-2026-10-30-01): it is part of the total
// at that price; without it the retired set is not counted.
import { describe, it, expect } from 'vitest';
import { RETIRED_LINE, retiredLine, worthOf, worthTotal, type LastSeen, type WorthItem, type StoredRate } from '../src/lib/collection-worth';

const RATE: StoredRate = { rate: 88, asOf: '2026-10-18' };
const retired = (over: Partial<WorthItem> = {}): WorthItem => ({ set: '10307', indianPriceInr: null, usPriceUsd: 100, qty: 1, ...over });
const seen: LastSeen = { priceInr: 12999, observedAt: '2026-03-14T09:00:00Z' };

describe('(a) the approved "sought after" fallback has no number', () => {
  it('the fallback text contains no digit and is the approved wording', () => {
    expect(RETIRED_LINE).toBe('Priceless. You could make a mini fortune on the secondary market.');
    expect(RETIRED_LINE).not.toMatch(/\d/);
    expect(RETIRED_LINE).not.toMatch(/₹/);
  });

  it('with no recorded Indian price, the retired line is the fallback', () => {
    expect(retiredLine(null)).toBe(RETIRED_LINE);
    expect(retiredLine({ priceInr: 0, observedAt: '2026-03-14T09:00:00Z' })).toBe(RETIRED_LINE);
    expect(retiredLine({ priceInr: 12999, observedAt: 'not a date' })).toBe(RETIRED_LINE);
  });
});

describe('(b) the "last seen" line', () => {
  it('always carries a date (month and year) and the words "last seen"', () => {
    const line = retiredLine(seen);
    expect(line).toBe('Retired. Last seen in India at ₹12,999 (March 2026). Good luck finding one.');
    expect(line).toMatch(/last seen/i);
    expect(line).toMatch(/\((January|February|March|April|May|June|July|August|September|October|November|December) \d{4}\)\. Good luck finding one\.$/);
  });

  it('comes only from a recorded Indian store price: no price, no figure', () => {
    // The caller passes a value only when the recorded price exists. Without it, the line is the fallback.
    expect(worthOf(retired(), RATE, true, null).line).toBe(RETIRED_LINE);
    expect(worthOf(retired(), RATE, true, seen).line).toMatch(/^Retired\. Last seen in India at ₹/);
  });

  it('without a last-seen figure, the retired row adds nothing to the total', () => {
    const others = [retired({ set: 'a', indianPriceInr: 1000, usPriceUsd: null }), retired({ set: 'b', indianPriceInr: 2000, usPriceUsd: null })];
    const retiredRow = retired({ set: 'c', indianPriceInr: null, usPriceUsd: 100 });
    const without = worthTotal([...others, retiredRow], RATE, (s) => (s === 'c' ? true : false));
    expect(worthOf(retiredRow, RATE, true, null).inr).toBeNull();
    expect(without.inr).toBe(3000);
    expect(without.retired).toBe(1);
    expect(without.line).toMatch(/^3 sets on your shelf\. Worth about ₹3,000\./);
  });

  // Order 0300 (D-2026-10-30-01): with a last seen figure, the retired row counts at that figure.
  it('with a last-seen figure, the retired row counts in the total at that figure', () => {
    const others = [retired({ set: 'a', indianPriceInr: 1000, usPriceUsd: null }), retired({ set: 'b', indianPriceInr: 2000, usPriceUsd: null })];
    const retiredRow = retired({ set: 'c', indianPriceInr: null, usPriceUsd: 100 });
    const withSeen = worthTotal([...others, retiredRow], RATE, (s) => (s === 'c' ? true : false), false, (s) => (s === 'c' ? seen : null));
    expect(worthOf(retiredRow, RATE, true, seen).inr).toBe(12999);
    expect(withSeen.inr).toBe(3000 + 12999);
    expect(withSeen.retired).toBe(0);
    expect(withSeen.line).toBe('3 sets on your shelf. Worth about ₹15,999. Your wallet has questions.');
  });
});
