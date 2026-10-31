// My Collection drills, run with the flags forced on in this test file only (production flags stay off). Each drill
// names one failure rule from the spec and checks the rule's edge values against the code that implements it.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/feature-flags', () => ({
  FEATURE_FLAGS: { myCollectionPage: true, myCollectionHearts: true, accountsEnabled: false, aiSpendGuardPilot: false },
}));

import { usableRate, RATE_BAND_MIN, RATE_BAND_MAX, RATE_MAX_AGE_DAYS, worthOf, worthInputFor, retiredLine, RETIRED_LINE } from '../src/lib/collection-worth';
import { MY_SETS_LIMIT, PRICE_READ_CAP } from '../src/lib/my-collection';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';

const NOW = new Date('2026-10-20T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString().slice(0, 10);

describe('drills run with the flags on', () => {
  it('the drill flags are on in this file only', () => {
    expect(FEATURE_FLAGS.myCollectionPage).toBe(true);
    expect(FEATURE_FLAGS.myCollectionHearts).toBe(true);
  });

  describe('retired set: never valued', () => {
    it('a retired owned set shows the approved line and adds no figure to the total', () => {
      const w = worthOf(worthInputFor({ set: '10001', qty: 1 }, { best_price_inr: null, us_price_usd: 50 }, true), usableRate({ rate: 88, asOf: daysAgo(0) }, NOW), true);
      expect(w.line).toBe(RETIRED_LINE);
      expect(w.inr).toBeNull();
    });
    it('a current Indian price still wins over the retired line (the rule the page follows)', () => {
      const w = worthOf(worthInputFor({ set: '10001', qty: 1 }, { best_price_inr: 1000, us_price_usd: 50 }, true), null, true);
      expect(w.line).toBe('₹1,000');
    });
    it('a retired set with no last-seen value shows the approved line, not a guess', () => {
      expect(retiredLine(null)).toBe(RETIRED_LINE);
    });
  });

  describe('no verified Indian price', () => {
    it('an owned set with no Indian price and no US price shows "No Indian price yet. We\'re watching the shelves."', () => {
      const w = worthOf(worthInputFor({ set: '10002', qty: 1 }, undefined, true), null, false);
      expect(w.line).toBe('No Indian price yet. We\'re watching the shelves.');
    });
  });

  describe('stale rate: five days is usable, six is not', () => {
    it('a rate stored five days ago is still usable (inclusive)', () => {
      expect(RATE_MAX_AGE_DAYS).toBe(5);
      expect(usableRate({ rate: 88, asOf: daysAgo(5) }, NOW)).not.toBeNull();
    });
    it('a rate stored six days ago is hidden', () => {
      expect(usableRate({ rate: 88, asOf: daysAgo(6) }, NOW)).toBeNull();
    });
    it('a stale rate hides the estimate, so a US-only set shows "No Indian price yet. We\'re watching the shelves."', () => {
      const rate = usableRate({ rate: 88, asOf: daysAgo(6) }, NOW);
      const w = worthOf(worthInputFor({ set: '10003', qty: 1 }, { best_price_inr: null, us_price_usd: 499 }, true), rate, false);
      expect(w.line).toBe('No Indian price yet. We\'re watching the shelves.');
    });
  });

  describe('out-of-band rate: 70 to 110 rupees per dollar', () => {
    it('the band is 70 to 110', () => {
      expect(RATE_BAND_MIN).toBe(70);
      expect(RATE_BAND_MAX).toBe(110);
    });
    it('the edges are inside the band; a rate just outside either edge is rejected', () => {
      expect(usableRate({ rate: 70, asOf: daysAgo(0) }, NOW)).not.toBeNull();
      expect(usableRate({ rate: 110, asOf: daysAgo(0) }, NOW)).not.toBeNull();
      expect(usableRate({ rate: 69.99, asOf: daysAgo(0) }, NOW)).toBeNull();
      expect(usableRate({ rate: 110.01, asOf: daysAgo(0) }, NOW)).toBeNull();
    });
    it('an out-of-band rate hides the estimate, the same as a stale rate', () => {
      const rate = usableRate({ rate: 150, asOf: daysAgo(0) }, NOW);
      const w = worthOf(worthInputFor({ set: '10004', qty: 1 }, { best_price_inr: null, us_price_usd: 499 }, true), rate, false);
      expect(w.line).toBe('No Indian price yet. We\'re watching the shelves.');
    });
    it('a missing or non-numeric rate is never used', () => {
      expect(usableRate(null, NOW)).toBeNull();
      expect(usableRate({ rate: Number.NaN, asOf: daysAgo(0) }, NOW)).toBeNull();
    });
  });

  describe('500-set limit', () => {
    it('the limit is 500 sets', () => {
      expect(MY_SETS_LIMIT).toBe(500);
    });
  });

  describe('150-id batch cap', () => {
    it('the price read is capped at 150 ids per request', () => {
      expect(PRICE_READ_CAP).toBe(150);
    });
  });
});
