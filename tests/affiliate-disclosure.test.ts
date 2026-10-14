import { describe, it, expect } from 'vitest';
import { nonStandardAffiliateMentions, AFFILIATE_NOTE } from '../src/lib/affiliate-disclosure';

describe('Gate 13: the standard ABHINAV12 line (#212; round 3, 2 Oct 2026)', () => {
  it('the sanctioned line passes', () => {
    expect(nonStandardAffiliateMentions(`Toycra has it for ₹61,500. ${AFFILIATE_NOTE}`)).toEqual([]);
  });
  it('the sanctioned line has no link and says full-price', () => {
    expect(AFFILIATE_NOTE).toBe('Code ABHINAV12 takes 12% off full-price sets at Toycra, minimum order ₹500.');
    expect(AFFILIATE_NOTE).not.toMatch(/disclosure|\]\(/i);
  });
  it('flags the old line (no full-price)', () => {
    expect(nonStandardAffiliateMentions('Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Great set.')).toHaveLength(1);
  });
  it('flags a wrong amount or minimum', () => {
    expect(nonStandardAffiliateMentions('Code ABHINAV12 takes 15% off full-price sets at Toycra, minimum order ₹500.')).toHaveLength(1);
    expect(nonStandardAffiliateMentions('Code ABHINAV12 takes 12% off full-price sets at Toycra, minimum order ₹5,000.')).toHaveLength(1);
  });
  it('flags retired wording even beside the standard clause', () => {
    expect(nonStandardAffiliateMentions('Code ABHINAV12 takes 12% off full-price sets at Toycra, minimum order ₹500 (we earn a commission).')).toHaveLength(1);
    expect(nonStandardAffiliateMentions('Code ABHINAV12 takes 12% off full-price sets at Toycra, minimum order ₹500, no usage limits.')).toHaveLength(1);
  });
  it('text without ABHINAV12 passes', () => {
    expect(nonStandardAffiliateMentions('MyBrickHouse has it at ₹19,999.')).toEqual([]);
  });
});

describe('FAQ structured data carries the plain line (no link)', () => {
  it('the FAQ JSON-LD answer is the text as written', async () => {
    const { buildFAQSchema } = await import('../src/lib/schemas');
    const text = buildFAQSchema([{ q: 'Is there a discount code?', a: `Yes. ${AFFILIATE_NOTE}` }]).mainEntity[0].acceptedAnswer.text;
    expect(text).toBe('Yes. Code ABHINAV12 takes 12% off full-price sets at Toycra, minimum order ₹500.');
  });
});
