'use strict';
/**
 * Opinion fortnightly cadence branch (Nav & Content Overhaul, 2026-08-09).
 *
 * Runs as the step immediately after RADAR-03 (classify-signals.js) in
 * radar.yml, same job, same run. On a deterministic 14-day cycle, reclassifies
 * ONE of today's freshly-queued 'news' pending_drafts rows to 'opinion' —
 * publish-draft.ts's resolveTarget() then routes it to news_articles with
 * category='Opinion' at publish time, same as every other Opinion piece.
 *
 * This does NOT generate anything itself — it only flips draft_format (and
 * auto-approves if needed) on an existing row. The existing daily
 * generate-drafts.yml cron (08:30 UTC, after this run's 17:30 UTC) picks it
 * up and generates it through the exact same gates/failover as any other
 * format. No new generation infrastructure, per Abhinav's explicit
 * "don't build new infrastructure" instruction.
 *
 * Selection (Abhinav, 2026-08-09 — refinement over a plain random pick):
 *   1. Prefer a candidate whose title matches opinion-signal.js's OPINION_RE
 *      (editorial/comparison/ranking-shaped) — genuinely more likely to
 *      support a real hot take than a plain announcement.
 *   2. If none match, fall back to today's strongest general News-worthy
 *      candidate (same tier+freshness+body scoring RADAR-03 used to qualify
 *      it in the first place) and set opinion_forced_take=true, which
 *      draft-prompt.ts reads to explicitly instruct the model to write a
 *      deliberate take rather than assume the source material already has
 *      an angle.
 *   3. Log which path fired (keyword_match / fallback / no_candidate) to
 *      opinion_cadence_log — same instinct as social_automation_heartbeat's
 *      consecutive_skip_days: if 'fallback' dominates over time, that's a
 *      signal the source mix lacks opinion-shaped material, not that this
 *      mechanism is broken.
 *
 * Idempotent per UTC day: opinion_cadence_log.cycle_date is UNIQUE — a
 * second run on the same day (e.g. manual workflow_dispatch) is a no-op,
 * not a second reclassification.
 *
 * Usage:
 *   node scripts/radar/opinion-cadence.js [--dry-run] [--force]
 *
 * --force bypasses the day-count check only (still respects the
 * idempotency guard against opinion_cadence_log — running --force twice
 * the same day is still a no-op the second time). For manually proving the
 * mechanism works end-to-end without waiting on the calendar.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { looksLikeOpinion } = require('./opinion-signal');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const DAY_MS = 86_400_000;
const CADENCE_DAYS = 14;
const TIER_SCORE = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };

// Mirrors classify-signals.js's scoreSignal() — kept as its own small copy
// rather than a shared import, since the two scripts qualify different
// populations (RADAR-03 scores raw_signals against a >=4 qualify threshold;
// this only ranks candidates that already cleared that bar) and drift here
// is low-risk (a ranking tie-break, not a pass/fail gate).
function strength(sig) {
  let pts = TIER_SCORE[sig.source_tier] ?? 1;
  if (sig.body && sig.body.length > 20) pts += 2;
  if (sig.published_at) {
    const ageMs = Date.now() - new Date(sig.published_at).getTime();
    if (ageMs < 7 * DAY_MS) pts += 2;
    else if (ageMs < 30 * DAY_MS) pts += 1;
  }
  return pts;
}

async function logCadence(cycleDate, path, extra = {}) {
  if (DRY_RUN) {
    console.log(`[DRY-RUN] would log opinion_cadence_log: cycle_date=${cycleDate} path=${path}`, extra);
    return;
  }
  const { error } = await sb.from('opinion_cadence_log').insert({ cycle_date: cycleDate, path, ...extra });
  if (error && error.code !== '23505') { // 23505 = already logged today (idempotency guard tripped by a concurrent/retried run)
    console.error('[supabase-write] table=opinion_cadence_log op=insert error:', error);
  }
}

(async () => {
  const t0 = Date.now();
  console.log(`━━ RADAR-03b opinion cadence${DRY_RUN ? ' [DRY-RUN]' : ''} ━━━━━━━━━━━━━━━━━━━━━━━━`);

  const cycleDayNumber = Math.floor(Date.now() / DAY_MS);
  const cycleDate = new Date().toISOString().slice(0, 10); // UTC date
  const isOpinionDay = cycleDayNumber % CADENCE_DAYS === 0;

  if (!isOpinionDay && !FORCE) {
    console.log(`Not an Opinion day (day ${cycleDayNumber} % ${CADENCE_DAYS} = ${cycleDayNumber % CADENCE_DAYS}) — skipping.`);
    return;
  }
  if (!isOpinionDay && FORCE) {
    console.log(`Not naturally an Opinion day (day ${cycleDayNumber} % ${CADENCE_DAYS} = ${cycleDayNumber % CADENCE_DAYS}) — proceeding anyway (--force).`);
  }

  // Idempotency guard — a manual workflow_dispatch re-run on the same UTC
  // day must not reclassify a second row.
  const { data: existingLog } = await sb
    .from('opinion_cadence_log')
    .select('id, path')
    .eq('cycle_date', cycleDate)
    .maybeSingle();
  if (existingLog) {
    console.log(`Opinion day, but already ran today (path=${existingLog.path}) — skipping.`);
    return;
  }

  // Candidate pool: today's freshly-classified 'news' rows, not yet
  // generated, and STILL ELIGIBLE (status IN draft/approved). Confirmed
  // live 2026-08-09: without the status filter, this picked up a same-day
  // row classify-signals.js had already rejected as filler
  // (status='rejected', a Brickset "Random X of the day" item) and
  // "reclassified" a dead row to opinion while a real, still-eligible
  // candidate (status='draft') sat right next to it, unpicked. A rejected
  // row is not a candidate — it's already been decided.
  const { data: candidates, error: candErr } = await sb
    .from('pending_drafts')
    .select('id, source_url, source_title, status, created_at')
    .eq('draft_format', 'news')
    .in('status', ['draft', 'approved'])
    .is('draft_body', null)
    .gte('created_at', `${cycleDate}T00:00:00Z`);
  if (candErr) throw candErr;

  if (!candidates || candidates.length === 0) {
    console.log('Opinion day, but no unqueued News candidates from today — logging no_candidate.');
    await logCadence(cycleDate, 'no_candidate');
    return;
  }

  let chosen = candidates.find(c => looksLikeOpinion(c.source_title));
  let path = 'keyword_match';

  if (!chosen) {
    const urls = candidates.map(c => c.source_url);
    const { data: sigRows, error: sigErr } = await sb
      .from('raw_signals')
      .select('url, source_tier, published_at, body')
      .in('url', urls);
    if (sigErr) throw sigErr;
    const byUrl = new Map((sigRows ?? []).map(s => [s.url, s]));
    const ranked = candidates
      .map(c => ({ c, score: byUrl.has(c.source_url) ? strength(byUrl.get(c.source_url)) : 0 }))
      .sort((a, b) => b.score - a.score);
    chosen = ranked[0]?.c ?? null;
    path = 'fallback';
  }

  if (!chosen) {
    console.log('Opinion day, but could not resolve a candidate (unexpected) — logging no_candidate.');
    await logCadence(cycleDate, 'no_candidate');
    return;
  }

  console.log(`Opinion day: chose "${(chosen.source_title || '').slice(0, 70)}" via ${path}.`);

  if (DRY_RUN) {
    console.log(`[DRY-RUN] would reclassify pending_drafts.id=${chosen.id} to draft_format='opinion'${path === 'fallback' ? ', opinion_forced_take=true' : ''}.`);
    await logCadence(cycleDate, path, { source_url: chosen.source_url, pending_draft_id: chosen.id });
    return;
  }

  const updates = { draft_format: 'opinion' };
  if (path === 'fallback') updates.opinion_forced_take = true;
  // The cadence check itself IS the approval decision for this one slot —
  // a fortnightly promise shouldn't silently no-op because the chosen
  // signal's source tier didn't happen to qualify for auto-approve.
  if (chosen.status === 'draft') {
    updates.status = 'approved';
    updates.approved_at = new Date().toISOString();
    updates.approved_by = 'radar-opinion-cadence';
  }

  const { error: updErr } = await sb.from('pending_drafts').update(updates).eq('id', chosen.id);
  if (updErr) throw updErr;

  await logCadence(cycleDate, path, { source_url: chosen.source_url, pending_draft_id: chosen.id });

  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Reclassified -> draft_format=opinion (path=${path}). ${dur}s total`);
})().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
