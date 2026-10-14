import { describe, it, expect } from 'vitest';
import {
  DISCLAIMER_TEXT,
  disclaimerTextFor,
  resolveUnlistedDisclaimerVariant,
  resolveDisclaimerVariant,
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
      'Standard disclaimer: rich readers can skip the verdict and just buy it. The rest of us will be here doing sums before we hit checkout.',
    );
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
