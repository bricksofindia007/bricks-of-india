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

/** "Your wallet called / blinked / wants …" as the opening sentence. */
export const BANNED_OPENER_RE = /^\s*your\s+wallet\b[^.!?\n]{0,25}?\b(called|calls|blinked|blinks|wants|wanted)\b/i;

/** First sentence of a body, ignoring leading HTML comments, markdown markers and blank lines. */
export function openingSentence(body: string): string {
  const text = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[\s>#*_-]+/, '')
    .trimStart();
  const m = text.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : text.split('\n')[0]).trim();
}

/** The banned opener found in `body`, or null. */
export function bannedOpener(body: string): string | null {
  const first = openingSentence(body);
  return BANNED_OPENER_RE.test(first) ? first : null;
}

export const OPENER_FEEDBACK =
  'Your draft opens with "Your wallet called/blinked/wants…", which is banned. Rewrite ONLY the opening sentence: open with the set, the news or a concrete fact instead. The wallet can still appear later in the piece.';
