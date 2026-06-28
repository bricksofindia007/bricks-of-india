import type { GenerationOutcome } from './generate-with-failover';
import { VALID_VERDICTS } from './lint';

// Extracted 2026-06-28 (HIGH-52 session) from scripts/generate-approved-drafts.ts so it
// can be unit tested without importing the operational script — that script has a
// module-scope `process.exit(1)` guard on missing env vars and connects to Supabase/
// Gemini/Cerebras at import time via its IS_MAIN entry-point block, which makes it
// unsafe to import directly in tests. This module has no side effects and no
// external dependencies beyond the GenerationOutcome type and VALID_VERDICTS.

// Policy change 2026-06-28 (Abhinav, this session): "let review/opinion/guide
// auto-publish too, IF they pass the exact same gates as news (no extra human
// gate)". Previously this function hardcoded news-shaped thresholds (wordCount
// 300-500, a literal India-paragraph regex) and the call site additionally
// restricted it to format === 'news' only — so even a perfect review/opinion/
// guide draft could never auto-publish regardless of quality (MEDIUM-13).
//
// "The exact same gates" does NOT mean reusing news's literal numeric
// thresholds against other formats — lintDraft() already computes the
// correct per-format word-count range (WORD_COUNT_TARGETS), the India
// paragraph check with its community/MOC carve-out (isCommunity — a null
// verdict legitimately skips the price/comparison requirement but never the
// store-mention requirement), and per-format verdict handling. Reimplementing
// those with the news-only regex here would silently apply the wrong
// thresholds to other formats (e.g. failing a real 650-word review against a
// 500-word news ceiling) — a different bug, not "the same gates."
//
// So: defer every format-aware gate (word count, India paragraph, verdict-
// for-non-news, factuality, source fidelity) entirely to lintResult.overallPass,
// which lintDraft() already computes correctly per format. The one thing this
// function still checks directly is verdict validity for news specifically,
// because lintDraft() deliberately skips the verdict gate when format==='news'
// (verdictGate stays null) — that gate was always news's own responsibility,
// historically enforced only here. Community/MOC content (verdict === null,
// confirmed real for news too — see MEDIUM-44 Ebon Hawk case) is allowed
// through with no verdict, exactly as lintDraft already treats it for other
// formats; this just extends that same treatment uniformly to news.
export function passesAutoPublishGates(outcome: GenerationOutcome): boolean {
  // Fail closed: lintResult === null means the lint runner itself threw
  // (not "no issues found") — treat as failure, don't auto-publish on an
  // unknown gate state. This single check now covers word count, India
  // paragraph (with community carve-out), verdict (non-news), factuality
  // (Gate 5), and source fidelity (Gate 6) for every format uniformly.
  if (!outcome.lintResult || !outcome.lintResult.overallPass) return false;

  // News-specific verdict check: lintDraft() does not gate verdict for
  // format==='news' (historically news's own responsibility). A null verdict
  // is legitimate community/MOC content (same rule lintDraft applies to other
  // formats); anything else must be one of the four valid verdict strings.
  if (outcome.format === 'news' && outcome.verdict !== null) {
    const v = (outcome.verdict ?? '').trim().toUpperCase();
    if (!VALID_VERDICTS.has(v)) return false;
  }

  return true;
}
