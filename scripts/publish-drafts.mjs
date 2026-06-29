/**
 * Publish pending_drafts in batch.
 *
 * Unified 2026-06-28: lint gates, slug/target resolution, hero-image
 * resolution, pre-publish auto-fix, and the core publish orchestration all
 * now live in src/lib/publish-draft.ts — shared with the admin manual-publish
 * button (src/app/admin/pending/actions.ts::publishDraft) and the generation
 * pipeline's news auto-publish path (scripts/generate-approved-drafts.ts).
 * This script's job is purely the batch loop: fetch the queue, call
 * publishOneDraft() per row, handle the failed_lint/CQS-reject DB writes that
 * are specific to the cron's retry semantics, print a summary. See
 * publish-draft.ts's header comment for what was merged from this file's
 * prior independent implementation (prePublishAutoFix, cqsHardCheck,
 * EDITORIAL_CDN_BLOCKLIST) and from actions.ts (sendLintAlert is NOT used
 * here — see options.onLintFail below, intentionally omitted for batch runs).
 *
 * Usage:
 *   node --env-file=.env.local scripts/publish-drafts.mjs --limit 15
 *   node --env-file=.env.local scripts/publish-drafts.mjs --ids id1,id2,...
 *   node --env-file=.env.local scripts/publish-drafts.mjs --dry-run --limit 15
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateSlug, resolveTarget, publishOneDraft, LintFailedError } from '../src/lib/publish-draft.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const raw = readFileSync(join(__dirname, '../.env.local'), 'utf-8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  }
} catch {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL     = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bricksofindia.com').replace(/\/$/, '');

if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env vars'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_I = process.argv.indexOf('--limit');
const LIMIT   = LIMIT_I !== -1 ? parseInt(process.argv[LIMIT_I + 1], 10) : 50;
const IDS_I   = process.argv.indexOf('--ids');
const IDS     = IDS_I !== -1 ? process.argv[IDS_I + 1].split(',').map(s => s.trim()) : null;

// ── Fetch drafts ──────────────────────────────────────────────────────────────
// MEDIUM-64 fixed 2026-06-29: previously ordered by updated_at descending
// (newest-touched-first) — inconsistent with generate-approved-drafts.ts's
// true FIFO (created_at ascending, oldest-first). Low impact while this
// queue stays near-empty (it only holds drafts that completed generation
// but failed Gate 7/lint, post-2026-06-28's auto-reject-delete policy this
// should be rare), but a real bug if it ever fills: older rejected drafts
// would sit behind newer ones indefinitely, unreachable by a --limit raise.
let q = sb.from('pending_drafts')
  .select('id, draft_title, draft_body, draft_verdict, draft_format, word_count, source_url, source_title, source_excerpt, lint_result, created_at, updated_at')
  .eq('status', 'draft')
  .not('draft_body', 'is', null)
  .order('created_at', { ascending: true });

if (IDS) q = q.in('id', IDS);
else     q = q.limit(LIMIT);

const { data: drafts, error: fetchErr } = await q;
if (fetchErr) { console.error('Fetch error:', fetchErr.message); process.exit(1); }

const queue = (drafts ?? []).filter(d => d.draft_title && d.draft_title !== 'undefined' && d.draft_body?.trim().length > 50);
console.log(`━━ publish-drafts${DRY_RUN ? ' [DRY RUN]' : ''} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Drafts to process: ${queue.length} (from ${drafts?.length ?? 0} fetched)\n`);

// ── Process each draft ────────────────────────────────────────────────────────

let published = 0, failed = 0, skipped = 0;
const failures = [];

for (const draft of queue) {
  const label = (draft.draft_title || draft.source_title || draft.id).slice(0, 65);
  process.stdout.write(`  ${label}… `);

  if (DRY_RUN) {
    // Dry-run still needs to know the target path/slug for a useful preview,
    // but must not touch the DB (no slug-uniqueness lookups, no inserts).
    const format   = draft.draft_format || 'news';
    const { path } = resolveTarget(format);
    const baseSlug  = generateSlug(draft.draft_title || draft.source_title || 'Untitled');
    skipped++;
    console.log(`DRY-RUN → ${path}/${baseSlug} [${format}, verdict=${draft.draft_verdict ?? 'none'}]`);
    continue;
  }

  try {
    const { path, slug } = await publishOneDraft(draft, sb, {
      // No onLintFail callback here — batch runs would spam an email per
      // failure. The cron's failure visibility is the failed_lint status +
      // the summary printed at the end of this run, not per-draft alerts.
    });
    published++;
    console.log(`OK → ${SITE_URL}${path}/${slug}`);
  } catch (err) {
    if (err instanceof LintFailedError) {
      failed++;
      failures.push({ title: label, reason: err.gateMessage });
      console.log(`FAIL: ${err.gateMessage}`);
      await sb.from('pending_drafts').update({
        status: 'failed_lint',
        updated_at: new Date().toISOString(),
      }).eq('id', draft.id);
      continue;
    }

    if (err.message?.startsWith('[CQS REJECT]')) {
      failed++;
      failures.push({ title: label, reason: err.message });
      console.log(`\n  CQS REJECT: ${err.message} — resetting to approved`);
      await sb.from('pending_drafts').update({
        status: 'approved', draft_body: null, draft_verdict: null, word_count: null, lint_result: null,
      }).eq('id', draft.id);
      continue;
    }

    // Any other error (insert failure, etc.) — log and move on, don't crash the whole batch.
    failed++;
    failures.push({ title: label, reason: err.message });
    console.log(`INSERT FAIL: ${err.message}`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Published : ${published}`);
console.log(`Failed    : ${failed}`);
if (DRY_RUN) console.log(`Dry-run   : ${skipped}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  ❌ ${f.title.slice(0, 60)}\n     ${f.reason}`);
}
