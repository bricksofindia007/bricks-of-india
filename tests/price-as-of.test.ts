import { describe, it, expect } from 'vitest';
import { hasTypedStorePrice } from '../src/lib/price-as-of';

describe('articles with a typed store price get a "prices as of" note', () => {
  it('detects store + rupee figures in either order', () => {
    expect(hasTypedStorePrice('In India, it is available at LEGO.in for ₹65,999.')).toBe(true);
    expect(hasTypedStorePrice('Toycra has it for ₹61,500.')).toBe(true);
    expect(hasTypedStorePrice('It costs ₹4,099 at LEGO.in right now.')).toBe(true);
  });
  it('ignores text without a store price', () => {
    expect(hasTypedStorePrice('No Indian prices yet. LEGO.in and Toycra are the stores to watch.')).toBe(false);
    expect(hasTypedStorePrice('That is 18 months of Netflix Premium.')).toBe(false);
    expect(hasTypedStorePrice(null)).toBe(false);
  });
});
