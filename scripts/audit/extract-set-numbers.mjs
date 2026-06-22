// scripts/audit/extract-set-numbers.mjs
//
// HIGH-35 Phase 1 — extract candidate set numbers from 76 unaudited
// published articles. Read-only. Writes JSON output to audit/HIGH-35/.
//
// Population: pending_drafts WHERE status='published'
//             AND lint_result IS NULL AND lint_results IS NULL
//             (verified 76 rows, 2026-06-22)
//
// No DB writes. No retraction decisions. Phase 2 handles verification
// against the sets table; phase 3 handles retraction decisions.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'node:fs/promises';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('FATAL: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in env');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Match resolveTarget() in both publishers — see MEDIUM-38 for the URL-path
// divergence between cron and admin (table mapping is consistent, paths aren't).
const FORMAT_TO_TABLE = {
  news: 'news_articles',
  review: 'news_articles',  // see MEDIUM-13: review-format publishes to news_articles
  opinion: 'blog_posts',
  guide: 'guides',          // not in current population; reserved
};

// Stripped from body BEFORE set-number extraction so prices don't masquerade
// as set numbers. Order matters: more specific patterns first.
const PRICE_PATTERNS = [
  /₹\s*[\d,]+(\.\d+)?/g,
  /\$\s*[\d,]+(\.\d+)?/g,
  /\bRs\.?\s*[\d,]+(\.\d+)?/g,
  /\b(INR|USD|EUR|GBP)\s*[\d,]+(\.\d+)?/g,
];

// LEGO set numbers in BOI's coverage range: 4-6 digits. 3-digit vintage sets
// are out of scope. Phase 2's DB lookup is the authoritative disambiguator —
// phase 1 surfaces candidates, doesn't decide.
const SET_NUMBER_PATTERN = /\b(\d{4,6})\b/g;

const YEAR_CONTEXT = /\b(in|since|released?|from|year|©|copyright|q[1-4])\b/i;
const SET_CONTEXT = /(set|kit|model|item|product)\s*(no\.?|#|number)?\s*$/i;
const PIECE_CONTEXT = /^\s*(pieces?|bricks?|elements?|parts?|minifigs?)/i;

const CONFIDENCE_RANK = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function contextWindow(text, idx, matchLen) {
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + matchLen + 30);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function classifyMatch(text, num, idx, source) {
  const before = text.slice(Math.max(0, idx - 30), idx);
  const after = text.slice(idx + num.length, idx + num.length + 30);
  const n = Number(num);

  const year_flag = n >= 1900 && n <= 2030 && YEAR_CONTEXT.test(before + ' ' + after);
  const set_flag = SET_CONTEXT.test(before);
  const piece_count_flag = PIECE_CONTEXT.test(after);

  let confidence;
  if (source === 'title') confidence = 'HIGH';
  else if (source === 'hero_image') confidence = 'MEDIUM';
  else {
    confidence = 'LOW';
    if (set_flag) confidence = 'MEDIUM';
  }

  return {
    set_number: num,
    source,
    confidence,
    context: contextWindow(text, idx, num.length),
    flags: { year_flag, set_flag, piece_count_flag },
  };
}

// hero_image extraction uses known structural URL conventions, not a blanket
// digit regex — Rebrickable's /sets/{n}-{v}/ paths contain both the real set
// number AND an internal asset ID, and the asset ID is what the generic regex
// was picking up. See HIGH-35 phase 1 run, 2026-06-22.
function extractFromHeroImage(url) {
  if (!url || typeof url !== 'string') return [];
  const out = [];

  // Rebrickable: rebrickable.com/media/sets/{set_number}-{version}/asset.jpg
  const rebrickable = url.match(/\/sets\/(\d{4,7})-\d+\//);
  if (rebrickable) {
    out.push({
      set_number: rebrickable[1],
      source: 'hero_image',
      confidence: 'HIGH',
      context: url,
      flags: { year_flag: false, set_flag: true, piece_count_flag: false },
    });
    return out;
  }

  // LEGO.com: filename pattern {set_number}.jpg or {set_number}_alt1.jpg
  const legocom = url.match(/\/(\d{4,6})(?:_[a-z0-9]+)?\.(?:jpe?g|png|webp)(?:$|\?)/i);
  if (legocom) {
    out.push({
      set_number: legocom[1],
      source: 'hero_image',
      confidence: 'HIGH',
      context: url,
      flags: { year_flag: false, set_flag: true, piece_count_flag: false },
    });
    return out;
  }

  // Unknown CDN format — skip rather than risk false positives.
  // Phase 1 logs this so we can extend the recognized patterns if it shows up often.
  return [];
}

function extractFromField(text, source) {
  if (!text || typeof text !== 'string') return [];
  let working = text;
  if (source === 'body') {
    for (const p of PRICE_PATTERNS) working = working.replace(p, ' ');
  }
  // Fresh regex per call to avoid stateful lastIndex across invocations.
  const re = new RegExp(SET_NUMBER_PATTERN.source, 'g');
  const out = [];
  for (const m of working.matchAll(re)) {
    out.push(classifyMatch(working, m[1], m.index, source));
  }
  return out;
}

function dedupeCandidates(candidates) {
  const byNum = new Map();
  for (const c of candidates) {
    const existing = byNum.get(c.set_number);
    if (!existing) {
      byNum.set(c.set_number, { ...c, occurrence_count: 1 });
    } else {
      existing.occurrence_count += 1;
      if (CONFIDENCE_RANK[c.confidence] > CONFIDENCE_RANK[existing.confidence]) {
        existing.confidence = c.confidence;
        existing.source = c.source;
        existing.context = c.context;
        existing.flags = c.flags;
      }
    }
  }
  return [...byNum.values()];
}

async function fetchUnauditedDrafts() {
  const { data, error } = await db
    .from('pending_drafts')
    .select('id, published_url, draft_format, created_at, updated_at, source_title, draft_verdict')
    .eq('status', 'published')
    .is('lint_result', null)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`pending_drafts query failed: ${error.message}`);
  return data;
}

async function lookupArticle(table, slug) {
  const { data, error } = await db
    .from(table)
    .select('id, title, content, hero_image')
    .eq('slug', slug)
    .limit(1);
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'no row matching slug' };
  return { article: data[0] };
}

async function processDraft(draft) {
  const base = {
    draft_id: draft.id,
    format: draft.draft_format,
    published_url: draft.published_url,
    source_title: draft.source_title,
    drafted_at: draft.created_at,
    published_at: draft.updated_at,
    is_community: draft.draft_verdict === null,  // matches publish-drafts.mjs::isCommunity
  };

  const table = FORMAT_TO_TABLE[draft.draft_format];
  if (!table) {
    return { ...base, linkage: 'unknown_format', candidates: [], warnings: [`unknown draft_format: ${draft.draft_format}`] };
  }
  if (!draft.published_url || typeof draft.published_url !== 'string') {
    return { ...base, linkage: 'no_url', candidates: [], warnings: ['published_url missing or non-string'] };
  }
  const slug = draft.published_url.split('/').pop();
  if (!slug) {
    return { ...base, linkage: 'no_slug', candidates: [], warnings: ['could not derive slug from published_url'] };
  }

  const lookup = await lookupArticle(table, slug);
  if (lookup.error) {
    return { ...base, target_table: table, slug, linkage: 'miss', candidates: [], warnings: [`lookup failed: ${lookup.error}`] };
  }
  const { article } = lookup;

  const titleCandidates = extractFromField(article.title || '', 'title');
  const heroCandidates = extractFromHeroImage(article.hero_image || '');
  const bodyCandidates = extractFromField(article.content || '', 'body');

  const candidates = dedupeCandidates([
    ...titleCandidates,
    ...heroCandidates,
    ...bodyCandidates,
  ]).sort((a, b) => CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence]);

  const warnings = [];
  if (candidates.length === 0) warnings.push('zero candidates extracted — likely opinion/roundup with no set reference');
  if (candidates.length > 10) warnings.push(`${candidates.length} candidates — likely a roundup/list, manual review recommended`);

  return {
    ...base,
    target_table: table,
    article_id: article.id,
    slug,
    title: article.title,
    linkage: 'ok',
    candidates,
    warnings,
  };
}

function buildSummary(results) {
  const byFormat = {};
  const byCandidateCount = { '0': 0, '1': 0, '2-5': 0, '6-10': 0, '11+': 0 };
  const linkageStatus = {};
  const candidateFreq = new Map();
  const byCommunity = { community: 0, non_community: 0 };
  const zeroCandidateByCommunity = { community: 0, non_community: 0 };

  for (const r of results) {
    byFormat[r.format] = (byFormat[r.format] || 0) + 1;
    linkageStatus[r.linkage] = (linkageStatus[r.linkage] || 0) + 1;
    const n = r.candidates.length;
    if (n === 0) byCandidateCount['0']++;
    else if (n === 1) byCandidateCount['1']++;
    else if (n <= 5) byCandidateCount['2-5']++;
    else if (n <= 10) byCandidateCount['6-10']++;
    else byCandidateCount['11+']++;
    for (const c of r.candidates) {
      candidateFreq.set(c.set_number, (candidateFreq.get(c.set_number) || 0) + 1);
    }
    if (r.is_community) byCommunity.community += 1;
    else byCommunity.non_community += 1;
    if (n === 0) {
      if (r.is_community) zeroCandidateByCommunity.community += 1;
      else zeroCandidateByCommunity.non_community += 1;
    }
  }

  const topCandidates = [...candidateFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([set_number, occurrences]) => ({ set_number, occurrences }));

  return {
    generated_at: new Date().toISOString(),
    population_total: results.length,
    by_format: byFormat,
    by_linkage_status: linkageStatus,
    by_candidate_count: byCandidateCount,
    by_community: byCommunity,
    zero_candidates_by_community: zeroCandidateByCommunity,
    top_20_candidate_set_numbers: topCandidates,
  };
}

async function main() {
  console.log('HIGH-35 Phase 1 — set number extraction');
  console.log('Loading unaudited published drafts...');
  const drafts = await fetchUnauditedDrafts();
  console.log(`Population: ${drafts.length} rows`);

  if (drafts.length !== 76) {
    console.warn(`WARNING: expected 76 rows per audit baseline; got ${drafts.length}. ` +
      'Population may have shifted since tracker baseline 2026-06-22 — investigate before trusting downstream phases.');
  }

  const results = [];
  for (const draft of drafts) {
    process.stdout.write('.');
    results.push(await processDraft(draft));
  }
  console.log('');

  const summary = buildSummary(results);

  const date = new Date().toISOString().slice(0, 10);
  const outDir = 'audit/HIGH-35';
  await mkdir(outDir, { recursive: true });
  const outPath = `${outDir}/phase1-extraction-${date}.json`;
  await writeFile(outPath, JSON.stringify({ summary, results }, null, 2));

  console.log('\n=== PHASE 1 SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nFull output: ${outPath}`);
  console.log(`Articles with zero candidates: ${summary.by_candidate_count['0']} (review manually for hidden set refs)`);
  console.log(`Articles with linkage misses: ${summary.by_linkage_status['miss'] || 0} (slug→table lookup failed)`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
