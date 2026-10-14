// 2 Oct 2026: gate false positives found publishing the Brick Rush list article.
import { describe, it, expect } from 'vitest';
import { extractSetNameCandidates } from '../src/lib/lint';
import { nonStandardAffiliateMentions } from '../src/lib/affiliate-disclosure';

describe('factuality: non-set phrases after "LEGO"', () => {
  it('ignores LEGO Certified Store(s), India MRP, User Group', () => {
    const c = extractSetNameCandidates("Only in LEGO Certified Stores. The LEGO Certified Store India post. LEGO India MRP rose. A LEGO User Group met.");
    expect(c).toEqual([]);
  });
  it('still extracts real set names', () => {
    expect(extractSetNameCandidates('The LEGO Death Star returns.')).toContain('Death Star');
  });
});

describe('Gate 13: the standard code line (round 3: no disclosure beside the code)', () => {
  it('a non-standard mention fails', () => {
    expect(nonStandardAffiliateMentions('ABHINAV12 gets you 12% off full-price sets at Toycra.')).toHaveLength(1);
  });
  it('the old commission wording now fails', () => {
    expect(nonStandardAffiliateMentions('Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra (we earn a commission).')).toHaveLength(1);
  });
  it('the mid-sentence form of the standard line passes', () => {
    expect(nonStandardAffiliateMentions('LEGO.in and Toycra are the stores to watch — code ABHINAV12 takes 12% off full-price sets at Toycra, minimum order ₹500.')).toEqual([]);
  });
});
