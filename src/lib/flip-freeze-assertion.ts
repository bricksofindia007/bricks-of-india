// Self-verifying flip-freeze assertion for the reviews weekly source refresh
// (scripts/reviews-source-refresh.mjs). Extracted as a pure function so the
// failure path is independently testable (tests/flip-freeze-assertion.test.ts)
// without needing to corrupt real data to exercise it.
//
// The guarantee: a review flagged verdict_flip_candidate must never actually
// have its verdict, disclaimer variant, or India Paragraph text change as a
// side effect of the same run that flagged it. A violation here is not a
// content-quality nit -- it means a live page changed without the chat
// approval the whole flip-freeze design exists to require. Throws, not logs,
// so it fails the job (non-zero exit) rather than passing silently.

import { extractIndiaParagraphBlock } from './publish-draft';

export type ReviewSnapshot = {
  verdict: string | null;
  verdict_disclaimer_variant: string | null;
  indiaParagraphBlock: string | null;
};

export type LiveReviewRow = {
  id: string;
  slug: string;
  verdict: string | null;
  verdict_disclaimer_variant: string | null;
  content: string;
};

export class FlipFreezeViolationError extends Error {
  constructor(public readonly mismatches: string[]) {
    super(
      `[flip-freeze-assertion] FAILED — ${mismatches.length} row(s) flagged as verdict_flip_candidate changed anyway, which must never happen:\n` +
      mismatches.map(m => `  - ${m}`).join('\n'),
    );
    this.name = 'FlipFreezeViolationError';
  }
}

/**
 * Compares each live row against its pre-run snapshot (by id). Throws
 * FlipFreezeViolationError listing every row+field that changed if any
 * mismatch is found. A live row with no matching snapshot is itself treated
 * as a mismatch (an anomaly, not something to silently skip).
 */
export function assertFlipFreezeGuarantee(
  preRunSnapshot: Map<string, ReviewSnapshot>,
  liveRows: LiveReviewRow[],
): void {
  const mismatches: string[] = [];

  for (const live of liveRows) {
    const snap = preRunSnapshot.get(live.id);
    if (!snap) {
      mismatches.push(`${live.slug} (${live.id}): no pre-run snapshot found — cannot verify (this itself is an anomaly)`);
      continue;
    }

    const liveBlock = extractIndiaParagraphBlock(live.content);
    const fields: string[] = [];

    if (live.verdict !== snap.verdict) {
      fields.push(`verdict: "${snap.verdict}" -> "${live.verdict}"`);
    }
    if (live.verdict_disclaimer_variant !== snap.verdict_disclaimer_variant) {
      fields.push(`verdict_disclaimer_variant: "${snap.verdict_disclaimer_variant}" -> "${live.verdict_disclaimer_variant}"`);
    }
    if (liveBlock !== snap.indiaParagraphBlock) {
      fields.push(`India Paragraph block changed (before: ${JSON.stringify(snap.indiaParagraphBlock)}, after: ${JSON.stringify(liveBlock)})`);
    }

    if (fields.length > 0) {
      mismatches.push(`${live.slug} (${live.id}): ${fields.join('; ')}`);
    }
  }

  if (mismatches.length > 0) {
    throw new FlipFreezeViolationError(mismatches);
  }
}
