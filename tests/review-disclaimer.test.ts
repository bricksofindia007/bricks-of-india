import { describe, it, expect } from 'vitest';
import {
  DISCLAIMER_TEXT,
  disclaimerTextFor,
  resolveUnlistedDisclaimerVariant,
  resolveDisclaimerVariant,
  addUnlistedDisclaimerLine,
  InvalidReviewVerdictError,
} from '../src/lib/review-disclaimer';

describe('unlisted reviews (no retailer link)', () => {
  it('maps BUY NOW, WAIT and AVOID to their variants', () => {
    expect(resolveUnlistedDisclaimerVariant('BUY NOW')).toBe('buy');
    expect(resolveUnlistedDisclaimerVariant('WAIT')).toBe('wait_unlisted');
    expect(resolveUnlistedDisclaimerVariant('AVOID')).toBe('avoid');
  });

  it('throws for IMPORT ONLY and HUNT IT, as the retailer resolver does', () => {
    expect(() => resolveUnlistedDisclaimerVariant('IMPORT ONLY')).toThrow(InvalidReviewVerdictError);
    expect(() => resolveUnlistedDisclaimerVariant('HUNT IT')).toThrow(InvalidReviewVerdictError);
  });

  it('returns the approved neutral WAIT line without throwing', () => {
    expect(disclaimerTextFor('wait_unlisted')).toBe(
      "Standard disclaimer: if you're rich, you can skip the verdict and just buy it. The rest of us will be here doing math before we hit checkout.",
    );
  });

  it('leaves the retailer WAIT lines and the BUY NOW line as they were', () => {
    expect(disclaimerTextFor('buy')).toBe(
      "Standard disclaimer: if you've got the money, obviously buy it — that's what the verdict says too, for once we all agree.",
    );
    expect(disclaimerTextFor('wait_toycra')).toContain("Toycra's prepaid-only");
    expect(disclaimerTextFor('wait_mybrickhouse')).toContain('HDFC EMI discount');
  });
});

describe('addUnlistedDisclaimerLine (P38: the missing line for reviews with no store)', () => {
  const WAIT_LINE = disclaimerTextFor('wait_unlisted');
  const BUY_LINE = disclaimerTextFor('buy');

  it('adds the WAIT line after the verdict line, with a blank line between', () => {
    const body = 'Good set.\n\nOn that bombshell, it\'s time to say goodbye.\n\nVerdict: WAIT. Good set, but the price will drop.';
    const r = addUnlistedDisclaimerLine(body, 'WAIT');
    expect(r.status).toBe('added');
    expect(r.content).toBe(`${body}\n\n${WAIT_LINE}`);
  });

  it('adds the BUY NOW line when the verdict line is followed by text', () => {
    const body = 'Body.\n\nVerdict: BUY NOW. The price is right.\n\nFootnote here.\n';
    const r = addUnlistedDisclaimerLine(body, 'BUY NOW');
    expect(r.status).toBe('added');
    expect(r.content).toBe(`Body.\n\nVerdict: BUY NOW. The price is right.\n\n${BUY_LINE}\n\nFootnote here.\n`);
    expect(r).toMatchObject({ variant: 'buy' });
  });

  it('keeps a trailing newline after the line', () => {
    const r = addUnlistedDisclaimerLine('Body.\n\nVerdict: AVOID. No.\n', 'AVOID');
    expect(r.content).toBe(`Body.\n\nVerdict: AVOID. No.\n\n${disclaimerTextFor('avoid')}\n`);
  });

  it('leaves a review that already has the line unchanged', () => {
    const body = `Body.\n\nVerdict: WAIT. Good.\n\nStandard disclaimer: something else.`;
    expect(addUnlistedDisclaimerLine(body, 'WAIT')).toEqual({ status: 'present', content: body });
  });

  it('changes nothing when there is no verdict line, or more than one', () => {
    const none = 'Body with no verdict line.';
    expect(addUnlistedDisclaimerLine(none, 'WAIT')).toEqual({ status: 'no_verdict_line', content: none });
    const two = 'Verdict: WAIT. One.\n\nVerdict: WAIT. Two.';
    expect(addUnlistedDisclaimerLine(two, 'WAIT')).toEqual({ status: 'no_verdict_line', content: two });
  });

  it('throws for IMPORT ONLY and HUNT IT', () => {
    expect(() => addUnlistedDisclaimerLine('Verdict: IMPORT ONLY. x', 'IMPORT ONLY')).toThrow(InvalidReviewVerdictError);
    expect(() => addUnlistedDisclaimerLine('Verdict: HUNT IT. x', 'HUNT IT')).toThrow(InvalidReviewVerdictError);
  });
});

describe('existing retailer resolver is unchanged', () => {
  it('still resolves WAIT by retailer', () => {
    expect(resolveDisclaimerVariant('WAIT', 'toycra')).toBe('wait_toycra');
    expect(resolveDisclaimerVariant('WAIT', 'mybrickhouse')).toBe('wait_mybrickhouse');
  });

  it('every variant has text', () => {
    for (const v of Object.keys(DISCLAIMER_TEXT)) {
      expect(DISCLAIMER_TEXT[v as keyof typeof DISCLAIMER_TEXT].startsWith('Standard disclaimer: ')).toBe(true);
    }
  });
});
