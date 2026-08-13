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
const BUCKET = 'social-assets';

// KNOWN GAP (found live 2026-08-14): video_posts rows with status='discarded'
// don't have posted_at set -- a discarded render was never actually posted,
// so nothing ever populated that column (confirmed: 0 of 1 real discarded
// row has it). Postgres/PostgREST's `<` never matches NULL, so under the
// default age guard a discarded row is silently excluded forever, not just
// delayed 72h -- it can only be reached via --no-age-guard. Left as-is
// deliberately rather than silently substituting created_at as a fallback:
// that's a real behavior decision (whether "discarded" should age off
// created_at instead of posted_at) for a human to make, not something to
// guess at inside a cleanup script.
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
function writeStepSummary(mode, guardNote, paths) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const lines = [
    `## cleanup-published-assets.js — ${mode}`,
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

function urlToPath(url) {
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

// Derives the set-num prefix (e.g. "76342-1") from a root-level filename for
// each of the three known naming shapes, or null if none match. Feed images
// come in two forms -- a bare "{set_num}_feed.jpg" and numbered variants
// "{set_num}_feed_7.jpg" -- handled by one regex rather than chained
// .replace() calls, which would need extra care to strip a variable numeric
// suffix correctly.
function extractSetNum(filename) {
  if (filename.endsWith('_shorts.mp4')) return filename.slice(0, -'_shorts.mp4'.length);
  if (filename.endsWith('_reels.mp4')) return filename.slice(0, -'_reels.mp4'.length);
  const feedMatch = filename.match(/^(.+)_feed(?:_\d+)?\.jpg$/);
  if (feedMatch) return feedMatch[1];
  return null;
}

async function main() {
  const posts = await fetchAll(() => {
    let q = supabase.from('video_posts').select('id, storage_url, qc_frame_urls').in('status', ['posted_both', 'discarded']);
    if (AGE_GUARD) q = q.lt('posted_at', AGE_CUTOFF_ISO);
    return q;
  });

  const videoPaths = [];
  for (const p of posts) {
    if (p.storage_url) {
      const path = urlToPath(p.storage_url);
      if (path) videoPaths.push(path);
    }
    const frames = Array.isArray(p.qc_frame_urls) ? p.qc_frame_urls : [];
    for (const frameUrl of frames) {
      const path = urlToPath(frameUrl);
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

  const allPaths = [...new Set([...videoPaths, ...rootPaths])];
  const guardNote = AGE_GUARD ? `age guard ON, posted_at < ${AGE_CUTOFF_ISO} (${AGE_GUARD_HOURS}h)` : 'age guard OFF (--no-age-guard)';
  const mode = DRY_RUN ? '[DRY RUN]' : 'LIVE RUN';
  console.log(`${mode} (${guardNote}) — ${allPaths.length} files targeted:`);
  allPaths.forEach(p => console.log('  ' + p));
  writeStepSummary(mode, guardNote, allPaths);
  if (DRY_RUN) return;

  for (let i = 0; i < allPaths.length; i += 100) {
    const chunk = allPaths.slice(i, i + 100);
    const { error } = await supabase.storage.from(BUCKET).remove(chunk);
    if (error) console.error(`Batch ${i}-${i + chunk.length} failed:`, error.message);
    else console.log(`Deleted batch ${i}-${i + chunk.length}`);
  }
}

main().catch(err => { console.error('Cleanup failed:', err.message); process.exit(1); });
