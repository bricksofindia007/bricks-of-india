// Round 8: WAIT verdict + live deal -> discount line (never stored).
import { describe, it, expect } from 'vitest';
import { waitDiscountLine, WAIT_DISCOUNT_LINE } from '../src/lib/verdict-notes';

describe('waitDiscountLine', () => {
  it('71848 Temple Bounty: WAIT with a live Hot deal (Toycra ₹14,999 vs MRP ₹22,899) shows the line', () => {
    expect(waitDiscountLine('WAIT', { deal_tier: 'hot' })).toBe("There's a discount right now — see the price box.");
    expect(waitDiscountLine('WAIT', { deal_tier: 'deal' })).toBe(WAIT_DISCOUNT_LINE);
  });
  it('no live deal, no line', () => {
    expect(waitDiscountLine('WAIT', { deal_tier: null })).toBeNull();
    expect(waitDiscountLine('WAIT', null)).toBeNull();
  });
  it('only under WAIT', () => {
    expect(waitDiscountLine('BUY NOW', { deal_tier: 'hot' })).toBeNull();
    expect(waitDiscountLine('AVOID', { deal_tier: 'hot' })).toBeNull();
  });
});
