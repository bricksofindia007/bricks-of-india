/**
 * Fix #1 — Pre-populate draft_title from source_title for approved drafts.
 * 251 approved drafts have null draft_title. The generator reads source_title
 * anyway, but Check 19 in technical-hygiene flags the null. This one-shot
 * script copies source_title → draft_title so the hygiene check passes.
 *
 * Run: node --env-file=.env.local scripts/fix-null-draft-titles.mjs
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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data, error } = await sb
  .from('pending_drafts')
  .select('id, source_title')
  .eq('status', 'approved')
  .is('draft_title', null)
  .not('source_title', 'is', null);

if (error) { console.error('Fetch error:', error.message); process.exit(1); }
console.log(`Found ${(data ?? []).length} approved drafts with null draft_title`);

let ok = 0, skipped = 0;
for (const row of data ?? []) {
  if (!row.source_title?.trim()) { skipped++; continue; }
  const { error: upErr } = await sb
    .from('pending_drafts')
    .update({ draft_title: row.source_title.slice(0, 200) })
    .eq('id', row.id);
  if (upErr) { console.error(`  FAIL ${row.id}: ${upErr.message}`); }
  else ok++;
}

console.log(`Done: ${ok} updated, ${skipped} skipped (null source_title)`);
