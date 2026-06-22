// scripts/audit/verify-factuality.ts
//
// HIGH-35 Phase 2 — run production gateFactuality against the published
// content of all 76 unaudited articles surfaced by Phase 1.
//
// Inputs:
//   - audit/HIGH-35/phase1-extraction-2026-06-22.json
//   - live news_articles + blog_posts (re-fetched per article by slug)
//   - live sets table (queried internally by gateFactuality)
//
// Output:
//   - audit/HIGH-35/phase2-verification-{YYYY-MM-DD}.json
//
// Three buckets per article:
//   PASS                                  — gateFactuality clean (and, for community
//                                            content, no concrete verdict)
//   FAIL_FACTUALITY                       — gateFactuality returns severity='fail'
//   FAIL_VERDICT_ON_NON_CANONICAL         — community-shaped content (is_community=true
//                                            from Phase 1) that nonetheless carries a
//                                            concrete BUY/WAIT/AVOID/SKIP verdict
//
// An article can land in BOTH fail buckets simultaneously; we record all
// triggered fails per article.
//
// Read-only. No DB writes. Phase 3 handles retraction/correction decisions.

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gateFactuality } from '../../src/lib/lint';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('FATAL: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in env');
  process.exit(1);
}
const sb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// Concrete buy/sell verdicts that should not appear on community/non-canonical content.
// Matches VALID_VERDICTS from src/lib/lint.ts at the time Phase 2 was written.
// If lint.ts diverges, this check stays correct for the audit but should be
// kept in sync deliberately.
const CONCRETE_VERDICTS = new Set([
  'BUY', 'BUY NOW',
  'WAIT', 'WAIT FOR SALE',
  'IMPORT ONLY',
  'AVOID', 'SKIP',
]);

type Phase1Result = {
  draft_id: string;
  format: string;
  published_url: string;
  source_title?: string;
  drafted_at: string;
  published_at: string;
  is_community: boolean;
  linkage: string;
  target_table?: string;
  slug?: string;
  article_id?: string;
  title?: string;
  candidates?: Array<{
    set_number: string;
    source: string;
    confidence: string;
    context: string;
    flags: { year_flag: boolean; set_flag: boolean; piece_count_flag: boolean };
    occurrence_count?: number;
  }>;
  warnings?: string[];
};

type Phase1File = {
  summary: Record<string, unknown>;
  results: Phase1Result[];
};

type FactualityVerdict = {
  pass: boolean;
  severity: 'ok' | 'warn' | 'fail';
  reason?: string;
};

type Phase2Result = {
  draft_id: string;
  article_id?: string;
  slug?: string;
  title?: string;
  format: string;
  published_url: string;
  is_community: boolean;
  draft_verdict_raw: string | null;
  bucket: 'PASS' | 'FAIL_FACTUALITY' | 'FAIL_VERDICT_ON_NON_CANONICAL' | 'SKIP';
  fail_reasons: string[];
  factuality: FactualityVerdict | null;
  factuality_warnings: string[];
  verdict_on_non_canonical_check: {
    triggered: boolean;
    raw_verdict: string | null;
  };
  phase1_candidates_count: number;
  notes: string[];
};

async function loadPhase1(): Promise<Phase1File> {
  // Default to today's file; override via PHASE1_PATH if running against an older snapshot
  const path = process.env.PHASE1_PATH || 'audit/HIGH-35/phase1-extraction-2026-06-22.json';
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as Phase1File;
}

async function fetchArticleContent(
  table: string,
  slug: string,
): Promise<{ content: string } | { error: string }> {
  const { data, error } = await sb
    .from(table)
    .select('content')
    .eq('slug', slug)
    .limit(1);
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'no row matching slug' };
  return { content: data[0].content || '' };
}

async function fetchDraftVerdict(draftId: string): Promise<string | null> {
  // Phase 1 used is_community = (draft_verdict IS NULL). We re-fetch the raw
  // value here because the verdict-on-non-canonical check needs the actual
  // verdict string, not just whether it was null.
  const { data, error } = await sb
    .from('pending_drafts')
    .select('draft_verdict')
    .eq('id', draftId)
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0].draft_verdict;
}

async function processArticle(p1: Phase1Result): Promise<Phase2Result> {
  const base = {
    draft_id: p1.draft_id,
    article_id: p1.article_id,
    slug: p1.slug,
    title: p1.title,
    format: p1.format,
    published_url: p1.published_url,
    is_community: p1.is_community,
    phase1_candidates_count: p1.candidates?.length ?? 0,
  };

  // Skip rows that didn't link cleanly in Phase 1 — can't audit what we can't fetch
  if (p1.linkage !== 'ok' || !p1.target_table || !p1.slug) {
    return {
      ...base,
      draft_verdict_raw: null,
      bucket: 'SKIP',
      fail_reasons: [`phase1 linkage=${p1.linkage}`],
      factuality: null,
      factuality_warnings: [],
      verdict_on_non_canonical_check: { triggered: false, raw_verdict: null },
      notes: ['skipped — no linkage to live article'],
    };
  }

  // Re-fetch published content (Phase 1 captured the article ref, not the body)
  const fetched = await fetchArticleContent(p1.target_table, p1.slug);
  if ('error' in fetched) {
    return {
      ...base,
      draft_verdict_raw: null,
      bucket: 'SKIP',
      fail_reasons: [`content fetch failed: ${fetched.error}`],
      factuality: null,
      factuality_warnings: [],
      verdict_on_non_canonical_check: { triggered: false, raw_verdict: null },
      notes: ['skipped — content fetch failed'],
    };
  }

  // Run production gateFactuality against the article body
  const factualityWarnings: string[] = [];
  let factuality: FactualityVerdict;
  try {
    factuality = await gateFactuality(fetched.content, sb, factualityWarnings);
  } catch (e) {
    return {
      ...base,
      draft_verdict_raw: null,
      bucket: 'SKIP',
      fail_reasons: [`gateFactuality threw: ${(e as Error).message}`],
      factuality: null,
      factuality_warnings: factualityWarnings,
      verdict_on_non_canonical_check: { triggered: false, raw_verdict: null },
      notes: ['skipped — gate threw exception'],
    };
  }

  // Verdict-on-non-canonical check (only meaningful for community-shaped content)
  const rawVerdict = await fetchDraftVerdict(p1.draft_id);
  const verdictCheck: { triggered: boolean; raw_verdict: string | null } = {
    triggered: false,
    raw_verdict: rawVerdict,
  };
  // The BrickHeadz case taught us: Phase 1's is_community can disagree with
  // article-content evidence. We treat "concrete verdict + Phase 1 community
  // signal absent" as a separate concern, NOT as the trigger here. The
  // verdict-on-non-canonical trigger fires when the *article itself* reads
  // as community/MOC content (which we cannot detect cleanly here without
  // re-doing Phase 1's signal work). For audit-fidelity, we use the simpler
  // operational definition: trigger if Phase 1 flagged is_community AND the
  // current draft_verdict is concrete.
  const verdictTriggered =
    p1.is_community === true &&
    rawVerdict !== null &&
    CONCRETE_VERDICTS.has(rawVerdict.toUpperCase());
  verdictCheck.triggered = verdictTriggered;

  // Bucket assignment — can be both
  const failReasons: string[] = [];
  if (factuality.severity === 'fail') {
    failReasons.push(factuality.reason || 'factuality: unknown failure');
  }
  if (verdictTriggered) {
    failReasons.push(
      `verdict-on-non-canonical: is_community=true but draft_verdict="${rawVerdict}"`,
    );
  }

  let bucket: Phase2Result['bucket'] = 'PASS';
  if (factuality.severity === 'fail' && verdictTriggered) {
    // Record both fail reasons; bucket reports the primary (factuality first)
    bucket = 'FAIL_FACTUALITY';
  } else if (factuality.severity === 'fail') {
    bucket = 'FAIL_FACTUALITY';
  } else if (verdictTriggered) {
    bucket = 'FAIL_VERDICT_ON_NON_CANONICAL';
  }

  const notes: string[] = [];
  if (factuality.severity === 'warn') {
    notes.push(`factuality warned but did not fail: ${factuality.reason || '(no reason)'}`);
  }
  if (p1.candidates && p1.candidates.length > 0 && factuality.severity === 'ok') {
    // Phase 1 found candidates, Phase 2 says all clear — diagnostic signal about
    // the gap between Phase 1's loose extraction and production's tight extraction
    notes.push(
      `phase1 surfaced ${p1.candidates.length} candidates that gateFactuality did not flag — extraction pattern divergence`,
    );
  }

  return {
    ...base,
    draft_verdict_raw: rawVerdict,
    bucket,
    fail_reasons: failReasons,
    factuality,
    factuality_warnings: factualityWarnings,
    verdict_on_non_canonical_check: verdictCheck,
    notes,
  };
}

function buildSummary(results: Phase2Result[]) {
  const byBucket: Record<string, number> = {
    PASS: 0,
    FAIL_FACTUALITY: 0,
    FAIL_VERDICT_ON_NON_CANONICAL: 0,
    SKIP: 0,
  };
  const byFormat: Record<string, Record<string, number>> = {};
  const byCommunity = {
    community: { PASS: 0, FAIL_FACTUALITY: 0, FAIL_VERDICT_ON_NON_CANONICAL: 0, SKIP: 0 },
    non_community: { PASS: 0, FAIL_FACTUALITY: 0, FAIL_VERDICT_ON_NON_CANONICAL: 0, SKIP: 0 },
  };
  let bothFailsTriggered = 0;

  for (const r of results) {
    byBucket[r.bucket] = (byBucket[r.bucket] || 0) + 1;

    if (!byFormat[r.format]) {
      byFormat[r.format] = { PASS: 0, FAIL_FACTUALITY: 0, FAIL_VERDICT_ON_NON_CANONICAL: 0, SKIP: 0 };
    }
    byFormat[r.format][r.bucket] += 1;

    const group = r.is_community ? 'community' : 'non_community';
    byCommunity[group][r.bucket] += 1;

    if (r.fail_reasons.length >= 2) bothFailsTriggered += 1;
  }

  return {
    generated_at: new Date().toISOString(),
    population_total: results.length,
    by_bucket: byBucket,
    by_format: byFormat,
    by_community: byCommunity,
    multi_fail_articles: bothFailsTriggered,
  };
}

async function main(): Promise<void> {
  console.log('HIGH-35 Phase 2 — factuality verification against production gateFactuality');
  const phase1 = await loadPhase1();
  console.log(`Loaded ${phase1.results.length} articles from Phase 1`);

  if (phase1.results.length !== 76) {
    console.warn(
      `WARNING: expected 76 rows from Phase 1; got ${phase1.results.length}. ` +
        'If this is intentional (e.g. running against a non-default Phase 1 snapshot via PHASE1_PATH), proceed with care.',
    );
  }

  const results: Phase2Result[] = [];
  for (const p1 of phase1.results) {
    process.stdout.write('.');
    results.push(await processArticle(p1));
  }
  console.log('');

  const summary = buildSummary(results);

  const date = new Date().toISOString().slice(0, 10);
  const outDir = 'audit/HIGH-35';
  await mkdir(outDir, { recursive: true });
  const outPath = `${outDir}/phase2-verification-${date}.json`;
  await writeFile(outPath, JSON.stringify({ summary, results }, null, 2));

  console.log('\n=== PHASE 2 SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nFull output: ${outPath}`);

  // Surface the actionable lists immediately
  const factFails = results.filter((r) => r.bucket === 'FAIL_FACTUALITY');
  const verdictFails = results.filter((r) => r.bucket === 'FAIL_VERDICT_ON_NON_CANONICAL');
  const skips = results.filter((r) => r.bucket === 'SKIP');

  if (factFails.length) {
    console.log(`\n=== FAIL_FACTUALITY (${factFails.length}) ===`);
    for (const r of factFails) {
      console.log(`  ${r.slug} — ${r.fail_reasons.join('; ')}`);
    }
  }
  if (verdictFails.length) {
    console.log(`\n=== FAIL_VERDICT_ON_NON_CANONICAL (${verdictFails.length}) ===`);
    for (const r of verdictFails) {
      console.log(`  ${r.slug} — verdict="${r.draft_verdict_raw}"`);
    }
  }
  if (skips.length) {
    console.log(`\n=== SKIP (${skips.length}) ===`);
    for (const r of skips) {
      console.log(`  ${r.slug || r.draft_id} — ${r.fail_reasons.join('; ')}`);
    }
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
