// A5 (#459): the retired flag must never produce an availability claim.
import { describe, it, expect } from 'vitest';
import { fixContent, NEW_VERDICT_LINE, NEW_DISCLAIMER_LINE, AVAILABILITY_CLAIM } from '../scripts/lib/retired-verdict.mjs';

const OLD = `Some review text.

Verdict: BUY NOW. Great set.

Standard disclaimer: if you've got the money, obviously buy it.`;

describe('retirement-check rewrite', () => {
  it('replaces the verdict and disclaimer lines', () => {
    const out = fixContent(OLD);
    expect(out).toContain(NEW_VERDICT_LINE);
    expect(out).toContain(NEW_DISCLAIMER_LINE);
    expect(out).toContain('Some review text.');
  });
  it('never claims the set is unavailable', () => {
    expect(fixContent(OLD)).not.toMatch(AVAILABILITY_CLAIM);
    expect(fixContent(OLD)).not.toMatch(/no longer available|nothing left to buy/i);
  });
  it('the claim pattern catches the old wording', () => {
    expect('This set has been discontinued by LEGO and is no longer available through MyBrickHouse or Toycra.').toMatch(AVAILABILITY_CLAIM);
    expect("Standard disclaimer: this set is retired — there's nothing left to buy.").toMatch(AVAILABILITY_CLAIM);
  });
});
