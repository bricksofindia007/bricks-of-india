import type { GenerationOutcome } from './generate-with-failover';

// Extracted 2026-06-28 (HIGH-52 session) from scripts/generate-approved-drafts.ts so it
// can be unit tested without importing the operational script — that script has a
// module-scope `process.exit(1)` guard on missing env vars and connects to Supabase/
// Gemini/Cerebras at import time via its IS_MAIN entry-point block, which makes it
// unsafe to import directly in tests. This module has no side effects and no
// external dependencies beyond the GenerationOutcome type.

export function passesAutoPublishGates(outcome: GenerationOutcome): boolean {
  const { body, verdict, wordCount } = outcome;
  if (wordCount < 300 || wordCount > 500) return false;
  if (!body.includes('<!-- INDIA_PARAGRAPH -->')) return false;
  const seg = body.slice(body.indexOf('<!-- INDIA_PARAGRAPH -->'));
  if (!/\b(MyBrickHouse|Toycra)\b/i.test(seg)) return false;
  if (!/₹[\d,]+/.test(seg)) return false;
  if (!['BUY NOW', 'WAIT', 'IMPORT ONLY', 'AVOID'].includes(verdict ?? '')) return false;

  // Bug fixed 2026-06-28 (HIGH-52 / credibility-priority decision, Abhinav):
  // factuality (Gate 5) and source fidelity (Gate 6) were computed via lintDraft()
  // and stored in outcome.lintResult, but never checked here — only format checks
  // above and Gate 7 (voice/tone, checked separately via requiresManualApproval)
  // could block auto-publish. A factually wrong or source-unfaithful article could
  // auto-publish as long as it had the right word count and a ₹ price. Fail closed:
  // lintResult === null means the lint runner itself threw (not "no issues found"),
  // so treat that the same as overallPass === false — route to manual review, don't
  // auto-publish on an unknown factuality state.
  if (!outcome.lintResult || !outcome.lintResult.overallPass) return false;

  return true;
}
