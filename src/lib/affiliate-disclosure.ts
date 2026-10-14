// Gate 13 (#212). Round 3 (Abhinav, 2 Oct 2026 night): the affiliate disclosure lives only on the
// legal pages (/legal/affiliate-disclosure and the Terms clause), never beside the code. The gate now
// checks the code line itself: every sentence that mentions ABHINAV12 carries the exact standard
// clause (12%, full-price, ₹500 minimum) and none of the retired wording.

/** The one sanctioned code line -- used by the draft prompt, the publish-time injection, the site
 *  FAQs and scripts, so they can never drift apart. "minimum order", not "min.": the sentence
 *  splitter would cut the sentence at "min.". */
export const AFFILIATE_NOTE = 'Code ABHINAV12 takes 12% off full-price sets at Toycra, minimum order ₹500.';

const STANDARD_CLAUSE = /\bcode ABHINAV12 takes 12% off full-price sets at Toycra, minimum order ₹500(?![\d,])/i;
const RETIRED_WORDING = /commission|affiliate code|no usage limits/i;

/** Sentences that mention ABHINAV12 without the exact standard clause, or with retired wording. */
export function nonStandardAffiliateMentions(text: string): string[] {
  const sentences = text.match(/[^.!?\n]*ABHINAV12[^.!?\n]*(?:[.!?]|$)/gi) ?? [];
  return sentences.map((s) => s.trim()).filter((s) => !STANDARD_CLAUSE.test(s) || RETIRED_WORDING.test(s));
}

export const AFFILIATE_FEEDBACK =
  `Every sentence that mentions ABHINAV12 must use exactly: "${AFFILIATE_NOTE}" (it says full-price). Never write "commission", "affiliate code" or "no usage limits", and never apply the 12% to a price.`;
