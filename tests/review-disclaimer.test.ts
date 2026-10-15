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

describe('addUnlistedDisclaimerLine (the missing line for reviews with no store)', () => {
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

  it('changes nothing when there is no verdict line at all', () => {
    const none = 'Body with no verdict line.';
    expect(addUnlistedDisclaimerLine(none, 'WAIT')).toEqual({ status: 'no_verdict_line', content: none });
  });

  it('a verdict line for a different verdict does not count', () => {
    const body = 'Body.\n\nVerdict: BUY NOW. Only this one.';
    expect(addUnlistedDisclaimerLine(body, 'WAIT')).toEqual({ status: 'no_verdict_line', content: body });
  });

  describe('two verdict lines (mid-article and closing)', () => {
    const MID = 'Verdict: WAIT. Good set, but the price will drop.';
    const mid = `Opening.\n\nAt review, it was priced at ₹11,999 on LEGO.in and Toycra.\n${MID}\n\nMore body text.`;

    it('puts the line after the closing verdict and leaves the mid-article line alone', () => {
      const body = `${mid}\n\nOn that bombshell, it's time to say goodbye. Bubyee.\n\nVerdict: WAIT. Good set, but the price will drop.`;
      const r = addUnlistedDisclaimerLine(body, 'WAIT');
      expect(r.status).toBe('added');
      expect(r.content).toBe(`${body}\n\n${WAIT_LINE}`);
      expect(r.content.split(MID).length - 1).toBe(2); // both verdict lines still there, unchanged
      expect(r.content.indexOf(MID)).toBe(body.indexOf(MID));
    });

    it('keeps the existing blank line after the closing verdict and before a trailing note', () => {
      const body = `${mid}\n\nBubyee.\n\nVerdict: WAIT. Good set, but the price will drop.\n\nUpdated 12 October 2026: price now confirmed.`;
      const r = addUnlistedDisclaimerLine(body, 'WAIT');
      expect(r.content).toBe(
        `${mid}\n\nBubyee.\n\nVerdict: WAIT. Good set, but the price will drop.\n\n${WAIT_LINE}\n\nUpdated 12 October 2026: price now confirmed.`,
      );
    });

    it('handles a closing verdict followed by a correction note', () => {
      const body = `${mid}\n\nBubyee.\n\nVerdict: WAIT. Good set, but the price will drop.\n\n*Correction (14 October 2026): piece count corrected to 747.*\n`;
      const r = addUnlistedDisclaimerLine(body, 'WAIT');
      expect(r.content).toBe(
        `${mid}\n\nBubyee.\n\nVerdict: WAIT. Good set, but the price will drop.\n\n${WAIT_LINE}\n\n*Correction (14 October 2026): piece count corrected to 747.*\n`,
      );
    });

    it('works for BUY NOW with two lines', () => {
      const body = 'Opening.\n\nVerdict: BUY NOW. Already below MRP.\n\nMiddle.\n\nBubyee.\n\nVerdict: BUY NOW. Already below MRP.';
      const r = addUnlistedDisclaimerLine(body, 'BUY NOW');
      expect(r.status).toBe('added');
      expect(r.content).toBe(`${body}\n\n${BUY_LINE}`);
    });

    it('still leaves a body that already has the line unchanged', () => {
      const body = `${mid}\n\nVerdict: WAIT. Good.\n\nStandard disclaimer: something else.`;
      expect(addUnlistedDisclaimerLine(body, 'WAIT')).toEqual({ status: 'present', content: body });
    });
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
