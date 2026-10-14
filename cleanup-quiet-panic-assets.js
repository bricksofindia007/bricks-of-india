// cleanup-quiet-panic-assets.js
// Same shape as cleanup-published-assets.js (social-assets), applied to the
// quiet-panic-assets bucket / quiet_panic_posts table. Built 2026-09-20 --
// prior passes only ever computed eligibility via direct SQL against
// storage.objects, never through a real, reusable tool (see
// BOI_MASTER_TRACKER.md's quiet-panic-assets cleanup entries).
//
// Usage: node cleanup-quiet-panic-assets.js --dry-run
//        node cleanup-quiet-panic-assets.js
//
// KNOWN GAP (same shape as cleanup-published-assets.js's video_posts
// 'discarded' gap): quiet_panic_posts rows with status='rejected' don't
// have posted_at set (a rejected render was never posted), so the
// posted_at-based age guard can never reach them -- reachable only via
// --no-age-guard. Left as a real behavior decision for a human, not
// guessed at here.
import { createClient } from '@supabase/supabase-js';
import { appendFileSync } from 'node:fs';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DRY_RUN = process.argv.includes('--dry-run');
const AGE_GUARD = !process.argv.includes('--no-age-guard');
const AGE_GUARD_HOURS = 72;
const PAGE = 1000;
const BUCKET = 'quiet-panic-assets';
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

function writeStepSummary(mode, guardNote, paths) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const lines = [
    `## cleanup-quiet-panic-assets.js — ${mode}`,
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

async function main() {
  const posts = await fetchAll(() => {
    let q = supabase.from('quiet_panic_posts').select('id, status, storage_url, posted_at');
    if (AGE_GUARD) q = q.lt('posted_at', AGE_CUTOFF_ISO);
    return q;
  });

  const eligibleByStatus = {};
  const eligiblePaths = [];
  for (const p of posts) {
    if (p.status !== 'posted_both') continue; // mirror cleanup-published-assets.js's posted+discarded scope, minus the known rejected/posted_at gap
    if (p.storage_url) {
      const path = urlToPath(p.storage_url);
      if (path) {
        eligiblePaths.push(path);
        eligibleByStatus[p.status] = (eligibleByStatus[p.status] || 0) + 1;
      }
    }
  }

  // Orphan check: real objects in the bucket with zero quiet_panic_posts row referencing them at all.
  const allPostUrls = await fetchAll(() => supabase.from('quiet_panic_posts').select('storage_url'));
  const referencedPaths = new Set(allPostUrls.map((p) => p.storage_url && urlToPath(p.storage_url)).filter(Boolean));
  const rootFiles = await listAllRoot(BUCKET);
  const orphans = rootFiles.filter((f) => !referencedPaths.has(f.name));

  const guardNote = AGE_GUARD ? `age guard ON, posted_at < ${AGE_CUTOFF_ISO} (${AGE_GUARD_HOURS}h)` : 'age guard OFF (--no-age-guard)';
  const mode = DRY_RUN ? '[DRY RUN]' : 'LIVE RUN';
  console.log(`${mode} (${guardNote})`);
  console.log(`Eligible posted_both files: ${eligiblePaths.length} (${JSON.stringify(eligibleByStatus)})`);
  eligiblePaths.forEach((p) => console.log('  ' + p));
  console.log(`\nOrphaned objects (no quiet_panic_posts row references them at all): ${orphans.length}`);
  orphans.forEach((f) => console.log('  ' + f.name + ' (' + f.metadata?.size + ' bytes)'));
  writeStepSummary(mode, guardNote, eligiblePaths);
  if (DRY_RUN) return;

  for (let i = 0; i < eligiblePaths.length; i += 100) {
    const chunk = eligiblePaths.slice(i, i + 100);
    const { error } = await supabase.storage.from(BUCKET).remove(chunk);
    if (error) console.error(`Batch ${i}-${i + chunk.length} failed:`, error.message);
    else console.log(`Deleted batch ${i}-${i + chunk.length}`);
  }
}

main().catch((err) => { console.error('Cleanup failed:', err.message); process.exit(1); });
