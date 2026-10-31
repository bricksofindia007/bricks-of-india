// The six approved lines and the estimate line (D-2026-10-30-04 and -05). Each is copied exactly, sits in one constant,
// and appears once in the source where it belongs. The estimate line appears only on sets priced from the US price.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RETIRED_LINE, ESTIMATE_NOTE, WISHLIST_NO_PRICE_LINE, worthOf, worthTotal, retiredLine, usableRate } from '../src/lib/collection-worth';
import { VOICE } from '../src/lib/my-collection';

const root = join(__dirname, '..');
const APPROVED = {
  line3_retired_no_value: 'Priceless. You could make a mini fortune on the secondary market.',
  line4_no_price_yet: "No Indian price yet. We're watching the shelves.",
  line5_prices_not_loading: 'Prices are taking a coffee break. Your sets are still here, safe and sound.',
  line6_shelf_full: 'Your shelf is full. Impressive. Contact us and we will open a bank for you.',
  estimate_line: 'Not sold in India through regular retailers. This is an estimated price based on US prices, so your actual buying price may vary. Customs may have opinions, which might make your wallet teary eyed.',
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const srcText = sourceFiles(join(root, 'src')).map((f) => readFileSync(f, 'utf8')).join('\n');
const count = (s: string) => srcText.split(s).length - 1;

describe('the approved text is exact', () => {
  it('line 3 is the Priceless line', () => {
    expect(RETIRED_LINE).toBe(APPROVED.line3_retired_no_value);
  });
  it('line 4 is the no-price line, the same on owned and wishlist rows', () => {
    expect(WISHLIST_NO_PRICE_LINE).toBe(APPROVED.line4_no_price_yet);
  });
  it('line 5 is the prices-not-loading line', () => {
    expect(VOICE.pricesUnavailable).toBe(APPROVED.line5_prices_not_loading);
  });
  it('line 6 is the shelf-full line', () => {
    expect(VOICE.limitReached).toBe(APPROVED.line6_shelf_full);
  });
  it('the estimate line is the approved estimate line', () => {
    expect(ESTIMATE_NOTE).toBe(APPROVED.estimate_line);
  });
});

describe('each approved line sits in one place in the source', () => {
  it('line 3 appears once (its constant)', () => {
    expect(count(APPROVED.line3_retired_no_value)).toBe(1);
  });
  it('line 5 appears once (its constant)', () => {
    expect(count(APPROVED.line5_prices_not_loading)).toBe(1);
  });
  it('line 6 appears once (its constant)', () => {
    expect(count(APPROVED.line6_shelf_full)).toBe(1);
  });
  it('the estimate line appears once (its constant)', () => {
    expect(count(APPROVED.estimate_line)).toBe(1);
  });
  it('line 4 appears once (its constant; the owned row reuses it)', () => {
    expect(count("No Indian price yet. We\\'re watching the shelves.")).toBe(1);
  });
});

describe('the estimate line only appears on sets priced from the US price', () => {
  const RATE = usableRate({ rate: 88, asOf: '2026-10-18' }, new Date('2026-10-18T06:00:00Z'));
  const base = { set: '90001', indianPriceInr: null, usPriceUsd: null, qty: 1 };
  it('an estimate from the US price carries the estimate line', () => {
    expect(worthOf({ ...base, usPriceUsd: 100 }, RATE, false).note).toBe(APPROVED.estimate_line);
  });
  it('a store price, a list price, a retired set and nothing carry no estimate line', () => {
    expect(worthOf({ ...base, indianPriceInr: 8999 }, RATE, false).note).toBeNull();
    expect(worthOf({ ...base, listPriceInr: 9999 }, RATE, false).note).toBeNull();
    expect(worthOf({ ...base, usPriceUsd: 100 }, RATE, true).note).toBeNull();
    expect(worthOf(base, RATE, false).note).toBeNull();
  });
  it('the total has no estimate line (it sits on the rows only)', () => {
    const t = worthTotal([{ ...base, usPriceUsd: 100 }], RATE, () => false);
    expect(t.line).not.toContain(APPROVED.estimate_line);
    expect(t.rateNote).toBe('');
  });
});

describe('the retired line with a last-seen price is the approved line 2', () => {
  it('reads as the approved wording', () => {
    expect(retiredLine({ priceInr: 4999, observedAt: '2026-05-14T10:00:00Z' })).toBe('Retired. Last seen in India at ₹4,999 (May 2026). Good luck finding one.');
  });
});
