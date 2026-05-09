'use strict';
/**
 * RADAR-03 — Signal classifier + pending_drafts writer
 *
 * Reads raw_signals where dedup_status IN ('unique', 'cross_source_primary'),
 * scores and classifies each signal, writes qualifying signals to pending_drafts.
 *
 * Scoring (max 9 pts):
 *   Tier 1 = 5 | Tier 2 = 4 | Tier 3 = 3 | Tier 4 = 2 | Tier 5 = 1
 *   Has body (>20 chars): +2
 *   Published < 7 days ago: +2 | < 30 days: +1
 *
 * Qualify threshold: score >= 4
 *   Tier 1 always qualifies. Tier 2 always qualifies.
 *   Tier 3 qualifies if has body OR published <7d. Tier 4/5 almost never qualify.
 *
 * Format classification (keyword-based, first match wins):
 *   community  → skipped (MOC/discussion/help threads — not draftable)
 *   review     → draft_format: 'review'
 *   opinion    → draft_format: 'opinion'
 *   set-release / default → draft_format: 'news'
 *   Rebrickable API signals (source_type='api') → 'news' unconditionally
 *
 * Idempotent: pending_drafts has UNIQUE INDEX on source_url.
 * Re-running classify-signals never duplicates rows.
 *
 * Usage:
 *   node scripts/radar/classify-signals.js --dry-run
 *   node scripts/radar/classify-signals.js --dry-run --verbose
 *   node scripts/radar/classify-signals.js --limit 20
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// ── CLI flags ─────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const LIMIT   = (() => {
  const i = process.argv.indexOf('--limit');
  return i !== -1 ? parseInt(process.argv[i + 1], 10) : Infinity;
})();

// ── Env ───────────────────────────────────────────────────────────────────────
const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// ── Scoring ───────────────────────────────────────────────────────────────────

const TIER_SCORE = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };
const QUALIFY_THRESHOLD = 4;
const NOW_MS = Date.now();
const DAY_MS = 86_400_000;

function scoreSignal(signal) {
  let pts = TIER_SCORE[signal.source_tier] ?? 1;
  if (signal.body && signal.body.length > 20) pts += 2;
  if (signal.published_at) {
    const ageMs = NOW_MS - new Date(signal.published_at).getTime();
    if (ageMs < 7  * DAY_MS) pts += 2;
    else if (ageMs < 30 * DAY_MS) pts += 1;
  }
  return pts;
}

// ── Classification ────────────────────────────────────────────────────────────

// community signals: MOC posts, weekly threads, help/advice — not draftable
const COMMUNITY_RE  = /\b(moc|ama|weekly|thread|discussion|question|help|advice|tips?|haul|showcase|share)\b/i;
// review signals: hands-on, verdict, rating
const REVIEW_RE     = /\b(review|verdict|worth it|hands.?on|unboxing|rating|tested|first.?impression|in.?depth)\b/i;
// opinion signals: editorials, comparisons, rankings
const OPINION_RE    = /\b(opinion|editorial|why|should you|is it worth|best|worst|top \d|ranked|ranking|vs\.?|versus|compar(ed?|ing)|argument)\b/i;

function classifyFormat(signal) {
  // Rebrickable API = structured set-release data → always news
  if (signal.source_type === 'api') return 'news';

  const t = (signal.title || '').toLowerCase();

  // Community check first — skip these entirely
  if (COMMUNITY_RE.test(t)) return null;

  // Specificity order: review > opinion > news (default)
  if (REVIEW_RE.test(t))  return 'review';
  if (OPINION_RE.test(t)) return 'opinion';
  return 'news';
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function fetchCandidates() {
  const { data, error } = await sb
    .from('raw_signals')
    .select('id, source_name, source_tier, source_type, url, title, body, published_at, fetched_at')
    .in('dedup_status', ['unique', 'cross_source_primary'])
    .order('fetched_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Paginate to bypass PostgREST 1000-row default cap
async function fetchExistingUrls() {
  const seen = new Set();
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb
      .from('pending_drafts')
      .select('source_url')
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    for (const r of data ?? []) seen.add(r.source_url);
    if ((data ?? []).length < PAGE) break;
  }
  return seen;
}

async function writeDrafts(drafts) {
  const BATCH = 100;
  for (let i = 0; i < drafts.length; i += BATCH) {
    const chunk = drafts.slice(i, i + BATCH);
    // ignoreDuplicates: source_url unique index is the idempotency guard
    const { error } = await sb
      .from('pending_drafts')
      .upsert(chunk, { onConflict: 'source_url', ignoreDuplicates: true });
    if (error) throw error;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const t0   = Date.now();
  const mode = DRY_RUN ? ' [DRY-RUN]' : '';
  console.log(`━━ RADAR-03 classifier${mode} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const [candidates, existingUrls] = await Promise.all([
    fetchCandidates(),
    fetchExistingUrls(),
  ]);
  console.log(`Candidates: ${candidates.length} (unique + cross_source_primary)`);
  console.log(`Already in pending_drafts: ${existingUrls.size}`);
  console.log('');

  const limited = LIMIT === Infinity ? candidates : candidates.slice(0, LIMIT);

  let countSkippedExisting = 0;
  let countCommunity       = 0;
  let countBelowThreshold  = 0;
  let countQueued          = 0;
  const byFormat           = { news: 0, review: 0, opinion: 0 };
  const drafts             = [];

  for (const sig of limited) {
    if (existingUrls.has(sig.url)) {
      countSkippedExisting++;
      continue;
    }

    const format = classifyFormat(sig);

    if (format === null) {
      countCommunity++;
      if (VERBOSE) {
        console.log(`  [SKIP:community] T${sig.source_tier} ${sig.source_name} | "${sig.title.slice(0, 70)}"`);
      }
      continue;
    }

    const pts = scoreSignal(sig);

    if (pts < QUALIFY_THRESHOLD) {
      countBelowThreshold++;
      if (VERBOSE) {
        console.log(`  [SKIP:score=${pts}] T${sig.source_tier} ${sig.source_name} | "${sig.title.slice(0, 70)}"`);
      }
      continue;
    }

    countQueued++;
    byFormat[format]++;

    if (DRY_RUN || VERBOSE) {
      console.log(`  [QUEUE format=${format} score=${pts}] T${sig.source_tier} ${sig.source_name} | "${sig.title.slice(0, 70)}"`);
    }

    drafts.push({
      source_url          : sig.url,
      source_title        : sig.title,
      source_excerpt      : sig.body ? sig.body.slice(0, 500).trim() : null,
      source_published_at : sig.published_at || null,
      draft_format        : format,
      status              : 'draft',
    });
  }

  if (!DRY_RUN && drafts.length > 0) {
    await writeDrafts(drafts);
    console.log(`Wrote ${drafts.length} rows to pending_drafts.`);
  } else if (DRY_RUN) {
    console.log(`[DRY-RUN] Would write ${drafts.length} rows to pending_drafts.`);
  }

  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('');
  console.log(
    `CLASSIFY SUMMARY: candidates=${limited.length}` +
    ` skipped_existing=${countSkippedExisting}` +
    ` skipped_community=${countCommunity}` +
    ` below_threshold=${countBelowThreshold}` +
    ` queued=${countQueued}` +
    ` (news=${byFormat.news} review=${byFormat.review} opinion=${byFormat.opinion})` +
    ` duration=${dur}s` +
    (DRY_RUN ? ' [DRY-RUN]' : '')
  );
})().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
