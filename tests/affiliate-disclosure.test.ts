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

describe('FAQ answers keep the same-sentence Disclosure link (round 11, chat 2 Oct)', () => {
  it('the article line carries the markdown link the FAQ renderer looks for', async () => {
    const { DISCLOSURE_MD } = await import('../src/lib/affiliate-disclosure');
    expect(AFFILIATE_NOTE).toContain(DISCLOSURE_MD);
  });
  it('the FAQ JSON-LD turns it into a real link in the same sentence', async () => {
    const { buildFAQSchema } = await import('../src/lib/schemas');
    const text = buildFAQSchema([{ q: 'Is there a discount code?', a: `Yes. ${AFFILIATE_NOTE}` }]).mainEntity[0].acceptedAnswer.text;
    expect(text).toBe('Yes. Code ABHINAV12 takes 12% off full-price sets at Toycra, minimum order ₹500 (<a href="https://bricksofindia.com/legal/affiliate-disclosure">Disclosure</a>).');
  });
});
