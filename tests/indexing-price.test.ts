// E6 (draft): a set counts as priced only with a store price above zero.
import { describe, it, expect } from 'vitest';
import { hasIndianPrice } from '../src/lib/indexing-price';

describe('hasIndianPrice', () => {
  it('true when one store price is above zero', () => {
    expect(hasIndianPrice([0, 1499])).toBe(true);
  });
  it('false with no prices, zero prices, or missing values', () => {
    expect(hasIndianPrice([])).toBe(false);
    expect(hasIndianPrice([0, 0])).toBe(false);
    expect(hasIndianPrice([null, undefined])).toBe(false);
  });
});
