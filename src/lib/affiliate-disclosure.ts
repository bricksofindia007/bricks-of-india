// Gate 13 (#212 / PR-D follow-up, operator decision 2026-09-27): every
// in-text ABHINAV12 mention carries a commission disclosure IN THE SAME
// SENTENCE. /legal/affiliate-disclosure promises the disclosure is on the
// page; the banner line covers the page chrome, this covers article text.

/** The one sanctioned affiliate sentence -- used by the draft prompt, the
 *  publish-time injection and scripts, so they can never drift apart. */
export const AFFILIATE_NOTE = 'Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra (we earn a commission).';

/** Sentences that mention ABHINAV12 without "commission" in the same sentence. */
export function undisclosedAffiliateMentions(text: string): string[] {
  const sentences = text.match(/[^.!?\n]*ABHINAV12[^.!?\n]*(?:[.!?]|$)/gi) ?? [];
  return sentences.map((s) => s.trim()).filter((s) => !/commission/i.test(s));
}

export const AFFILIATE_FEEDBACK =
  `Every sentence that mentions ABHINAV12 must also disclose the commission in that same sentence. Use exactly: "${AFFILIATE_NOTE}" and never apply the 12% to a price.`;
