import { describe, it, expect } from 'vitest';
import { undisclosedAffiliateMentions, AFFILIATE_NOTE } from '../src/lib/affiliate-disclosure';

describe('Gate 13 affiliate disclosure (#212)', () => {
  it('the sanctioned note passes', () => {
    expect(undisclosedAffiliateMentions(`Toycra has it for ₹61,500. ${AFFILIATE_NOTE}`)).toEqual([]);
  });
  it('flags an ABHINAV12 sentence without "commission"', () => {
    expect(undisclosedAffiliateMentions('Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Great set.')).toHaveLength(1);
  });
  it('disclosure must be in the same sentence, not the next one', () => {
    expect(undisclosedAffiliateMentions('Use code ABHINAV12 at Toycra. We earn a commission.')).toHaveLength(1);
  });
  it('text without ABHINAV12 passes', () => {
    expect(undisclosedAffiliateMentions('MyBrickHouse has it at ₹19,999.')).toEqual([]);
  });
});
