import type { SupabaseClient } from '@supabase/supabase-js';

// §4a fix (2026-07-08/09): the CQS `missing_verdict` check only ever scanned
// rendered body text for a marker — the `verdict` column on news_articles/
// reviews is a separate field that can silently disagree with what the body
// actually says. This is exactly how contradictory verdicts on duplicate
// articles (same set, same price data, opposite verdicts) went undetected
// for weeks. There is no single existing "edit a published article" entry
// point in this codebase — corrections happen via one-off fix-*.mjs scripts,
// each writing directly to Supabase. This module is the enforced choke
// point going forward: any script correcting a verdict MUST go through
// `updateArticleVerdict()`, which refuses to write unless the column value
// and the body's own marker agree, so drift can no longer be introduced by
// forgetting to update one side.

export const VALID_VERDICTS = ['BUY NOW', 'WAIT', 'IMPORT ONLY', 'AVOID'] as const;
export type Verdict = typeof VALID_VERDICTS[number];

const VERDICT_MARKER_RE = /Verdict:\s*(BUY NOW|WAIT|IMPORT ONLY|AVOID)\b/i;

export function parseBodyVerdict(body: string): Verdict | null {
  const m = body.match(VERDICT_MARKER_RE);
  return m ? (m[1].toUpperCase() as Verdict) : null;
}

export class VerdictDriftError extends Error {}

/**
 * Throws if `verdict` and the body's own "Verdict: X" marker disagree, or if
 * the body has no marker at all. Callers should fix the mismatch and retry
 * rather than catch-and-ignore — that defeats the point of this guard.
 */
export function assertVerdictConsistent(verdict: Verdict, body: string): void {
  const bodyVerdict = parseBodyVerdict(body);
  if (bodyVerdict === null) {
    throw new VerdictDriftError(`Body has no "Verdict: X" marker at all — cannot write verdict column "${verdict}" without a matching body marker.`);
  }
  if (bodyVerdict !== verdict) {
    throw new VerdictDriftError(`verdict column "${verdict}" disagrees with body marker "${bodyVerdict}" — fix one to match the other before writing.`);
  }
}

/**
 * The one enforced write path for correcting a published article's verdict.
 * Writes `verdict` and `content` in a single `.update()` call (Postgres
 * commits multi-column updates atomically per-row already — the guarantee
 * this adds is that the two values are never written separately, and never
 * written while disagreeing with each other).
 */
export async function updateArticleVerdict(
  supabase: SupabaseClient,
  table: string,
  matchColumn: string,
  matchValue: string,
  verdict: Verdict,
  body: string,
): Promise<void> {
  assertVerdictConsistent(verdict, body);
  const { error } = await supabase.from(table).update({ verdict, content: body }).eq(matchColumn, matchValue);
  if (error) throw error;
}
