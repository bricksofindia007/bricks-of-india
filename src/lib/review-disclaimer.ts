// Reviews source pipeline — retailer-conditional verdict disclaimer.
//
// Single source of truth for resolving which disclaimer variant belongs to
// a given (verdict, source_retailer) pair, per the terminal prompt's
// Section 5 table (2026-07-30). Imported by both src/lib/publish-draft.ts
// (resolves + splices at publish time) and scripts/content-linter.mjs (CQS
// disclaimer-consistency gate) so the two can never drift from each other.

export type ReviewVerdict = 'BUY NOW' | 'WAIT' | 'AVOID';
export type SourceRetailer = 'mybrickhouse' | 'toycra' | 'both';

export const STORE_DISPLAY_NAME: Record<SourceRetailer, string> = {
  mybrickhouse: 'MyBrickHouse',
  toycra:       'Toycra',
  both:         'MyBrickHouse and Toycra',
};

export type DisclaimerVariant = 'buy' | 'wait_mybrickhouse' | 'wait_toycra' | 'avoid';

export const DISCLAIMER_TEXT: Record<DisclaimerVariant, string> = {
  buy: "Standard disclaimer: if you've got the money, obviously buy it — that's what the verdict says too, for once we all agree.",
  wait_mybrickhouse: "Standard disclaimer: rich readers can skip the verdict and just buy it. We'll be over here checking if MyBrickHouse's HDFC EMI discount makes this hurt less.",
  wait_toycra: "Standard disclaimer: rich readers can skip the verdict and just buy it. Toycra's prepaid-only, so the rest of us will be here doing sums before we hit checkout.",
  avoid: 'Standard disclaimer: this one we mean literally — money doesn\'t fix bad design. Even the rich readers should sit this one out.',
};

export class InvalidReviewVerdictError extends Error {
  verdict: string;
  constructor(verdict: string) {
    super(`Reviews sourced from the retailer pipeline cannot carry verdict "${verdict}" — only BUY NOW/WAIT/AVOID are valid (IMPORT ONLY is structurally excluded: listing on MyBrickHouse/Toycra is the entry condition).`);
    this.name = 'InvalidReviewVerdictError';
    this.verdict = verdict;
  }
}

/**
 * Resolves the disclaimer variant for a (verdict, source_retailer) pair.
 * WAIT is retailer-conditional (MyBrickHouse's real EMI discount vs
 * Toycra's prepaid-only checkout) — 'both' is treated the same as
 * MyBrickHouse-only for WAIT, per spec, since MyBrickHouse's EMI is still
 * genuinely available to the reader in that case.
 *
 * Throws InvalidReviewVerdictError for anything other than the three valid
 * verdicts (in particular IMPORT ONLY, which should never reach this
 * pipeline — see the DB CHECK on reviews.verdict and the publish-time
 * backstop in publish-draft.ts).
 */
export function resolveDisclaimerVariant(
  verdict: string,
  sourceRetailer: SourceRetailer,
): DisclaimerVariant {
  switch (verdict) {
    case 'BUY NOW':
      return 'buy';
    case 'AVOID':
      return 'avoid';
    case 'WAIT':
      return sourceRetailer === 'toycra' ? 'wait_toycra' : 'wait_mybrickhouse';
    default:
      throw new InvalidReviewVerdictError(verdict);
  }
}

export function disclaimerTextFor(variant: DisclaimerVariant): string {
  return DISCLAIMER_TEXT[variant];
}
