// Gate 13 (#212 / PR-D follow-up, operator decision 2026-09-27): every
// in-text ABHINAV12 mention carries a commission disclosure IN THE SAME
// SENTENCE. /legal/affiliate-disclosure promises the disclosure is on the
// page; the banner line covers the page chrome, this covers article text.

/** The one sanctioned affiliate sentence -- used by the draft prompt, the
 *  publish-time injection and scripts, so they can never drift apart. */
// Round 11 (chat, 2 Oct 2026): no commission wording beside the code; the same-sentence Disclosure
// link is the disclosure. "minimum order", not "min.": the sentence splitter would cut at "min.".
export const AFFILIATE_NOTE = 'Code ABHINAV12 takes 12% off full-price sets at Toycra, minimum order ₹500 ([Disclosure](/legal/affiliate-disclosure)).';

/** The Disclosure link inside AFFILIATE_NOTE; FAQ answers carry it too (WithDisclosureLink renders it). */
export const DISCLOSURE_MD = '[Disclosure](/legal/affiliate-disclosure)';

// A same-sentence link to the disclosure page also discloses (chat, 2 Oct 2026: "the
// article keeps only the Disclosure link next to the code, as on the rest of the site").
const DISCLOSURE_LINK = /\]\(\/legal\/affiliate-disclosure\)/;

/** Sentences that mention ABHINAV12 with neither "commission" nor a disclosure link. */
export function undisclosedAffiliateMentions(text: string): string[] {
  const sentences = text.match(/[^.!?\n]*ABHINAV12[^.!?\n]*(?:[.!?]|$)/gi) ?? [];
  return sentences.map((s) => s.trim()).filter((s) => !/commission/i.test(s) && !DISCLOSURE_LINK.test(s));
}

export const AFFILIATE_FEEDBACK =
  `Every sentence that mentions ABHINAV12 must carry the Disclosure link in that same sentence. Use exactly: "${AFFILIATE_NOTE}" and never apply the 12% to a price.`;
