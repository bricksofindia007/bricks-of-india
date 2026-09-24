// cleanup-published-assets.js
// Usage: node cleanup-published-assets.js --dry-run
//        node cleanup-published-assets.js
import { createClient } from '@supabase/supabase-js';
import { appendFileSync } from 'node:fs';
import {
  candidatePaths, protectedPaths, rootFilePaths, finalizeSelection,
} from './scripts/lib/cleanup-selection.mjs';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
// Age guard defaults ON (unattended/scheduled use) -- pass --no-age-guard for
// a manual one-off run that should also catch recently-posted assets.
const AGE_GUARD = !process.argv.includes('--no-age-guard');
const AGE_GUARD_HOURS = 72;
const PAGE = 1000;

// KNOWN GAP (found live 2026-08-14): a discarded/rejected row's posted_at is
// never set -- it was never actually posted, so nothing ever populated that
// column. Postgres/PostgREST's `<` never matches NULL, so under the default
// age guard a discarded/rejected row is silently excluded forever, not just
// delayed 72h -- it can only be reached via --no-age-guard. Left as-is
// deliberately rather than silently substituting created_at as a fallback:
// that's a real behavior decision for a human to make, not something to
// guess at inside a cleanup script. Applies identically to both buckets
// below (video_posts.discarded and quiet_panic_posts.discarded share the
// same posted_at-never-set shape).
const AGE_CUTOFF_ISO = new Date(Date.now() - AGE_GUARD_HOURS * 60 * 60 * 1000).toISOString();

async function fetchAll(queryFn) {
  let all = [], from = 0;
  while (true) {
    const { data, error } = await queryFn().range(from, from + PAGE - 1);
    if (error) throw new Error(`Query failed: ${error.message}`);
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function listAllRoot(bucket) {
  let all = [], offset = 0;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list('', { limit: PAGE, offset });
    if (error) throw new Error(`Storage list failed: ${error.message}`);
    all = all.concat(data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// Writes to the workflow run summary when running as a GitHub Actions step
// (no-op locally, where GITHUB_STEP_SUMMARY is unset) -- same convention
// already used elsewhere in this repo for $GITHUB_OUTPUT (see
// generate_quiet_panic_video.py's _write_github_output).
function writeStepSummary(bucket, mode, guardNote, paths) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const lines = [
    `## cleanup-published-assets.js — ${bucket} — ${mode}`,
    '',
    `**${guardNote}**`,
    '',
    `**${paths.length} file(s) targeted**`,
    '',
    '<details><summary>Full file list</summary>',
    '',
    '```',
    ...paths,
    '```',
    '',
    '</details>',
    '',
  ].join('\n');
  appendFileSync(summaryPath, lines);
}

// ── Selection (issue #177): all rows are fetched regardless of status, and
// the pure functions in scripts/lib/cleanup-selection.mjs decide. A path is
// deleted only if an allow-listed terminal row (posted_both/discarded, past
// the age guard) references it AND no row in any other status references the
// same path. Anything the deny layer holds back is printed as BLOCKED.

// ── social-assets: video_posts + posted_sets, direct URLs + root-file cross-check ──
async function collectSocialAssetsPaths() {
  const BUCKET = 'social-assets';
  const cutoff = AGE_GUARD ? AGE_CUTOFF_ISO : null;

  const posts = await fetchAll(() =>
    supabase.from('video_posts').select('id, status, posted_at, storage_url, qc_frame_urls').order('id'));

  const candidates = candidatePaths(posts, BUCKET, cutoff);

  const sets = await fetchAll(() => {
    let q = supabase.from('posted_sets').select('set_num')
      .eq('ig_feed_posted', true).eq('ig_reels_posted', true).eq('yt_shorts_posted', true)
      .order('set_num');
    if (AGE_GUARD) q = q.lt('posted_at', AGE_CUTOFF_ISO);
    return q;
  });

  const rootFiles = await listAllRoot(BUCKET);
  for (const p of rootFilePaths(rootFiles.map((f) => f.name), sets.map((s) => s.set_num))) {
    candidates.add(p);
  }

  return { bucket: BUCKET, ...finalizeSelection(candidates, protectedPaths(posts, BUCKET)) };
}

// ── quiet-panic-assets: quiet_panic_posts only, direct storage_url match ──
// No qc_frame_urls, no posted_sets-equivalent cross-check table, no
// multi-file-per-set root naming convention -- one row's storage_url is the
// entire footprint of that post in this bucket.
async function collectQuietPanicAssetsPaths() {
  const BUCKET = 'quiet-panic-assets';
  const cutoff = AGE_GUARD ? AGE_CUTOFF_ISO : null;

  const posts = await fetchAll(() =>
    supabase.from('quiet_panic_posts').select('id, status, posted_at, storage_url').order('id'));

  return {
    bucket: BUCKET,
    ...finalizeSelection(candidatePaths(posts, BUCKET, cutoff), protectedPaths(posts, BUCKET)),
  };
}

async function processBucket(collectFn) {
  const { bucket, toDelete: paths, blocked } = await collectFn();
  const guardNote = AGE_GUARD ? `age guard ON, posted_at < ${AGE_CUTOFF_ISO} (${AGE_GUARD_HOURS}h)` : 'age guard OFF (--no-age-guard)';
  const mode = DRY_RUN ? '[DRY RUN]' : 'LIVE RUN';
  console.log(`\n=== ${bucket} ===`);
  console.log(`${mode} (${guardNote}) — ${paths.length} files targeted:`);
  paths.forEach(p => console.log('  ' + p));
  if (blocked.length > 0) {
    console.log(`BLOCKED by deny layer (referenced by a non-terminal row) -- ${blocked.length} files, NOT deleted:`);
    blocked.forEach(p => console.log('  ' + p));
  }
  writeStepSummary(bucket, mode, guardNote, paths);
  if (DRY_RUN) return { bucket, targeted: paths.length, deleted: 0, failed: 0 };

  let deleted = 0, failed = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { error } = await supabase.storage.from(bucket).remove(chunk);
    if (error) { console.error(`Batch ${i}-${i + chunk.length} failed:`, error.message); failed += chunk.length; }
    else { console.log(`Deleted batch ${i}-${i + chunk.length}`); deleted += chunk.length; }
  }
  return { bucket, targeted: paths.length, deleted, failed };
}

async function main() {
  const results = [];
  results.push(await processBucket(collectSocialAssetsPaths));
  results.push(await processBucket(collectQuietPanicAssetsPaths));

  console.log('\n=== SUMMARY ===');
  for (const r of results) {
    console.log(`${r.bucket}: ${r.targeted} targeted, ${r.deleted} deleted, ${r.failed} failed`);
  }
  if (results.some(r => r.failed > 0)) process.exit(1);
}

main().catch(err => { console.error('Cleanup failed:', err.message); process.exit(1); });
