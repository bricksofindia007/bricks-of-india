/**
 * Reviews source pipeline — CQS gate tests (Section 6 of the 2026-07-30
 * overhaul). Hardcoded mock review rows, no DB access, no live fetch —
 * exercises each gate's actual failure path directly rather than relying on
 * whatever real rows happen to exist in production at test time.
 *
 * Run: npx vitest run tests/review-source-quality.test.ts
 */

import { describe, it, expect } from 'vitest';
import { checkReviewSourceGates, type ReviewForGateCheck } from '../src/lib/review-source-quality';

const NOW = new Date().toISOString();
const TEN_DAYS_AGO = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

function base(overrides: Partial<ReviewForGateCheck>): ReviewForGateCheck {
  return {
    verdict: 'BUY NOW',
    source_retailer: 'toycra',
    source_price_inr: 5999,
    source_stock_status: 'in_stock',
    source_checked_at: NOW,
    verdict_disclaimer_variant: 'buy',
    ...overrides,
  };
}

describe('checkReviewSourceGates', () => {
  it('clean BUY NOW row → no flags', () => {
    const row = base({ verdict: 'BUY NOW', source_retailer: 'toycra', verdict_disclaimer_variant: 'buy' });
    expect(checkReviewSourceGates(row)).toEqual([]);
  });

  it('clean WAIT / mybrickhouse row → no flags', () => {
    const row = base({ verdict: 'WAIT', source_retailer: 'mybrickhouse', verdict_disclaimer_variant: 'wait_mybrickhouse' });
    expect(checkReviewSourceGates(row)).toEqual([]);
  });

  it('clean WAIT / toycra row → no flags', () => {
    const row = base({ verdict: 'WAIT', source_retailer: 'toycra', verdict_disclaimer_variant: 'wait_toycra' });
    expect(checkReviewSourceGates(row)).toEqual([]);
  });

  it('clean AVOID row → no flags', () => {
    const row = base({ verdict: 'AVOID', source_retailer: 'both', verdict_disclaimer_variant: 'avoid' });
    expect(checkReviewSourceGates(row)).toEqual([]);
  });

  it('source_price_inr null → review_source_no_fabrication', () => {
    const row = base({ source_price_inr: null });
    const issues = checkReviewSourceGates(row);
    expect(issues.map(i => i.checkName)).toContain('review_source_no_fabrication');
    expect(issues.find(i => i.checkName === 'review_source_no_fabrication')?.severity).toBe('critical');
  });

  it("verdict: 'IMPORT ONLY' → review_source_verdict_validity", () => {
    const row = base({ verdict: 'IMPORT ONLY', verdict_disclaimer_variant: null });
    const issues = checkReviewSourceGates(row);
    expect(issues.map(i => i.checkName)).toContain('review_source_verdict_validity');
    expect(issues.find(i => i.checkName === 'review_source_verdict_validity')?.severity).toBe('critical');
    // Must not also throw trying to resolve a disclaimer variant for an invalid verdict.
    expect(issues.map(i => i.checkName)).not.toContain('review_source_disclaimer_consistency');
  });

  it('correct verdict/retailer but mismatched verdict_disclaimer_variant → review_source_disclaimer_consistency', () => {
    // WAIT + toycra should resolve to 'wait_toycra', not 'wait_mybrickhouse'.
    const row = base({ verdict: 'WAIT', source_retailer: 'toycra', verdict_disclaimer_variant: 'wait_mybrickhouse' });
    const issues = checkReviewSourceGates(row);
    expect(issues.map(i => i.checkName)).toContain('review_source_disclaimer_consistency');
    expect(issues.find(i => i.checkName === 'review_source_disclaimer_consistency')?.detail).toContain('wait_toycra');
  });

  it('source_checked_at 10 days old → source_freshness_stale', () => {
    const row = base({ source_checked_at: TEN_DAYS_AGO });
    const issues = checkReviewSourceGates(row);
    expect(issues.map(i => i.checkName)).toContain('source_freshness_stale');
    expect(issues.find(i => i.checkName === 'source_freshness_stale')?.severity).toBe('warning');
  });
});
