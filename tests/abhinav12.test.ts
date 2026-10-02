// ABHINAV12 applies only to full-price Toycra listings (Abhinav, 2 Oct 2026).
import { describe, it, expect } from 'vitest';
import { abhinav12Price, isFullPrice } from '../src/lib/abhinav12';

describe('abhinav12Price', () => {
  it('full-price Toycra listing (no compare-at): 12% off', () => {
    expect(abhinav12Price({ store_id: 'toycra', price_inr: 10499, compare_at_price_inr: null })).toBe(9239);
  });
  it('compare-at equal to the price is still full price (71842: ₹5,499 / ₹5,499)', () => {
    expect(abhinav12Price({ store_id: 'toycra', price_inr: 5499, compare_at_price_inr: 5499 })).toBe(4839);
  });
  it('already discounted at Toycra (compare-at above price): no code price', () => {
    expect(abhinav12Price({ store_id: 'toycra', price_inr: 14999, compare_at_price_inr: 22899 })).toBeNull();
    expect(isFullPrice({ price_inr: 14999, compare_at_price_inr: 22899 })).toBe(false);
  });
  it('below the ₹500 minimum: no code price', () => {
    expect(abhinav12Price({ store_id: 'toycra', price_inr: 499, compare_at_price_inr: null })).toBeNull();
  });
  it('other stores never get a code price', () => {
    expect(abhinav12Price({ store_id: 'mybrickhouse', price_inr: 10499, compare_at_price_inr: null })).toBeNull();
  });
});

describe('Gate 14 accepts a code price only on full-price Toycra listings', async () => {
  const { gate14Check } = await import('../src/lib/gate14');
  const base = { setNumber: '71848', name: 'The Temple Bounty', pieces: 2387, minifigs: null, year: 2025, mrp: [22899], verdict: 'WAIT' };
  const text = 'Verdict: WAIT. Toycra has it at ₹14,999, so with the code it is ₹13,199.';
  it('Toycra already discounted (₹14,999 vs ₹22,899): the "₹13,199 with the code" figure is flagged', () => {
    const f = gate14Check(text, { ...base, prices: [14999, 22899], codeBases: [] });
    expect(f.some((x) => x.rule === 'inr' && x.detail.includes('13,199'))).toBe(true);
  });
  it('full-price Toycra listing: the code price passes', () => {
    const f = gate14Check(text, { ...base, prices: [14999], codeBases: [14999] });
    expect(f.some((x) => x.rule === 'inr')).toBe(false);
  });
});
