// scripts/retention-cleanup.mjs
// Usage: node scripts/retention-cleanup.mjs --dry-run
//        node scripts/retention-cleanup.mjs
//
// Two retention actions, both on a 30-day cutoff:
//
// 1. public.run_retention() (SQL, 2026-09-25 DB-size issue): price_history
//    compaction, raw_signals body/raw_payload clearing (rows and hashes
//    kept), content_image_registry latest-row-per-key, and a 90-day
//    retention on content_quality_issues_archive. See that migration for
//    the rules and the reader checks behind them.
//
// 2. content_quality_issues -- archived (not hard-deleted) to
//    content_quality_issues_archive for resolved=true rows older than 30
//    days. A real FK from content_fix_log.issue_id (a permanent body-diff
//    audit log) blocks deleting any row it still references -- found live
//    during the validation run, not anticipated in advance. This script
//    copies the FULL eligible set into the archive table every run (cheap,
//    idempotent via ON CONFLICT DO NOTHING) but only deletes from the
//    source rows with no content_fix_log reference. A small number of
//    eligible rows will therefore stay in the live table indefinitely if
//    content_fix_log keeps referencing them -- that's correct, not a bug.
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const CUTOFF_DAYS = 30;
const CUTOFF_ISO = new Date(Date.now() - CUTOFF_DAYS * 24 * 60 * 60 * 1000).toISOString();

// #152, found live 2026-09-20 on this workflow's own first-ever scheduled
// run: an unchunked `.in('issue_id', ids)` against 2,910 ids failed. Root
// cause confirmed directly (not guessed): PostgREST's `.in()` filter is a
// URL query param, not a request body, and a 400-id batch produced a
// 15,696-char request line -- past the ~16KB header/URL limit
// (undici's HeadersOverflowError, confirmed via a live repro against this
// same table). Empirically re-tested at N=100/150/200/250/300/325/350 (all
// OK) and N=400 (fails) -- FILTER_BATCH picks 200, ~2x margin under the
// observed safe ceiling. The archive upsert below sends ids in the POST
// body, not the URL, so it isn't subject to this limit and keeps the
// larger batch size already used elsewhere in this repo
// (cleanup-published-assets.js's BATCH=400 precedent).
const BATCH = 400;
const FILTER_BATCH = 200;
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// DB-size issue (2026-09-25): price_history compaction, raw_signals
// body + raw_payload clearing, content_image_registry dedup and the
// 90-day archive retention all run in one SQL function
// (supabase/migrations/20260925000000_run_retention.sql) -- the
// price_history rule needs window functions PostgREST filters can't
// express. It supersedes the raw_payload-only update that lived here.
async function runRetention() {
  const { data, error } = await supabase.rpc('run_retention', { p_dry_run: DRY_RUN });
  if (error) throw new Error(`run_retention failed: ${error.message || JSON.stringify(error)}`);
  console.log(`[run_retention] ${JSON.stringify(data)}`);
}

async function fetchAllEligibleIssues() {
  const PAGE = 1000;
  let all = [], from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('content_quality_issues')
      .select('*')
      .eq('resolved', true)
      .lt('resolved_at', CUTOFF_ISO)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`content_quality_issues fetch failed: ${error.message}`);
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function archiveContentQualityIssues() {
  const rows = await fetchAllEligibleIssues();
  console.log(`[content_quality_issues] ${rows.length} resolved row(s) older than ${CUTOFF_DAYS}d (cutoff ${CUTOFF_ISO})`);
  if (rows.length === 0) return;

  if (DRY_RUN) return;

  const ids = rows.map(r => r.id);

  // Copy the full eligible set into the archive first -- idempotent, safe
  // to re-run (ON CONFLICT on the archive's primary key, inherited via
  // `LIKE content_quality_issues INCLUDING ALL`). Batched -- see #152.
  const archiveRows = rows.map(r => ({ ...r, archived_at: new Date().toISOString() }));
  let archivedCount = 0;
  for (const batch of chunk(archiveRows, BATCH)) {
    const { error: insErr } = await supabase
      .from('content_quality_issues_archive')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true });
    if (insErr) throw new Error(`content_quality_issues_archive insert failed (batch of ${batch.length}): ${insErr.message || JSON.stringify(insErr)}`);
    archivedCount += batch.length;
  }
  console.log(`[content_quality_issues] Archived ${archivedCount} row(s).`);

  // Only delete rows content_fix_log doesn't reference -- a real FK
  // (content_fix_log.issue_id) blocks deleting the rest; find that subset
  // via batched queries rather than one giant `.in()` (#152: an unchunked
  // `.in('issue_id', ids)` against 2,910 ids failed with an empty error
  // message -- surfacing the raw error object too now, in case a real
  // message is genuinely absent again) and rather than deleting one-by-one
  // and catching FK errors (that would be silent-partial-success dressed up
  // as retention).
  const referencedIds = new Set();
  for (const batch of chunk(ids, FILTER_BATCH)) {
    const { data: referenced, error: refErr } = await supabase
      .from('content_fix_log')
      .select('issue_id')
      .in('issue_id', batch);
    if (refErr) throw new Error(`content_fix_log reference check failed (batch of ${batch.length}): ${refErr.message || JSON.stringify(refErr)}`);
    for (const r of referenced ?? []) referencedIds.add(r.issue_id);
  }
  const deletableIds = ids.filter(id => !referencedIds.has(id));

  console.log(`[content_quality_issues] ${referencedIds.size} row(s) still referenced by content_fix_log -- kept in place. Deleting ${deletableIds.length}.`);
  if (deletableIds.length === 0) return;

  let deletedCount = 0;
  for (const batch of chunk(deletableIds, FILTER_BATCH)) {
    const { error: delErr } = await supabase
      .from('content_quality_issues')
      .delete()
      .in('id', batch);
    if (delErr) throw new Error(`content_quality_issues delete failed (batch of ${batch.length}): ${delErr.message || JSON.stringify(delErr)}`);
    deletedCount += batch.length;
  }
  console.log(`[content_quality_issues] Deleted ${deletedCount} row(s) from the live table.`);
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE RUN ===');
  await runRetention();
  await archiveContentQualityIssues();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
