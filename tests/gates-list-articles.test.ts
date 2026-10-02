// 2 Oct 2026: gate false positives found publishing the Brick Rush list article.
import { describe, it, expect } from 'vitest';
import { extractSetNameCandidates } from '../src/lib/lint';
import { undisclosedAffiliateMentions } from '../src/lib/affiliate-disclosure';

describe('factuality: non-set phrases after "LEGO"', () => {
  it('ignores LEGO Certified Store(s), India MRP, User Group', () => {
    const c = extractSetNameCandidates("Only in LEGO Certified Stores. The LEGO Certified Store India post. LEGO India MRP rose. A LEGO User Group met.");
    expect(c).toEqual([]);
  });
  it('still extracts real set names', () => {
    expect(extractSetNameCandidates('The LEGO Death Star returns.')).toContain('Death Star');
  });
});

describe('Gate 13: disclosure', () => {
  it('a same-sentence Disclosure link counts', () => {
    expect(undisclosedAffiliateMentions('ABHINAV12 gets you 12% off full-price sets at Toycra ([Disclosure](/legal/affiliate-disclosure)).')).toEqual([]);
  });
  it('a bare mention still fails', () => {
    expect(undisclosedAffiliateMentions('ABHINAV12 gets you 12% off full-price sets at Toycra.')).toHaveLength(1);
  });
  it('the commission wording still passes', () => {
    expect(undisclosedAffiliateMentions('Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra (we earn a commission).')).toEqual([]);
  });
});
