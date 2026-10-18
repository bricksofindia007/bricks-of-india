import { describe, expect, it } from 'vitest';
import { EXISTING_REVIEW_VERDICT_LINES } from '@/lib/review-existing-verdict-lines';
import { resolveUnlistedDisclaimerVariant, InvalidReviewVerdictError } from '@/lib/review-disclaimer';

describe('existing-review standard lines (owner-approved option B, verbatim)', () => {
  it('IMPORT ONLY line is the approved text', () => {
    expect(EXISTING_REVIEW_VERDICT_LINES['IMPORT ONLY']).toBe(
      "Standard disclaimer: if you're rich, you can import it and skip the wait. The rest of us will be here checking whether an Indian store ever stocks it, and doing the sums first. If you're determined enough to import this one, do the maths on freight and customs first.",
    );
  });

  it('HUNT IT line is the approved text', () => {
    expect(EXISTING_REVIEW_VERDICT_LINES['HUNT IT']).toBe(
      "Standard disclaimer: if you're rich, you can skip the hunt and just buy it. The rest of us will be out looking for a better deal before we check out.",
    );
  });

  it('both lines start with the standard prefix the other variants use', () => {
    for (const line of Object.values(EXISTING_REVIEW_VERDICT_LINES)) {
      expect(line.startsWith('Standard disclaimer: ')).toBe(true);
    }
  });

  it('the publish path still rejects these verdicts (this list is for the data fix only)', () => {
    expect(() => resolveUnlistedDisclaimerVariant('IMPORT ONLY')).toThrow(InvalidReviewVerdictError);
    expect(() => resolveUnlistedDisclaimerVariant('HUNT IT')).toThrow(InvalidReviewVerdictError);
  });
});
