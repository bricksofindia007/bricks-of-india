// My Collection worth rules (spec section 4): the four rules, the stale rate, unknown retired status
// and the total line. The rate and retired status are test doubles here.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  worthOf, worthTotal, usableRate, formatRs, RETIRED_LINE, ESTIMATE_NOTE, WORTH_UNKNOWN_LINE, CAP_SENTENCE,
  RATE_MAX_AGE_DAYS, type StoredRate, type WorthItem,
} from '../src/lib/collection-worth';
import { priceIds, PRICE_READ_CAP } from '../src/lib/my-collection';

const NOW = new Date('2026-10-18T06:00:00Z');
const RATE: StoredRate = { rate: 88, asOf: '2026-10-18' }; // "rate of 18 Oct"
const item = (over: Partial<WorthItem> = {}): WorthItem => ({ set: '10307', indianPriceInr: null, usPriceUsd: null, qty: 1, ...over });

describe('worth rule 1: verified, fresh Indian price', () => {
  it('shows the Indian price plainly, whatever the retired status', () => {
    for (const retired of [true, false, null]) {
      const w = worthOf(item({ indianPriceInr: 41199, usPriceUsd: 499 }), RATE, retired);
      expect(w).toEqual({ rule: 'indian', inr: 41199, line: '₹41,199', note: null });
    }
  });
});

describe('worth rule 2: US price estimate', () => {
  it('converts the US price at the stored rate, with the wording and the note', () => {
    const w = worthOf(item({ usPriceUsd: 499 }), RATE, false);
    expect(w.rule).toBe('estimate');
    expect(w.inr).toBe(43912);
    expect(w.line).toBe('About ₹43,912, estimated from the US list price');
    expect(w.note).toBe(ESTIMATE_NOTE);
  });
  it('never names a store or offers a buy action', () => {
    const w = worthOf(item({ usPriceUsd: 499 }), RATE, false);
    expect(w.line).not.toMatch(/store|buy|shop|LEGO\.in|Toycra/i);
  });
  it('also applies when retired status is unknown (never rule 3 for unknown)', () => {
    expect(worthOf(item({ usPriceUsd: 499 }), RATE, null).rule).toBe('estimate');
  });
});

describe('worth rule 3: retired set, no figure', () => {
  it('shows only the retired line, with no number', () => {
    const w = worthOf(item({ usPriceUsd: 499 }), RATE, true);
    expect(w).toEqual({ rule: 'retired', inr: null, line: RETIRED_LINE, note: null });
    expect(w.line).toBe('Retired and sought after. Resellers know what this is worth. Check the secondary market before you sell.');
    expect(w.line).not.toMatch(/\d/);
  });
  it('a retired set with no US price is still retired, not unknown', () => {
    expect(worthOf(item(), RATE, true).rule).toBe('retired');
  });
});

describe('worth rule 4: nothing known', () => {
  it('no Indian price and no US price, set current: not known yet, not valued', () => {
    const w = worthOf(item(), RATE, false);
    expect(w).toEqual({ rule: 'unknown', inr: null, line: WORTH_UNKNOWN_LINE, note: null });
  });
  it('unknown retired status with no US price: unknown, never retired', () => {
    expect(worthOf(item(), RATE, null).rule).toBe('unknown');
  });
});

describe('stale or missing rate', () => {
  it('a rate 5 days old is still usable; 6 days old is not', () => {
    expect(usableRate({ rate: 88, asOf: '2026-10-13' }, NOW)).not.toBeNull();
    expect(usableRate({ rate: 88, asOf: '2026-10-12' }, NOW)).toBeNull();
    expect(RATE_MAX_AGE_DAYS).toBe(5);
  });
  it('a stale rate hides estimates: a US-only set falls to not known yet', () => {
    const stale = usableRate({ rate: 88, asOf: '2026-10-01' }, NOW);
    const w = worthOf(item({ usPriceUsd: 499 }), stale, false);
    expect(w.rule).toBe('unknown');
    expect(w.line).not.toMatch(/About Rs/);
  });
  it('a stale rate on a retired set still shows the retired line, not an estimate', () => {
    expect(worthOf(item({ usPriceUsd: 499 }), null, true).rule).toBe('retired');
  });
  it('no stored rate or a bad rate is not usable', () => {
    expect(usableRate(null, NOW)).toBeNull();
    expect(usableRate({ rate: 0, asOf: '2026-10-18' }, NOW)).toBeNull();
    expect(usableRate({ rate: Number.NaN, asOf: '2026-10-18' }, NOW)).toBeNull();
  });
});

// Estimates stay hidden in both states: no rate at all, and a rate more than RATE_MAX_AGE_DAYS old.
describe('estimates stay hidden without a usable rate', () => {
  const usOnly = () => item({ usPriceUsd: 499 });
  it('no rate: the row shows no estimate and no rupee figure', () => {
    const w = worthOf(usOnly(), usableRate(null, NOW), false);
    expect(w.rule).toBe('unknown');
    expect(w.inr).toBeNull();
    expect(w.line).not.toMatch(/About Rs|₹/);
  });
  it('a rate over 5 days old: the row shows no estimate and no rupee figure', () => {
    const w = worthOf(usOnly(), usableRate({ rate: 88, asOf: '2026-10-12' }, NOW), false);
    expect(w.rule).toBe('unknown');
    expect(w.inr).toBeNull();
    expect(w.line).not.toMatch(/About Rs|₹/);
  });
  it('a rate exactly 5 days old is still usable (the boundary is inclusive)', () => {
    const w = worthOf(usOnly(), usableRate({ rate: 88, asOf: '2026-10-13' }, NOW), false);
    expect(w.rule).toBe('estimate');
    expect(w.inr).not.toBeNull();
  });
  it('the total counts neither state, with or without a rate date to show', () => {
    for (const stored of [null, { rate: 88, asOf: '2026-10-12' }]) {
      const t = worthTotal([usOnly()], usableRate(stored, NOW), () => false);
      expect(t.inr ?? 0).toBe(0);
      expect(t.line).not.toMatch(/₹/);
    }
  });
  it('the page passes no rate when none is wired, so the hidden state is the one the page shows', () => {
    const src = readFileSync(join(__dirname, '..', 'src/app/my/MyCollection.tsx'), 'utf8');
    expect(src).toContain('const noRate: RateSource = { getRate: () => null };');
    expect(src).toContain('usableRate(noRate.getRate(), new Date())');
  });
});

describe('total line', () => {
  it('counts rules 1 and 2 only, and states how it is made up', () => {
    const items: WorthItem[] = [
      ...Array.from({ length: 9 }, (_, i) => item({ set: `i${i}`, indianPriceInr: 1000, qty: 1 })),
      ...Array.from({ length: 5 }, (_, i) => item({ set: `e${i}`, usPriceUsd: 10, qty: 1 })),
      ...Array.from({ length: 3 }, (_, i) => item({ set: `r${i}`, usPriceUsd: 10 })),
    ];
    const t = worthTotal(items, RATE, (s) => (s.startsWith('r') ? true : false));
    expect(t.sets).toBe(17);
    expect(t.counted).toBe(14);
    expect(t.indian).toBe(9);
    expect(t.estimate).toBe(5);
    expect(t.retired).toBe(3);
    expect(t.line).toBe('Worth counts 14 of 17 sets: 9 at Indian prices, 5 estimated from US prices. 3 are retired and not counted.');
    expect(t.inr).toBe(9000 + 5 * 880);
  });
  it('multiplies by copies owned for the money total', () => {
    const t = worthTotal([item({ set: 'a', indianPriceInr: 1000, qty: 3 })], RATE, () => false);
    expect(t.inr).toBe(3000);
  });
  it('adds the unknown sentence only when there are unknown sets', () => {
    const t = worthTotal([item({ set: 'a', indianPriceInr: 1000 }), item({ set: 'b' })], RATE, () => false);
    expect(t.line).toBe('Worth counts 1 of 2 sets: 1 at Indian price, 0 estimated from US prices. 1 has no price yet and not counted.');
  });
  it('an empty collection gives an empty count line', () => {
    expect(worthTotal([], RATE, () => false).line).toBe('Worth counts 0 of 0 sets: 0 at Indian prices, 0 estimated from US prices.');
  });
  it('an unknown retired status is never counted as retired', () => {
    const t = worthTotal([item({ set: 'a', usPriceUsd: 10 })], RATE, () => null);
    expect(t.retired).toBe(0);
    expect(t.estimate).toBe(1);
  });
});

describe('the newest-150 read cap in the total', () => {
  it('adds "Worth counts your newest 150 sets." when the read left sets out', () => {
    const t = worthTotal([item({ set: 'a', indianPriceInr: 1000 })], RATE, () => false, true);
    expect(t.line).toBe('Worth counts 1 of 1 set: 1 at Indian price, 0 estimated from US prices. Worth counts your newest 150 sets.');
  });
  it('no cap sentence when every set was priced', () => {
    expect(worthTotal([item({ set: 'a', indianPriceInr: 1000 })], RATE, () => false).line).not.toMatch(/newest 150/);
  });
  it('the read leaves out sets past 150, newest first', () => {
    const owned = Array.from({ length: 160 }, (_, i) => ({ set: String(10000 + i), added_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString() }));
    const wish: never[] = [];
    const priced = new Set(priceIds(wish, owned as never));
    expect(priced.size).toBe(150);
    expect(priced.has('10000')).toBe(false);
    expect(priced.has('10159')).toBe(true);
  });
  it('the cap sentence uses the read cap', () => {
    expect(CAP_SENTENCE).toBe('Worth counts your newest 150 sets.');
    expect(PRICE_READ_CAP).toBe(150);
  });
});

describe('Indian digit grouping', () => {
  it('groups as 12,34,567 and leaves small numbers alone', () => {
    expect(formatRs(41199)).toBe('41,199');
    expect(formatRs(1234567)).toBe('12,34,567');
    expect(formatRs(999)).toBe('999');
    expect(formatRs(1000)).toBe('1,000');
  });
});

import { retiredLine, type LastSeen } from '../src/lib/collection-worth';

describe('retired sets: a factual last-seen line, or only the approved line', () => {
  const seen: LastSeen = { priceInr: 12999, observedAt: '2026-03-14T08:00:00Z' };
  it('with our own observed Indian price: "Last seen in India at ₹X (month, year)", most recent price, Indian grouping', () => {
    expect(retiredLine(seen)).toBe('Last seen in India at ₹12,999 (March 2026)');
    expect(worthOf(item({ set: 'r' }), RATE, true, seen).line).toBe('Last seen in India at ₹12,999 (March 2026)');
  });
  it('without one: only the approved line, with no rupee figure and no launch claim', () => {
    expect(retiredLine(null)).toBe(RETIRED_LINE);
    expect(retiredLine(null)).not.toMatch(/\d|launch/i);
  });
  it('a bad date or a zero price falls back to the approved line, never a guessed figure', () => {
    expect(retiredLine({ priceInr: 500, observedAt: 'not a date' })).toBe(RETIRED_LINE);
    expect(retiredLine({ priceInr: 0, observedAt: '2026-03-14T00:00:00Z' })).toBe(RETIRED_LINE);
  });
  it('the month names are English and the year is the observed year', () => {
    expect(retiredLine({ priceInr: 1000, observedAt: '2025-12-31T23:30:00Z' })).toBe('Last seen in India at ₹1,000 (December 2025)');
  });
  it('a current Indian price still wins over the retired line', () => {
    expect(worthOf(item({ indianPriceInr: 41199 }), RATE, true, seen).rule).toBe('indian');
  });
  it('retired sets add nothing to the total, even with a last-seen price', () => {
    const t = worthTotal([item({ set: 'r', indianPriceInr: null, usPriceUsd: 499 })], RATE, () => true);
    expect(t.inr).toBe(0);
    expect(t.retired).toBe(1);
    expect(t.line).toMatch(/1 is retired and not counted/);
  });
});

describe('summary strip: retired sets not valued', () => {
  it('the strip has a "Retired, not valued" count from the total', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(__dirname, '..', 'src/app/my/MyCollection.tsx'), 'utf8');
    expect(src).toContain('Retired, not valued');
    expect(src).toContain('{total.retired}');
  });
});

describe('estimates: US list price x current rate first, the stored estimate only as a fallback', () => {
  it('the US-price estimate names its source in the same sentence', () => {
    const w = worthOf(item({ usPriceUsd: 499 }), RATE, false);
    expect(w.line).toMatch(/^About ₹[\d,]+, estimated from the US list price$/);
  });
  it('with no US price, the stored estimate is shown with its own source named', () => {
    const w = worthOf(item({ usPriceUsd: null, storedEstimateInr: 43900 }), RATE, false);
    expect(w).toMatchObject({ rule: 'stored-estimate', inr: 43900 });
    expect(w.line).toBe('About ₹43,900, worked out from the US price');
  });
  it('a US price beats the stored estimate when both exist', () => {
    expect(worthOf(item({ usPriceUsd: 499, storedEstimateInr: 99999 }), RATE, false).rule).toBe('estimate');
  });
  it('a stale rate with a US price falls to the stored estimate', () => {
    expect(worthOf(item({ usPriceUsd: 499, storedEstimateInr: 43900 }), null, false).rule).toBe('stored-estimate');
  });
  it('a retired set never uses the stored estimate', () => {
    expect(worthOf(item({ storedEstimateInr: 43900 }), RATE, true).rule).toBe('retired');
  });
  it('the stored estimate is shown but not counted in the money total', () => {
    const t = worthTotal([item({ set: 'a', storedEstimateInr: 43900 })], RATE, () => false);
    expect(t.inr).toBe(0);
    expect(t.storedEstimate).toBe(1);
    expect(t.line).toMatch(/1 is worked out from the US price and not counted\./);
  });
  it('a zero or missing stored estimate is not used', () => {
    expect(worthOf(item({ storedEstimateInr: 0 }), RATE, false).rule).toBe('unknown');
    expect(worthOf(item({ storedEstimateInr: null }), RATE, false).rule).toBe('unknown');
  });
});
