/**
 * One-shot: find pending_drafts with status='draft' + body that fail Gate 2 lint,
 * clear their draft_body and reset to status='approved' so they get regenerated
 * with the current prompt on the next generate run.
 *
 * Usage: node --env-file=.env.local scripts/reset-failing-drafts.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const DRY_RUN = process.argv.includes('--dry-run');

const INDIA_COMPARE_RE = /\b(biryani|chai|EMI|Spotify|Netflix|petrol|samosa|litre|liter|movie.?ticket|PVR|butter.?chicken|Swiggy|Zomato|iPhone|months? of|weeks? of|auto.?rickshaw|pizza|pizzas|thali|dosa|subscription|streaming|Jio|Airtel|OTT|paneer|vada|rickshaw|salary|rent)\b/i;
const INDIA_STORE_RE   = /\b(Toycra|MyBrickHouse|Jaiman|import.?only)\b/i;

function gate2Fail(draft) {
  const body = draft.draft_body || '';
  const markerIdx = body.indexOf('<!-- INDIA_PARAGRAPH -->');
  if (markerIdx === -1) return 'marker missing';
  const seg = body.slice(markerIdx);
  if (!INDIA_STORE_RE.test(seg))     return 'no store mention';
  if (!/₹[\d,]+/.test(seg) && draft.draft_verdict !== null) return 'no INR price';
  if (!INDIA_COMPARE_RE.test(seg) && draft.draft_verdict !== null) return 'no Indian comparison';
  return null;
}

// Fetch all status='draft' rows that have a body — paginate to get all
const PAGE = 100;
let offset = 0;
const allDrafts = [];
while (true) {
  const { data, error } = await sb
    .from('pending_drafts')
    .select('id, draft_title, draft_body, draft_verdict, draft_format')
    .eq('status', 'draft')
    .not('draft_body', 'is', null)
    .order('updated_at', { ascending: false })
    .range(offset, offset + PAGE - 1);
  if (error) { console.error('Fetch error:', error.message); process.exit(1); }
  if (!data || data.length === 0) break;
  allDrafts.push(...data);
  if (data.length < PAGE) break;
  offset += PAGE;
}

console.log(`Fetched ${allDrafts.length} status=draft drafts with bodies\n`);

const toReset = [];
for (const d of allDrafts) {
  const reason = gate2Fail(d);
  if (reason) toReset.push({ id: d.id, title: (d.draft_title || '').slice(0, 65), reason });
}

console.log(`Gate 2 failures: ${toReset.length} of ${allDrafts.length}\n`);
for (const r of toReset) console.log(`  ${r.title}\n    → ${r.reason}`);

if (toReset.length === 0) { console.log('\nNothing to reset.'); process.exit(0); }

if (DRY_RUN) {
  console.log(`\n[DRY RUN] Would reset ${toReset.length} drafts to approved + clear body.`);
  process.exit(0);
}

console.log(`\nResetting ${toReset.length} drafts → status=approved, draft_body=NULL …`);
const ids = toReset.map(r => r.id);
const { error: updateErr } = await sb
  .from('pending_drafts')
  .update({ status: 'approved', draft_body: null })
  .in('id', ids);

if (updateErr) { console.error('Update error:', updateErr.message); process.exit(1); }
console.log(`Done. ${toReset.length} drafts cleared and back in generate queue.`);
