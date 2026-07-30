// CQS gates for reviews sourced from the MyBrickHouse/Toycra retailer
// pipeline (2026-07-30), Section 6 of the reviews pipeline overhaul.
// Pure function, no I/O — extracted so it's independently testable
// (tests/review-source-quality.test.ts) rather than living inline inside
// scripts/content-linter.mjs's per-article loop.

import { resolveDisclaimerVariant, InvalidReviewVerdictError } from './review-disclaimer';

export type ReviewSourceGateSeverity = 'critical' | 'warning' | 'info';

export type ReviewSourceGateIssue = {
  checkName: string;
  severity: ReviewSourceGateSeverity;
  detail: string;
};

export type ReviewForGateCheck = {
  verdict: string | null;
  source_retailer: string | null;
  source_price_inr: number | null;
  source_stock_status: string | null;
  source_checked_at: string | null;
  verdict_disclaimer_variant: string | null;
};

const VALID_VERDICTS = ['BUY NOW', 'WAIT', 'AVOID'];
const SOURCE_FRESHNESS_MAX_DAYS = 8; // Wed 05:00 UTC cron + a day of slack

/**
 * Runs all four reviews-source-pipeline gates against one review row.
 * Only meaningful for rows with source_retailer set (retailer-pipeline
 * rows) — callers should not call this for legacy RADAR-sourced reviews
 * (source_retailer null), though every check here is a no-op/pass in that
 * case anyway since the fabrication/validity/consistency checks all key off
 * fields that would also be null there.
 */
export function checkReviewSourceGates(review: ReviewForGateCheck): ReviewSourceGateIssue[] {
  const issues: ReviewSourceGateIssue[] = [];

  // Gate: no-fabrication backstop.
  if (review.source_price_inr == null || review.source_stock_status == null) {
    issues.push({
      checkName: 'review_source_no_fabrication',
      severity: 'critical',
      detail: `source_retailer=${review.source_retailer} but source_price_inr=${review.source_price_inr} source_stock_status=${review.source_stock_status}`,
    });
  }

  // Gate: verdict-validity backstop.
  const verdictValid = VALID_VERDICTS.includes(String(review.verdict));
  if (!verdictValid) {
    issues.push({
      checkName: 'review_source_verdict_validity',
      severity: 'critical',
      detail: `verdict "${review.verdict}" is not valid for a retailer-sourced review (only BUY NOW/WAIT/AVOID)`,
    });
  } else {
    // Gate: disclaimer-consistency (only meaningful once verdict is valid —
    // resolveDisclaimerVariant throws for anything else, already covered above).
    try {
      const expected = resolveDisclaimerVariant(review.verdict as string, review.source_retailer as 'mybrickhouse' | 'toycra' | 'both');
      if (review.verdict_disclaimer_variant !== expected) {
        issues.push({
          checkName: 'review_source_disclaimer_consistency',
          severity: 'critical',
          detail: `verdict_disclaimer_variant is "${review.verdict_disclaimer_variant}" but (verdict=${review.verdict}, source_retailer=${review.source_retailer}) resolves to "${expected}"`,
        });
      }
    } catch (e) {
      if (!(e instanceof InvalidReviewVerdictError)) throw e;
      // else: already flagged by review_source_verdict_validity above.
    }
  }

  // Gate: source-freshness (operational alert, not a content failure).
  if (!review.source_checked_at) {
    issues.push({
      checkName: 'source_freshness_stale',
      severity: 'warning',
      detail: 'source_retailer is set but source_checked_at is null',
    });
  } else {
    const ageDays = (Date.now() - new Date(review.source_checked_at).getTime()) / (24 * 60 * 60 * 1000);
    if (ageDays > SOURCE_FRESHNESS_MAX_DAYS) {
      issues.push({
        checkName: 'source_freshness_stale',
        severity: 'warning',
        detail: `source_checked_at is ${ageDays.toFixed(1)} days old — reviews-weekly-refresh.yml may have missed this row`,
      });
    }
  }

  return issues;
}
