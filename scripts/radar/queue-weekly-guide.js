'use strict';
/**
 * Guides weekly topic queue (§5, Nav & Content Overhaul, 2026-08-09).
 *
 * Picks the next unused topic from guide-topics.js and queues ONE
 * pending_drafts row (draft_format='guide', status='approved'). No new
 * generation code — the existing daily generate-drafts.yml cron (08:30
 * UTC) already processes any status='approved' AND draft_body IS NULL row
 * regardless of format, through the same gates/failover every other format
 * uses, and publish-draft.ts already knows how to route format='guide' to
 * the guides table (resolveTarget()) — that machinery was built for WEB-05
 * and has simply never had anything feeding it until now.
 *
 * Guides have no real source article, so source_url is a synthetic,
 * deterministic marker (https://bricksofindia.com/guides#topic-<slug>) —
 * fetchFullBody() in generate-approved-drafts.ts already tolerates a fetch
 * failure gracefully for every format (try/catch -> null), so this being
 * unfetchable is a non-issue; the model works from source_title +
 * source_excerpt (the topic's brief) instead.
 *
 * Dedup (two layers, belt-and-suspenders):
 *   1. Topic's synthetic source_url already in pending_drafts (any status)
 *      -> topic already queued/generated, skip to the next one.
 *   2. Topic's title already exists in guides.title -> covered by some
 *      other route (manual write, earlier pipeline run), skip.
 * If every backlog topic is already covered, logs a clear "backlog
 * exhausted" warning and exits cleanly (no insert) — a real signal to add
 * more topics to guide-topics.js, not a failure.
 *
 * Usage:
 *   node scripts/radar/queue-weekly-guide.js [--dry-run]
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const TOPICS = require('./guide-topics');

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

function topicUrl(slug) {
  return `https://bricksofindia.com/guides#topic-${slug}`;
}

(async () => {
  const t0 = Date.now();
  console.log(`━━ Guides weekly topic queue${DRY_RUN ? ' [DRY-RUN]' : ''} ━━━━━━━━━━━━━━━━━━━━━━━━`);

  const [{ data: existingGuides, error: gErr }, { data: queuedDrafts, error: dErr }] = await Promise.all([
    sb.from('guides').select('title'),
    sb.from('pending_drafts').select('source_url').eq('draft_format', 'guide'),
  ]);
  if (gErr) throw gErr;
  if (dErr) throw dErr;

  const existingTitles = new Set((existingGuides ?? []).map(g => g.title));
  const queuedUrls     = new Set((queuedDrafts ?? []).map(d => d.source_url));

  const next = TOPICS.find(t => !queuedUrls.has(topicUrl(t.slug)) && !existingTitles.has(t.title));

  if (!next) {
    console.log(`BACKLOG EXHAUSTED — all ${TOPICS.length} topics in guide-topics.js are already queued or published. Add more topics to keep the weekly cadence going.`);
    return;
  }

  console.log(`Next topic: "${next.title}" [${next.category}, bucket=${next.bucket}]`);

  if (DRY_RUN) {
    console.log('[DRY-RUN] would insert pending_drafts row, draft_format=guide, status=approved.');
    return;
  }

  const { error: insErr } = await sb.from('pending_drafts').insert({
    source_url:          topicUrl(next.slug),
    source_title:        next.title,
    source_excerpt:      next.brief,
    source_published_at: new Date().toISOString(),
    draft_format:        'guide',
    draft_category:      next.category,
    status:              'approved',
    approved_at:         new Date().toISOString(),
    // Distinct from a human admin click or RADAR's tier-based auto-approve
    // — an honest audit trail of what actually decided this (matches the
    // existing 'radar-auto-tier1-2' convention in classify-signals.js).
    approved_by:         'radar-guide-weekly',
  });
  if (insErr) throw insErr;

  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Queued. ${dur}s total`);
})().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
