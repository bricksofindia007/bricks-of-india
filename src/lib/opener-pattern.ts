// Gate 12 (#194, 2026-09-26): banned opener pattern.
//
// PR #193 removed "Your wallet called…" from the prompt's example openers and
// added an explicit ban, but the model kept opening with it (the first guide
// after the fix: "Your wallet called. It wants a calm, rational discussion…").
// Gate 8 (opener uniqueness) only catches near-duplicates of recent pieces, so
// reworded variants pass. Operator decision 2026-09-26: a deterministic gate on
// the opening sentence, ONE regeneration with explicit feedback, then reject.
// Only the opening sentence is checked -- the wallet as a character later in
// the piece is house style and stays allowed.

// Replaced 4 Oct 2026 (Abhinav, round 11 D1): the ban on every "Your wallet…" / "The wallet…" opener
// (#194 widened by #237) is gone. BOI voice openers, wallet lines included, are allowed in new drafts.
// What is not allowed: an opening sentence used in any of the last 10 published articles (compared
// with case, digits, set numbers and punctuation ignored, so only the set number swapped still counts
// as the same opener). The prompt's own copyable example opener stays removed (#517).
export const RECENT_OPENERS_WINDOW = 10;

/** Opening sentence with case, digits and punctuation ignored. */
export function normalizeOpening(sentence: string): string {
  return sentence.toLowerCase().replace(/\d+/g, '').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** First sentence of a body, ignoring leading HTML comments, markdown markers and blank lines. */
export function openingSentence(body: string): string {
  const text = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[\s>#*_-]+/, '')
    .trimStart();
  const m = text.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : text.split('\n')[0]).trim();
}

/** The opening sentence of `body` if it is the same as one of `recentBodies`' opening sentences, else null. */
export function reusedOpener(body: string, recentBodies: string[]): string | null {
  const first = openingSentence(body);
  const n = normalizeOpening(first);
  if (n.length < 12) return null;
  return recentBodies.some((b) => normalizeOpening(openingSentence(b ?? '')) === n) ? first : null;
}

export const OPENER_FEEDBACK =
  'Your opening sentence is the same as one used in a recent article. Rewrite ONLY the opening sentence so it is new to this piece. BOI voice openers, wallet lines included, are fine.';
