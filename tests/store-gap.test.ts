import { describe, it, expect } from 'vitest';
import { isStoreGap } from '../scripts/lib/store-gap.mjs';

describe('isStoreGap (article price store-name rule)', () => {
  it('passes an article whose only store is Flipkart', () => {
    expect(isStoreGap('The LEGO set costs ₹4,999 at Flipkart this week.')).toBe(false);
  });

  it('passes an article whose only store is Amazon', () => {
    expect(isStoreGap('The LEGO set is listed at ₹12,499 on Amazon.')).toBe(false);
  });

  it('still passes an article that names Toycra or MyBrickHouse', () => {
    expect(isStoreGap('Priced at ₹17,999 at Toycra.')).toBe(false);
    expect(isStoreGap('Priced at ₹17,999 at MyBrickHouse.')).toBe(false);
  });

  it('still passes an article that says the price is import-only', () => {
    expect(isStoreGap('An estimated import price of ₹9,999. Import only.')).toBe(false);
  });

  it('fails an article with a ₹ price and no store name and no acknowledgement', () => {
    expect(isStoreGap('This set is worth ₹3,500 and sells fast.')).toBe(true);
  });

  it('ignores articles with no ₹ price', () => {
    expect(isStoreGap('No prices in this article at all.')).toBe(false);
  });

  it('treats empty content as not in scope', () => {
    expect(isStoreGap(null)).toBe(false);
    expect(isStoreGap('')).toBe(false);
  });
});
