// cleanup-published-assets.js
// Usage: node cleanup-published-assets.js --dry-run
//        node cleanup-published-assets.js
import { createClient } from '@supabase/supabase-js';
import { appendFileSync } from 'node:fs';

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

function urlToPath(url, bucket) {
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

// Derives the set-num prefix (e.g. "76342-1") from a root-level filename for
// each of the three known social-assets naming shapes, or null if none
// match. Feed images come in two forms -- a bare "{set_num}_feed.jpg" and
// numbered variants "{set_num}_feed_7.jpg" -- handled by one regex rather
// than chained .replace() calls, which would need extra care to strip a
// variable numeric suffix correctly. quiet-panic-assets has no equivalent
// multi-file-per-set convention (one .mp4 per post, matched directly via
// storage_url), so this is social-assets-only.
function extractSetNum(filename) {
  if (filename.endsWith('_shorts.mp4')) return filename.slice(0, -'_shorts.mp4'.length);
  if (filename.endsWith('_reels.mp4')) return filename.slice(0, -'_reels.mp4'.length);
  const feedMatch = filename.match(/^(.+)_feed(?:_\d+)?\.jpg$/);
  if (feedMatch) return feedMatch[1];
  return null;
}

// ── social-assets: video_posts + posted_sets, direct URLs + root-file cross-check ──
async function collectSocialAssetsPaths() {
  const BUCKET = 'social-assets';

  const posts = await fetchAll(() => {
    let q = supabase.from('video_posts').select('id, storage_url, qc_frame_urls').in('status', ['posted_both', 'discarded']);
    if (AGE_GUARD) q = q.lt('posted_at', AGE_CUTOFF_ISO);
    return q;
  });

  const videoPaths = [];
  for (const p of posts) {
    if (p.storage_url) {
      const path = urlToPath(p.storage_url, BUCKET);
      if (path) videoPaths.push(path);
    }
    const frames = Array.isArray(p.qc_frame_urls) ? p.qc_frame_urls : [];
    for (const frameUrl of frames) {
      const path = urlToPath(frameUrl, BUCKET);
      if (path) videoPaths.push(path);
    }
  }

  const sets = await fetchAll(() => {
    let q = supabase.from('posted_sets').select('set_num')
      .eq('ig_feed_posted', true).eq('ig_reels_posted', true).eq('yt_shorts_posted', true);
    if (AGE_GUARD) q = q.lt('posted_at', AGE_CUTOFF_ISO);
    return q;
  });
  const setNums = new Set(sets.map(s => s.set_num));

  const rootFiles = await listAllRoot(BUCKET);
  const rootPaths = rootFiles
    .map(f => ({ name: f.name, setNum: extractSetNum(f.name) }))
    .filter(f => f.setNum !== null && setNums.has(f.setNum))
    .map(f => f.name);

  return { bucket: BUCKET, paths: [...new Set([...videoPaths, ...rootPaths])] };
}

// ── quiet-panic-assets: quiet_panic_posts only, direct storage_url match ──
// No qc_frame_urls, no posted_sets-equivalent cross-check table, no
// multi-file-per-set root naming convention -- one row's storage_url is the
// entire footprint of that post in this bucket.
async function collectQuietPanicAssetsPaths() {
  const BUCKET = 'quiet-panic-assets';

  const posts = await fetchAll(() => {
    let q = supabase.from('quiet_panic_posts').select('id, storage_url').in('status', ['posted_both', 'discarded']);
    if (AGE_GUARD) q = q.lt('posted_at', AGE_CUTOFF_ISO);
    return q;
  });

  const paths = [];
  for (const p of posts) {
    if (p.storage_url) {
      const path = urlToPath(p.storage_url, BUCKET);
      if (path) paths.push(path);
    }
  }

  return { bucket: BUCKET, paths: [...new Set(paths)] };
}

async function processBucket(collectFn) {
  const { bucket, paths } = await collectFn();
  const guardNote = AGE_GUARD ? `age guard ON, posted_at < ${AGE_CUTOFF_ISO} (${AGE_GUARD_HOURS}h)` : 'age guard OFF (--no-age-guard)';
  const mode = DRY_RUN ? '[DRY RUN]' : 'LIVE RUN';
  console.log(`\n=== ${bucket} ===`);
  console.log(`${mode} (${guardNote}) — ${paths.length} files targeted:`);
  paths.forEach(p => console.log('  ' + p));
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
