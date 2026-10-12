import { describe, it, expect } from 'vitest';
import { priceLineNamesStores, rewriteNeeded } from '../scripts/lib/price-line-check.mjs';

const OLD_TOYCRA = 'Body.\n\nPriced at ₹29,399 on Toycra, confirmed in stock as of 4 Oct 2026.\nVerdict: BUY NOW.';
const NEW_TOYCRA = 'Body.\n\nAt review, it was priced at ₹29,399 on Toycra.\nVerdict: BUY NOW.';
const NEW_BOTH = 'Body.\n\nAt review, it was priced at ₹29,399 on Toycra (₹41,199 on LEGO.in).\nVerdict: BUY NOW.';
const OLD_BOTH = 'Body.\n\nPriced at ₹29,399 on Toycra (₹41,199 on LEGO.in), confirmed in stock as of 4 Oct 2026.\nVerdict: BUY NOW.';
const NO_PRICE_LINE = 'Body. The site lists it on Toycra.\nVerdict: BUY NOW.';

describe('priceLineNamesStores', () => {
  it('accepts the old form when the stores match', () => {
    expect(priceLineNamesStores(OLD_TOYCRA, 'Toycra')).toBe(true);
  });
  it('accepts the new form when the stores match', () => {
    expect(priceLineNamesStores(NEW_TOYCRA, 'Toycra')).toBe(true);
  });
  it('rejects the old form when the stores differ', () => {
    expect(priceLineNamesStores(OLD_TOYCRA, 'LEGO.in')).toBe(false);
  });
  it('rejects the new form when the stores differ', () => {
    expect(priceLineNamesStores(NEW_TOYCRA, 'LEGO.in')).toBe(false);
  });
  it('matches the full stores text exactly, including the bracketed second store', () => {
    expect(priceLineNamesStores(NEW_BOTH, 'Toycra (₹41,199 on LEGO.in)')).toBe(true);
    expect(priceLineNamesStores(OLD_BOTH, 'Toycra (₹41,199 on LEGO.in)')).toBe(true);
    expect(priceLineNamesStores(NEW_BOTH, 'Toycra')).toBe(false);
  });
  it('does not match the store name in ordinary body text', () => {
    expect(priceLineNamesStores(NO_PRICE_LINE, 'Toycra')).toBe(false);
  });
});

describe('rewriteNeeded', () => {
  const base = { storesNow: 'Toycra', oldPrice: 29399, newPrice: 29399, retailerChanged: false };

  it('does not rewrite an unchanged old-form row', () => {
    expect(rewriteNeeded({ ...base, content: OLD_TOYCRA })).toBe(false);
  });
  it('does not rewrite an unchanged new-form row', () => {
    expect(rewriteNeeded({ ...base, content: NEW_TOYCRA })).toBe(false);
  });
  it('rewrites when the price changed, in either form', () => {
    expect(rewriteNeeded({ ...base, newPrice: 27999, content: OLD_TOYCRA })).toBe(true);
    expect(rewriteNeeded({ ...base, newPrice: 27999, content: NEW_TOYCRA })).toBe(true);
  });
  it('rewrites when the source retailer changed, in either form', () => {
    expect(rewriteNeeded({ ...base, retailerChanged: true, content: OLD_TOYCRA })).toBe(true);
    expect(rewriteNeeded({ ...base, retailerChanged: true, content: NEW_TOYCRA })).toBe(true);
  });
  it('rewrites when the stores changed, in either form', () => {
    expect(rewriteNeeded({ ...base, storesNow: 'LEGO.in', content: OLD_TOYCRA })).toBe(true);
    expect(rewriteNeeded({ ...base, storesNow: 'LEGO.in', content: NEW_TOYCRA })).toBe(true);
  });
  it('produces zero writes over a set of unchanged rows', () => {
    const unchanged = [
      { ...base, content: OLD_TOYCRA },
      { ...base, content: NEW_TOYCRA },
      { ...base, storesNow: 'Toycra (₹41,199 on LEGO.in)', content: NEW_BOTH },
      { ...base, storesNow: 'Toycra (₹41,199 on LEGO.in)', content: OLD_BOTH },
    ];
    expect(unchanged.filter((row) => rewriteNeeded(row)).length).toBe(0);
  });
});