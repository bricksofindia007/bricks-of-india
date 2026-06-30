/**
 * PR-2a snapshot regression tests.
 * Verifies that the canonical prompt module (src/lib/prompts/draft-prompt.ts)
 * produces byte-identical output to the pre-refactor baseline captured in
 * tests/snapshots/ by running scripts/snapshot-capture.mjs.
 *
 * Run: npx vitest run
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt, VOICE_EXAMPLES, OUTPUT_FORMAT } from '../src/lib/prompts/draft-prompt';
import { extractSetNumberCandidates, extractSetNameCandidates, lintDraft } from '../src/lib/lint';
import { isCerebrasEligible } from '../src/lib/source-quality';
import { passesAutoPublishGates } from '../src/lib/auto-publish-gate';
import { BothProvidersFailedError } from '../src/lib/generate-with-failover';
import { genuinelyAvailableAtToycra } from '../src/lib/toycra-availability';
import type { GenerationOutcome } from '../src/lib/generate-with-failover';

const SNAP = join(__dirname, 'snapshots');
// .replace(/\r\n/g, '\n') added 2026-06-29: read() previously compared raw
// disk bytes against buildSystemPrompt()/buildUserPrompt() output, which is
// always LF (generated in-memory, never touches disk). On a Windows checkout
// with core.autocrlf=true, this failed even after adding .gitattributes
// (eol=lf) -- confirmed live on Abhinav's machine that core.autocrlf still
// won over .gitattributes on that Git-for-Windows install, so `git checkout --`
// kept re-materializing CRLF on disk regardless. Rather than keep chasing
// environment-specific Git config, this removes the actual fragility at its
// source: the test now compares logical content, not raw bytes, so it's
// correct on any OS/Git-config combination, not just the ones currently
// configured correctly. The .gitattributes fix (previous commit) is still
// worth keeping -- it's the right default for fresh clones -- but this is
// the fix that makes the test itself robust rather than dependent on it.
const read = (name: string) => readFileSync(join(SNAP, name), 'utf8').replace(/\r\n/g, '\n');

// ── Fixed fixtures — must match snapshot-capture.mjs exactly ─────────────────

const FIXTURES = {
  news: {
    format: 'news',
    sourceTitle: 'LEGO Technic Bugatti Bolide (42151) Announced for 2026',
    sourceUrl: 'https://www.brothers-brick.com/2026/06/01/lego-technic-bugatti-bolide-42151',
    sourcePublishedAt: '2026-06-01',
    setNumber: '42151',
    fullBody: null,
    sourceExcerpt: 'LEGO has announced the new Technic Bugatti Bolide set for 2026, featuring 905 pieces.',
    indiaPriceContext: 'INDIA PRICE DATA — use these exact figures, do not calculate:\n  MyBrickHouse: ₹8,999\n  Toycra: ₹8,499',
  },
  review: {
    format: 'review',
    sourceTitle: 'LEGO Creator Expert Eiffel Tower 10307 Review',
    sourceUrl: 'https://www.jaysbrickblog.com/2026/05/lego-eiffel-tower-10307-review',
    sourcePublishedAt: '2026-05-15',
    setNumber: '10307',
    fullBody: 'The LEGO Eiffel Tower 10307 is one of the most impressive sets ever released. With 10,001 pieces and standing nearly 5 feet tall when built, it commands attention from any room.',
    sourceExcerpt: null,
    indiaPriceContext: 'INDIA PRICE DATA — use these exact figures, do not calculate:\n  MyBrickHouse: ₹65,999\n  Toycra: ₹61,500',
  },
  opinion: {
    format: 'opinion',
    sourceTitle: 'Why LEGO Icons Sets Are the Best Value in 2026',
    sourceUrl: 'https://brickset.com/article/why-lego-icons-2026',
    sourcePublishedAt: '2026-05-20',
    setNumber: null,
    fullBody: null,
    sourceExcerpt: 'LEGO Icons sets continue to dominate the collector market with excellent part-per-rupee value.',
    indiaPriceContext: 'INDIA PRICE DATA: set number could not be identified from this source. Acknowledge price uncertainty; do not state a specific figure.',
  },
} as const;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('prompt snapshots', () => {
  it('system prompt matches baseline', () => {
    expect(buildSystemPrompt()).toBe(read('system.txt'));
  });

  it('user prompt (news) matches baseline', () => {
    expect(buildUserPrompt(FIXTURES.news)).toBe(read('user-news.txt'));
  });

  it('user prompt (review) matches baseline', () => {
    expect(buildUserPrompt(FIXTURES.review)).toBe(read('user-review.txt'));
  });

  it('user prompt (opinion) matches baseline', () => {
    expect(buildUserPrompt(FIXTURES.opinion)).toBe(read('user-opinion.txt'));
  });
});

// ── Prompt hardening — anti-fabrication and discipline rules ──────────────────

describe('prompt hardening — anti-fabrication rules', () => {
  it('VOICE_EXAMPLES contains anti-fabrication rules block', () => {
    expect(VOICE_EXAMPLES).toContain('ANTI-FABRICATION RULES');
    expect(VOICE_EXAMPLES).toContain('NEVER invent set names');
    expect(VOICE_EXAMPLES).toContain('NEVER use speculative product language');
  });

  it('VOICE_EXAMPLES contains correct/incorrect speculation example pair anchored to pilot failure', () => {
    expect(VOICE_EXAMPLES).toContain('GOOD:');
    expect(VOICE_EXAMPLES).toContain('BAD:');
    expect(VOICE_EXAMPLES).toContain('Panchatantra');
    expect(VOICE_EXAMPLES).toContain('Mumbai Skyline');
  });

  it('VOICE_EXAMPLES contains marker discipline rules', () => {
    expect(VOICE_EXAMPLES).toContain('INDIA PARAGRAPH MARKER DISCIPLINE');
    expect(VOICE_EXAMPLES).toContain('MUST appear INSIDE the <!-- INDIA_PARAGRAPH --> block');
  });

  it('OUTPUT_FORMAT contains verdict line discipline', () => {
    expect(OUTPUT_FORMAT).toContain('VERDICT LINE DISCIPLINE');
    expect(OUTPUT_FORMAT).toContain('EXACTLY ONCE');
  });

  it('anti-fabrication block appears BEFORE existing voice rules (prompt-position priority)', () => {
    const antiFabIdx    = VOICE_EXAMPLES.indexOf('ANTI-FABRICATION RULES');
    const voiceRulesIdx = VOICE_EXAMPLES.search(/BOI VOICE|Jeremy Clarkson|voice rules/i);
    expect(antiFabIdx).toBeGreaterThanOrEqual(0);
    if (voiceRulesIdx >= 0) {
      expect(antiFabIdx).toBeLessThan(voiceRulesIdx);
    }
  });
});

// ── Factuality extraction — pure regex, no DB ─────────────────────────────────

describe('factuality extraction', () => {
  it('extracts set numbers from LEGO context, excludes years and prices', () => {
    const body = [
      'LEGO 21066 is a stunner. Built between 2015 and 2024.',
      'The set 42688 retails at ₹6499 in India.',
      'LEGO has produced over 25000 sets since 1932.',
      'In 2026, we expect more.',
      'Look at #10365 for pirates.',
    ].join('\n');
    const nums = extractSetNumberCandidates(body).sort();
    // Included: 21066 (LEGO context), 42688 (set context), 25000 (LEGO context), 10365 (# context)
    // Excluded: 2015, 2024, 2026 (4-digit years), 1932 (year), 6499 (after ₹)
    expect(nums).toContain('21066');
    expect(nums).toContain('42688');
    expect(nums).toContain('10365');
    expect(nums).not.toContain('2015');
    expect(nums).not.toContain('2024');
    expect(nums).not.toContain('2026');
    expect(nums).not.toContain('1932');
    expect(nums).not.toContain('6499');
  });

  it('extracts set name candidates after LEGO brand', () => {
    const body = [
      'I love LEGO Hogsmeade Village. The set looks great.',
      'LEGO Star Wars Boba Fett looks amazing.',
      'LEGO Ideas has many sets.',
    ].join('\n');
    const names = extractSetNameCandidates(body);
    expect(names.some(n => n.includes('Hogsmeade'))).toBe(true);
    // "Star Wars Boba Fett" — theme-prefixed with specific product name after it
    expect(names.some(n => n.includes('Boba Fett'))).toBe(true);
    // "Ideas" alone (theme name, no specific set after it) should NOT appear as a lone entry
    expect(names.every(n => n !== 'Ideas')).toBe(true);
  });

  it('surfaces fabricated names matching the pilot 76476d96 pattern', () => {
    const body = [
      'The new LEGO Panchatantra Ideas set looks amazing.',
      'LEGO Mumbai Skyline Architecture is rumored for 2027.',
      'LEGO Pokemon Jirachi is the highlight of the leak.',
    ].join('\n');
    const names = extractSetNameCandidates(body);
    // Extraction surfaces all three — gate (DB lookup) would reject them
    expect(names.some(n => n.includes('Panchatantra'))).toBe(true);
    expect(names.some(n => n.includes('Mumbai'))).toBe(true);
    expect(names.some(n => n.includes('Jirachi'))).toBe(true);
  });

  it('does not extract generic phrases or openers as set names', () => {
    const body = [
      'LEGO has announced a new wave.',
      'LEGO fans are excited.',
      'The set comes from LEGO.',
    ].join('\n');
    const names = extractSetNameCandidates(body);
    // Single generic words or fragments should not produce falsifiable candidates
    expect(names.every(n => n.length > 4)).toBe(true);
  });
});

// ── isCerebrasEligible — source quality gating ───────────────────────────────

describe('isCerebrasEligible', () => {
  it('returns true when source_excerpt is exactly 200 chars', () => {
    expect(isCerebrasEligible({ source_excerpt: 'x'.repeat(200) })).toBe(true);
  });

  it('returns true when source_excerpt is longer than 200 chars', () => {
    expect(isCerebrasEligible({ source_excerpt: 'x'.repeat(500) })).toBe(true);
  });

  it('returns false when source_excerpt is 199 chars (boundary)', () => {
    expect(isCerebrasEligible({ source_excerpt: 'x'.repeat(199) })).toBe(false);
  });

  it('returns false when source_excerpt is short', () => {
    expect(isCerebrasEligible({ source_excerpt: 'Short excerpt.' })).toBe(false);
  });

  it('returns false when source_excerpt is null (YouTube / no excerpt)', () => {
    expect(isCerebrasEligible({ source_excerpt: null })).toBe(false);
  });

  it('returns false when source_excerpt is undefined', () => {
    expect(isCerebrasEligible({})).toBe(false);
  });

  // ── fullBody fallback (bug fix 2026-06-28, HIGH-52) ──────────────────────────
  // The prompt builder (draft-prompt.ts) prefers fullBody over source_excerpt:
  // `content = fullBody || sourceExcerpt || sourceTitle`. Eligibility must check
  // the same content the model actually receives, not source_excerpt alone —
  // otherwise rows with no stored excerpt but a successful live fetch were
  // wrongly blocked from Cerebras failover.

  it('returns true when source_excerpt is null but fullBody is long enough', () => {
    expect(isCerebrasEligible({ source_excerpt: null, fullBody: 'x'.repeat(300) })).toBe(true);
  });

  it('returns true when source_excerpt is short but fullBody is long enough', () => {
    expect(isCerebrasEligible({ source_excerpt: 'Short.', fullBody: 'x'.repeat(300) })).toBe(true);
  });

  it('returns false when both source_excerpt and fullBody are null/absent', () => {
    expect(isCerebrasEligible({ source_excerpt: null, fullBody: null })).toBe(false);
  });

  it('returns false when fullBody is empty string (failed fetch) and excerpt is short', () => {
    expect(isCerebrasEligible({ source_excerpt: 'Short.', fullBody: '' })).toBe(false);
  });

  it('is eligible via source_excerpt even when fullBody is short/failed', () => {
    // fullBody alone is too short, but source_excerpt alone clears the bar —
    // eligibility checks both signals independently, so a thin/failed fullBody
    // fetch must not shadow a perfectly good stored excerpt.
    expect(isCerebrasEligible({ source_excerpt: 'x'.repeat(500), fullBody: 'short' })).toBe(true);
  });
});

// ── Prompt hardening — Phase 7a (comparison discipline) ──────────────────────

describe('prompt hardening — Phase 7a comparison discipline', () => {
  it('VOICE_EXAMPLES contains one-comparison-inside-marker rule', () => {
    expect(VOICE_EXAMPLES).toContain('EXACTLY ONCE');
    expect(VOICE_EXAMPLES).toContain('One comparison. Inside. Nowhere else.');
  });

  it('VOICE_EXAMPLES contains closing marker instruction', () => {
    expect(VOICE_EXAMPLES).toContain('<!-- /INDIA_PARAGRAPH -->');
  });

  it('OUTPUT_FORMAT body hint mentions closing marker', () => {
    expect(OUTPUT_FORMAT).toContain('<!-- /INDIA_PARAGRAPH -->');
  });
});

// ── Source fidelity gate — LOW confidence sources (unit tests, no DB needed) ──

const INDIA_BLOCK = `<!-- INDIA_PARAGRAPH -->
At ₹6,499 (estimated), that's four months of Spotify Premium.
Toycra and MyBrickHouse will stock it 4–6 weeks after global launch.
<!-- /INDIA_PARAGRAPH -->`;

describe('source fidelity — LOW confidence sources', () => {
  it('fails when body claims set number not in source (YT low-confidence)', async () => {
    const body = `LEGO 99999 was shown in this video.
${INDIA_BLOCK}`;
    const result = await lintDraft({
      format:     'news',
      body,
      word_count: 350,
      source: {
        source_url:     'https://youtube.com/watch?v=abc',
        source_title:   'New LEGO leaks for next month',
        source_excerpt: null,
      },
    }, { skipHeroImage: true, skipFactuality: false });
    expect(result.gates.sourceFidelity?.pass).toBe(false);
    expect(result.gates.sourceFidelity?.severity).toBe('fail');
    expect(result.overallPass).toBe(false);
  });

  it('passes when set number is grounded in source title (YT low-confidence)', async () => {
    const body = `LEGO 21066 from this video.
${INDIA_BLOCK}`;
    const result = await lintDraft({
      format:     'news',
      body,
      word_count: 350,
      source: {
        source_url:     'https://youtube.com/watch?v=abc',
        source_title:   'LEGO 21066 revealed today',
        source_excerpt: null,
      },
    }, { skipHeroImage: true, skipFactuality: false });
    expect(result.gates.sourceFidelity?.pass).toBe(true);
  });

  it('short-circuits to ok for HIGH confidence source (excerpt >= 200 chars)', async () => {
    const body = `LEGO 99999 claimed here.
${INDIA_BLOCK}`;
    const result = await lintDraft({
      format:     'news',
      body,
      word_count: 350,
      source: {
        source_url:     'https://brickset.com/article/12345',
        source_title:   'Title',
        source_excerpt: 'A'.repeat(500),
      },
    }, { skipHeroImage: true, skipFactuality: false });
    // High confidence — gate short-circuits without checking the body
    expect(result.gates.sourceFidelity?.pass).toBe(true);
    expect(result.gates.sourceFidelity?.severity).toBe('ok');
  });

  it('is null when source context is not provided', async () => {
    const result = await lintDraft({
      format:     'news',
      body:       `Some content. ${INDIA_BLOCK}`,
      word_count: 350,
    }, { skipHeroImage: true, skipFactuality: false });
    expect(result.gates.sourceFidelity).toBeNull();
  });

  it('is null when skipFactuality is true', async () => {
    const result = await lintDraft({
      format:     'news',
      body:       `Some content. ${INDIA_BLOCK}`,
      word_count: 350,
      source:     { source_url: 'https://youtube.com/watch?v=abc', source_title: 'Title', source_excerpt: null },
    }, { skipHeroImage: true, skipFactuality: true });
    expect(result.gates.sourceFidelity).toBeNull();
  });
});

// ── AND-match — Phase 7b (fabricated combo, pure regex) ──────────────────────

describe('factuality AND-match — set name extraction (pure regex)', () => {
  it('extractSetNameCandidates surfaces "Mumbai Skyline Architecture" as a candidate', () => {
    const body = 'LEGO Mumbai Skyline Architecture is rumored for next year.';
    const names = extractSetNameCandidates(body);
    // Extraction must surface it — DB AND-match would then reject it
    expect(names.some(n => n.includes('Mumbai'))).toBe(true);
  });

  it('extractSetNameCandidates surfaces "Delhi Heritage Architecture"', () => {
    const body = 'LEGO Delhi Heritage Architecture was shown at a fan event.';
    const names = extractSetNameCandidates(body);
    expect(names.some(n => n.includes('Delhi'))).toBe(true);
  });

  it('extractSetNameCandidates surfaces "Panchatantra Ideas"', () => {
    const body = 'The new LEGO Panchatantra Ideas set is incredible.';
    const names = extractSetNameCandidates(body);
    expect(names.some(n => n.includes('Panchatantra'))).toBe(true);
  });

  it('extractSetNameCandidates surfaces "Hogsmeade Village" (real LEGO set)', () => {
    const body = 'LEGO Hogsmeade Village is available now.';
    const names = extractSetNameCandidates(body);
    expect(names.some(n => n.includes('Hogsmeade'))).toBe(true);
  });
});

// ── passesAutoPublishGates — factuality wiring fix (2026-06-28, HIGH-52) ──────
//
// Bug: factuality (Gate 5) and source fidelity (Gate 6) were computed via
// lintDraft() and stored in outcome.lintResult, but never checked at the
// auto-publish decision point — only format checks (word count, India
// paragraph, verdict) and Gate 7 (voice/tone) could block auto-publish.
// A factually wrong article could auto-publish if it had the right word
// count and a price. Fixed to require outcome.lintResult.overallPass,
// fail-closed (null lintResult = lint runner threw, not "no issues found").
//
// Logic lives in src/lib/auto-publish-gate.ts (extracted from
// scripts/generate-approved-drafts.ts) so it can be statically imported here
// without pulling in that script's module-scope process.exit(1) env guard
// or its Supabase/Gemini/Cerebras client setup.
describe('passesAutoPublishGates', () => {
  const baseOutcome = (): GenerationOutcome => ({
    title: 'Test title',
    body: 'Some intro text.\n\n<!-- INDIA_PARAGRAPH -->\nAvailable at Toycra for ₹4,999.\n<!-- /INDIA_PARAGRAPH -->',
    verdict: 'BUY NOW',
    format: 'news',
    wordCount: 400,
    provider: 'gemini',
    requiresManualApproval: false,
    failoverUsed: false,
    lintResult: {
      overallPass: true,
      warnings: [],
      gates: { wordCount: { pass: true, severity: 'ok' }, indiaParagraph: { pass: true, severity: 'ok' }, verdict: null, factuality: { pass: true, severity: 'ok' }, sourceFidelity: { pass: true, severity: 'ok' } },
    },
    hardRules: [],
    hardFail: false,
  });

  it('passes when all format checks and lintResult.overallPass are true', () => {
    expect(passesAutoPublishGates(baseOutcome())).toBe(true);
  });

  it('fails when lintResult.overallPass is false (e.g. factuality gate failed) even if format checks pass', () => {
    const outcome = baseOutcome();
    outcome.lintResult!.overallPass = false;
    outcome.lintResult!.gates.factuality = { pass: false, severity: 'fail', reason: 'unrecognized set number' };
    expect(passesAutoPublishGates(outcome)).toBe(false);
  });

  it('fails closed when lintResult is null (lint runner threw, not "no issues found")', () => {
    const outcome = baseOutcome();
    outcome.lintResult = null;
    expect(passesAutoPublishGates(outcome)).toBe(false);
  });

  // Rewritten 2026-06-28 (full merge): word count is no longer checked
  // independently here — it's deferred entirely to lintResult.overallPass
  // (computed by lintDraft() using the correct per-format WORD_COUNT_TARGETS
  // range). Setting outcome.wordCount alone, without the mock lintResult
  // reflecting that failure, now correctly has NO effect — this test was
  // previously passing for the wrong reason (the old hardcoded news-shaped
  // 300-500 check), which the merge intentionally removed so other formats
  // aren't held to news's literal numeric thresholds.
  it('word count alone (without a failing lintResult) no longer blocks auto-publish — deferred to lintDraft', () => {
    const outcome = baseOutcome();
    outcome.wordCount = 100; // would have failed the old hardcoded 300-500 news check
    // lintResult.overallPass is still true in this fixture — in real usage,
    // lintDraft() would have already set overallPass=false for a genuinely
    // out-of-range word count. This test documents that passesAutoPublishGates
    // trusts lintResult rather than re-deriving word count validity itself.
    expect(passesAutoPublishGates(outcome)).toBe(true);
  });

  it('fails when lintResult correctly reflects a word-count gate failure', () => {
    const outcome = baseOutcome();
    outcome.lintResult!.overallPass = false;
    outcome.lintResult!.gates.wordCount = { pass: false, severity: 'fail', reason: '100 words — hard limit 225-500 for news' };
    expect(passesAutoPublishGates(outcome)).toBe(false);
  });

  // New 2026-06-28 (Abhinav policy decision): review/opinion/guide can now
  // reach and pass this function — previously the call site in
  // generate-approved-drafts.ts restricted format === 'news' before this
  // function was ever called (MEDIUM-13). This function itself was always
  // format-agnostic in principle; these tests confirm it actually behaves
  // that way for the formats that newly rely on it.
  it('passes for a review-format draft with overallPass=true and a valid verdict', () => {
    const outcome = baseOutcome();
    outcome.format = 'review';
    outcome.verdict = 'BUY NOW';
    expect(passesAutoPublishGates(outcome)).toBe(true);
  });

  it('passes for an opinion-format draft with overallPass=true and a null (community) verdict', () => {
    const outcome = baseOutcome();
    outcome.format = 'opinion';
    outcome.verdict = null;
    expect(passesAutoPublishGates(outcome)).toBe(true);
  });

  it('passes for a guide-format draft with overallPass=true and an invalid-looking verdict string — verdict gate is non-news\u2019s lintDraft responsibility, not this function\u2019s', () => {
    // lintDraft() gates verdict for non-news formats (verdictGate, format !== 'news').
    // This function's own verdict check only applies to format === 'news' —
    // for other formats, an invalid verdict would already have been caught
    // by lintResult.overallPass=false in real usage. This fixture keeps
    // overallPass=true to isolate and confirm this function's own news-only
    // verdict-check scope, not to claim a real guide draft could have a
    // garbage verdict and still pass end-to-end.
    const outcome = baseOutcome();
    outcome.format = 'guide';
    outcome.verdict = 'NOT_A_REAL_VERDICT';
    expect(passesAutoPublishGates(outcome)).toBe(true);
  });

  it('fails for a news-format draft with an invalid (non-null, non-valid-enum) verdict, even if lintResult.overallPass is true', () => {
    // This is the one gate this function still checks directly: lintDraft()
    // deliberately skips verdict validation when format === 'news'
    // (verdictGate stays null), so this function must catch it. This is also
    // the exact edge case that motivated isGenuineFail in
    // generate-approved-drafts.ts being the precise logical negation of this
    // function's result, rather than a hand-maintained approximation.
    const outcome = baseOutcome();
    outcome.format = 'news';
    outcome.verdict = 'MAYBE BUY IT IDK';
    expect(passesAutoPublishGates(outcome)).toBe(false);
  });

  it('passes for a news-format draft with a null (community/MOC) verdict', () => {
    const outcome = baseOutcome();
    outcome.format = 'news';
    outcome.verdict = null;
    expect(passesAutoPublishGates(outcome)).toBe(true);
  });
});

// ── BothProvidersFailedError (2026-06-28, Abhinav policy) ─────────────────────
// "What fails through Gemini and Cerebras both should be put in a rejected
// category and [deleted]." Distinguishes the genuinely-both-attempted-both-
// failed case from (a) DEFERRED — Cerebras never attempted, Gemini retryable —
// and (b) a plain Gemini non-retryable Error where Cerebras is never tried at
// all. Both (a) and (b) keep retrying automatically; only this case deletes.
// Checked via `instanceof` in generate-approved-drafts.ts's catch block, not
// string-matching error.message — the same robustness reason this is a
// dedicated class rather than a tagged plain Error.
describe('BothProvidersFailedError', () => {
  it('is an instance of Error and carries both provider messages', () => {
    const err = new BothProvidersFailedError('Gemini 503', 'Cerebras timeout');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(BothProvidersFailedError);
    expect(err.geminiMessage).toBe('Gemini 503');
    expect(err.cerebrasMessage).toBe('Cerebras timeout');
    expect(err.name).toBe('BothProvidersFailedError');
  });

  it('builds a combined message including both provider failures', () => {
    const err = new BothProvidersFailedError('Gemini 503', 'Cerebras timeout');
    expect(err.message).toContain('Gemini 503');
    expect(err.message).toContain('Cerebras timeout');
  });

  it('is distinguishable from a plain Error via instanceof (the actual catch-branch check)', () => {
    const plainErr = new Error('Gemini failed (retryable) and Cerebras not eligible (fullBody and excerpt both < 200 chars): some gemini error');
    const bothErr  = new BothProvidersFailedError('gemini msg', 'cerebras msg');
    expect(plainErr instanceof BothProvidersFailedError).toBe(false);
    expect(bothErr instanceof BothProvidersFailedError).toBe(true);
  });
});

// ── genuinelyAvailableAtToycra (HIGH-49, 2026-06-30) ──────────────────────────
// Abhinav: "my code abhinav12 should only be mentioned if and when the set
// is available on toycra. if it is not available only there is absolutely
// no point in mentioning that. also, sets which will be import also do not
// need that message either." These 8 test cases are drawn directly from the
// 8 real articles that originally triggered HIGH-49 -- manually classified
// against Abhinav's rule before writing this function, then verified the
// function reproduces that classification exactly (8/8) before shipping.
describe('genuinelyAvailableAtToycra', () => {
  it('returns false for "will be the primary sources to watch for availability" (not yet stocked)', () => {
    expect(genuinelyAvailableAtToycra('No specific Indian pricing has been confirmed yet. MyBrickHouse and Toycra will be the primary sources to watch for availability.')).toBe(false);
  });

  it('returns true for the real bossks-houndstooth text, including a later unrelated stock caveat ("might be out of stock") that must NOT be mistaken for an availability hedge', () => {
    // This exact text caught a real bug in an earlier draft of this function:
    // a whole-sentence hedge check incorrectly flagged this because "might be"
    // appears later in the sentence as a STOCK-level caveat, not a price/
    // availability hedge. Scoping the hedge check to the toycra+price match
    // window itself (not the full sentence) fixed it -- this test guards
    // against that regression.
    expect(genuinelyAvailableAtToycra('MyBrickHouse has it for ₹51,999, Toycra is selling it at ₹41,599 lists it at ₹50,999, though it might be out of stock.')).toBe(true);
  });

  it('returns false for "usually list new sets within 4-6 weeks" (generic future-tense)', () => {
    expect(genuinelyAvailableAtToycra('Keep an eye on retailers like Toycra, MyBrickHouse, and Jaiman, as they usually list new sets within 4-6 weeks of the international launch.')).toBe(false);
  });

  it('returns false for "do not carry custom creations of this scale" (never available)', () => {
    expect(genuinelyAvailableAtToycra('MyBrickHouse and Toycra do not carry custom creations of this scale.')).toBe(false);
  });

  it('returns true for "You\'ll find it at MyBrickHouse for ₹63,999 and at Toycra for ₹61,000" (real prices, both stores)', () => {
    expect(genuinelyAvailableAtToycra('Here in India, the LEGO Titanic is a serious commitment. You\'ll find it at MyBrickHouse for ₹63,999 and at Toycra for ₹61,000.')).toBe(true);
  });

  it('returns false for "potentially available at Toycra... or it might be an import-only affair" (hedged/possibly import)', () => {
    expect(genuinelyAvailableAtToycra('It will likely land in India with a 4-6 week lag, potentially available at Toycra or MyBrickHouse, or it might be an import-only affair given the creative liberties taken.')).toBe(false);
  });

  it('returns false for "expect them to appear... shortly after" (not yet launched)', () => {
    expect(genuinelyAvailableAtToycra('While they officially launch on August 1st, expect them to appear at major retailers like Toycra and MyBrickHouse shortly after.')).toBe(false);
  });

  it('returns false for "expect local retailers... to stock it eventually" (future tense)', () => {
    expect(genuinelyAvailableAtToycra('While officially available at LEGO.com, expect local retailers like Toycra and MyBrickHouse to stock it eventually.')).toBe(false);
  });

  it('returns false when there is no ₹ price near the Toycra mention at all', () => {
    expect(genuinelyAvailableAtToycra('Toycra is a popular retailer for LEGO sets in India.')).toBe(false);
  });

  it('returns false for empty/null/undefined content (fail closed)', () => {
    expect(genuinelyAvailableAtToycra('')).toBe(false);
    expect(genuinelyAvailableAtToycra(null)).toBe(false);
    expect(genuinelyAvailableAtToycra(undefined)).toBe(false);
  });
});
