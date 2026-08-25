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
 *
 * BOI Fix Brief (2026-08-24), Phase 2.3: the window itself had a real,
 * confirmed-live bug, distinct from the whole-sentence problem above.
 * NEAR_PRICE_RE's two alternatives each capture context on only ONE side
 * of the match (either "toycra" onward to the price, or the price onward
 * to "toycra") -- so text immediately AFTER a "...₹41,199 — Toycra"-style
 * match (e.g. "doesn't currently list it") fell completely outside the
 * captured window and was invisible to the hedge check, regardless of
 * window size. Confirmed live: 2 real articles stating "MyBrickHouse has
 * this set for ₹X — Toycra doesn't currently list it" -- a textbook
 * hedge -- evaluated genuinelyAvailableAtToycra() = true, because the
 * regex capture ended exactly at the word "toycra" and never saw what
 * came after it. Separately, "doesn't/does not currently list/carry/
 * stock/sell" was never in HEDGE_RE at all -- would still have been
 * invisible even with a wider window. Fixed both: scan every "toycra"
 * occurrence and build a window spanning BOTH directions from it, and
 * added the missing negation-of-availability hedge pattern.
 */

const HEDGE_RE = /will (be|appear)|expect|likely|eventually|usually list|to watch for|potentially|or it might|not yet confirmed|no specific.*pricing|shortly after|to stock it eventually|not carry|will not find|might be (the )?(primary|available|an import)|does(n't| not)\s*(currently\s*)?(list|carry|stock|sell|have)/i;
const WINDOW_CHARS = 80;

export function genuinelyAvailableAtToycra(content: string | null | undefined): boolean {
  const text = content || '';
  const toycraRe = /toycra/gi;
  let m: RegExpExecArray | null;
  while ((m = toycraRe.exec(text)) !== null) {
    const start = Math.max(0, m.index - WINDOW_CHARS);
    const end = Math.min(text.length, m.index + m[0].length + WINDOW_CHARS);
    const window = text.slice(start, end);
    if (/₹[\d,]+/.test(window) && !HEDGE_RE.test(window)) return true;
  }
  return false;
}
