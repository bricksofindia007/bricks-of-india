export type DraftRow = {
  source_excerpt?: string | null;
  fullBody?: string | null;
};

// Layer 2 rule (locked): Cerebras failover only when there's enough real source text
// to ground the generation — i.e. enough of either signal the prompt builder can use
// (draft-prompt.ts: `content = fullBody || sourceExcerpt || sourceTitle`).
//
// Bug fixed 2026-06-28 (HIGH-52 investigation): this previously checked source_excerpt
// alone, even though fullBody (live-fetched article text, up to 4000 chars) is fetched
// for every row and takes priority in the actual prompt. That meant rows with no stored
// excerpt but a perfectly good fullBody fetch were wrongly blocked from Cerebras failover —
// 359/532 (67.5%) of the 2026-06-28 backlog had source_excerpt null/<200 chars, but most
// share a domain (BrickNerd, Brothers Brick, Brickset) where fetchFullBody() reliably
// succeeds. Eligible if EITHER signal alone clears the 200-char bar — a short/failed
// fullBody fetch must not shadow a perfectly good stored excerpt, and vice versa.
export function isCerebrasEligible(draft: DraftRow): boolean {
  const fullBodyLen = (draft.fullBody ?? '').length;
  const excerptLen  = (draft.source_excerpt ?? '').length;
  return fullBodyLen >= 200 || excerptLen >= 200;
}
