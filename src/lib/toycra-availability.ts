/**
 * HIGH-49 — ABHINAV12 affiliate code placement rule.
 *
 * Policy locked 2026-06-30 (Abhinav, explicit): "my code abhinav12 should
 * only be mentioned if and when the set is available on toycra. if it is
 * not available only there is absolutely no point in mentioning that.
 * also, sets which will be import also do not need that message either."
 *
 * The naive rule ("any Toycra mention requires the code") is too blunt --
 * verified against the 8 articles that originally triggered HIGH-49 that
 * only 2 of 8 actually warranted the code: the other 6 correctly describe
 * sets as not-yet-available, never carried, or possibly import-only, and
 * adding the code there would have been a content error, not a fix.
 *
 * Detects "genuinely, currently purchasable at Toycra right now" by
 * requiring a real ₹ price figure within an 80-char window of a Toycra
 * mention, with no hedging/future-availability/import language inside
 * THAT SAME WINDOW (not the whole sentence). The whole-sentence version
 * of this check was tried first and caught a real bug before shipping:
 * the actual text "Toycra is selling it at ₹41,599 ... though it might
 * be out of stock" was incorrectly flagged as hedged, because "might be"
 * appeared later in the same long, multi-clause sentence as a STOCK-level
 * caveat -- a different concept from price/availability hedging. Scoping
 * the hedge check to the matched window itself (not the full sentence)
 * fixed this while still correctly catching genuine availability hedges.
 * It's a heuristic over generated prose, not a perfect classifier --
 * false negatives (a genuinely-available set phrased unusually) are
 * possible and should be caught by editorial review, not assumed
 * impossible.
 */

const NEAR_PRICE_RE = /toycra[^.]{0,80}₹[\d,]+|₹[\d,]+[^.]{0,80}toycra/i;
const HEDGE_RE = /will (be|appear)|expect|likely|eventually|usually list|to watch for|potentially|or it might|not yet confirmed|no specific.*pricing|shortly after|to stock it eventually|not carry|will not find|might be (the )?(primary|available|an import)/i;

export function genuinelyAvailableAtToycra(content: string | null | undefined): boolean {
  const text = content || '';
  const match = NEAR_PRICE_RE.exec(text);
  if (!match) return false;
  return !HEDGE_RE.test(match[0]);
}
