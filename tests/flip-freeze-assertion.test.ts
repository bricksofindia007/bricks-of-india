/**
 * Reviews weekly refresh — flip-freeze self-verifying assertion.
 *
 * Confirms the failure path actually throws (non-zero exit when uncaught)
 * with the specific row/fields identified, and confirms the pass path
 * doesn't throw on genuinely unchanged data. No live/DB access, no
 * synthetic corruption of real data — pure function, crafted inputs.
 *
 * Run: npx vitest run tests/flip-freeze-assertion.test.ts
 */

import { describe, it, expect } from 'vitest';
import { assertFlipFreezeGuarantee, FlipFreezeViolationError, type ReviewSnapshot, type LiveReviewRow } from '../src/lib/flip-freeze-assertion';

const UNCHANGED_BLOCK = 'Priced at ₹35,999 on Toycra, confirmed in stock as of 30 Jul 2026.\nVerdict: WAIT.\n\nStandard disclaimer: rich readers can skip the verdict and just buy it. Toycra\'s prepaid-only, so the rest of us will be here doing sums before we hit checkout.';

function makeSnapshot(overrides: Partial<ReviewSnapshot> = {}): ReviewSnapshot {
  return {
    verdict: 'WAIT',
    verdict_disclaimer_variant: 'wait_toycra',
    indiaParagraphBlock: UNCHANGED_BLOCK,
    ...overrides,
  };
}

function wrapInArticle(block: string): string {
  return `Some opening prose about the set.\n\n${block}\n\nSome closing prose.`;
}

describe('assertFlipFreezeGuarantee', () => {
  it('does NOT throw when the live row is genuinely unchanged', () => {
    const snapshot = new Map([['row-1', makeSnapshot()]]);
    const liveRows: LiveReviewRow[] = [{
      id: 'row-1', slug: 'lego-red-dragon-21348-worth-35999',
      verdict: 'WAIT', verdict_disclaimer_variant: 'wait_toycra',
      content: wrapInArticle(UNCHANGED_BLOCK),
    }];
    expect(() => assertFlipFreezeGuarantee(snapshot, liveRows)).not.toThrow();
  });

  it('throws FlipFreezeViolationError when verdict changed on a flagged row', () => {
    const snapshot = new Map([['row-1', makeSnapshot()]]);
    const liveRows: LiveReviewRow[] = [{
      id: 'row-1', slug: 'lego-red-dragon-21348-worth-35999',
      verdict: 'BUY NOW', // simulated corruption — should have stayed WAIT
      verdict_disclaimer_variant: 'wait_toycra',
      content: wrapInArticle(UNCHANGED_BLOCK),
    }];
    let caught: unknown;
    try {
      assertFlipFreezeGuarantee(snapshot, liveRows);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(FlipFreezeViolationError);
    const err = caught as FlipFreezeViolationError;
    expect(err.mismatches).toHaveLength(1);
    expect(err.mismatches[0]).toContain('lego-red-dragon-21348-worth-35999');
    expect(err.mismatches[0]).toContain('verdict: "WAIT" -> "BUY NOW"');
    expect(err.message).toContain('FAILED');
    expect(err.message).toContain('must never happen');
  });

  it('throws when verdict_disclaimer_variant changed but verdict did not', () => {
    const snapshot = new Map([['row-1', makeSnapshot()]]);
    const liveRows: LiveReviewRow[] = [{
      id: 'row-1', slug: 'lego-red-dragon-21348-worth-35999',
      verdict: 'WAIT',
      verdict_disclaimer_variant: 'wait_mybrickhouse', // simulated drift
      content: wrapInArticle(UNCHANGED_BLOCK),
    }];
    expect(() => assertFlipFreezeGuarantee(snapshot, liveRows)).toThrow(FlipFreezeViolationError);
    try { assertFlipFreezeGuarantee(snapshot, liveRows); } catch (e) {
      expect((e as FlipFreezeViolationError).mismatches[0]).toContain('verdict_disclaimer_variant: "wait_toycra" -> "wait_mybrickhouse"');
    }
  });

  it('throws when the India Paragraph block text changed', () => {
    const snapshot = new Map([['row-1', makeSnapshot()]]);
    const mutatedBlock = 'Priced at ₹29,999 on Toycra, confirmed in stock as of 31 Jul 2026.\nVerdict: WAIT.\n\nStandard disclaimer: rich readers can skip the verdict and just buy it. Toycra\'s prepaid-only, so the rest of us will be here doing sums before we hit checkout.';
    const liveRows: LiveReviewRow[] = [{
      id: 'row-1', slug: 'lego-red-dragon-21348-worth-35999',
      verdict: 'WAIT', verdict_disclaimer_variant: 'wait_toycra',
      content: wrapInArticle(mutatedBlock),
    }];
    expect(() => assertFlipFreezeGuarantee(snapshot, liveRows)).toThrow(FlipFreezeViolationError);
    try { assertFlipFreezeGuarantee(snapshot, liveRows); } catch (e) {
      expect((e as FlipFreezeViolationError).mismatches[0]).toContain('India Paragraph block changed');
    }
  });

  it('reports every mismatched field together, not just the first one found', () => {
    const snapshot = new Map([['row-1', makeSnapshot()]]);
    const liveRows: LiveReviewRow[] = [{
      id: 'row-1', slug: 'lego-red-dragon-21348-worth-35999',
      verdict: 'AVOID', verdict_disclaimer_variant: 'avoid',
      content: wrapInArticle('completely different block, no valid pattern here'),
    }];
    try {
      assertFlipFreezeGuarantee(snapshot, liveRows);
      throw new Error('expected assertFlipFreezeGuarantee to throw');
    } catch (e) {
      const err = e as FlipFreezeViolationError;
      expect(err.mismatches[0]).toContain('verdict:');
      expect(err.mismatches[0]).toContain('verdict_disclaimer_variant:');
      expect(err.mismatches[0]).toContain('India Paragraph block changed');
    }
  });

  it('treats a live row with no matching snapshot as its own violation', () => {
    const snapshot = new Map<string, ReviewSnapshot>(); // empty — row-1 was never snapshotted
    const liveRows: LiveReviewRow[] = [{
      id: 'row-1', slug: 'lego-unsnapshotted-review',
      verdict: 'WAIT', verdict_disclaimer_variant: 'wait_toycra',
      content: wrapInArticle(UNCHANGED_BLOCK),
    }];
    expect(() => assertFlipFreezeGuarantee(snapshot, liveRows)).toThrow(FlipFreezeViolationError);
    try { assertFlipFreezeGuarantee(snapshot, liveRows); } catch (e) {
      expect((e as FlipFreezeViolationError).mismatches[0]).toContain('no pre-run snapshot found');
    }
  });

  it('does not throw when liveRows is empty (no flip candidates were flagged this run)', () => {
    const snapshot = new Map([['row-1', makeSnapshot()]]);
    expect(() => assertFlipFreezeGuarantee(snapshot, [])).not.toThrow();
  });
});
