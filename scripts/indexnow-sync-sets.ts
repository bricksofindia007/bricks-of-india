/**
 * Ongoing IndexNow sync for sets -- the ongoing replacement for "ping on
 * sitemap change." Classification itself is DB-enforced (see migration
 * 20260727000000_index_tier_classification.sql, triggers on sets and
 * store_prices), so rather than hooking every individual writer to
 * `sets`, this reads DB state directly: any tier1/tier2 set that's new or
 * has changed since its last IndexNow submission gets (re-)submitted,
 * scoped to actual changed URLs, not the whole sitemap.
 *
 * Reads only the columns the ping needs, and only never-sent sets plus
 * sets changed in the last day (see scripts/lib/indexnow-pending.ts).
 * Exits non-zero if it crashes, so a broken run is visible.
 *
 * Run: npx tsx scripts/indexnow-sync-sets.ts
 * Wired into: .github/workflows/scrape-prices.yml (every 6h -- runs
 * right after the price scraper, which is what actually drives most
 * tier1 transitions via the store_prices trigger).
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '../src/lib/get-secret';
import { submitToIndexNow } from '../src/lib/indexnow';
import { slugify } from '../src/lib/utils';
import { PING_COLUMNS, PING_TIERS, changedSince, pendingFromRows, type PingRow } from './lib/indexnow-pending';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = getSecret('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('::error::NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Pages through one query. Stable order, so pages do not overlap or skip.
async function readAll(build: () => any): Promise<PingRow[]> {
  const PAGE = 1000;
  const rows: PingRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await build().range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as PingRow[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

async function main() {
  const since = changedSince(Date.now());
  // 1. Never sent.
  const neverSent = await readAll(() => sb
    .from('sets').select(PING_COLUMNS)
    .in('index_tier', [...PING_TIERS])
    .is('indexnow_submitted_at', null)
    .order('set_number'));
  // 2. Sent before, and changed in the last day (the comparison with the last send is made in code).
  const changed = await readAll(() => sb
    .from('sets').select(PING_COLUMNS)
    .in('index_tier', [...PING_TIERS])
    .not('indexnow_submitted_at', 'is', null)
    .gte('updated_at', since)
    .order('set_number'));
  console.log(`[IndexNow] read ${neverSent.length} never-sent and ${changed.length} recently changed tier1/tier2 set row(s).`);

  const pending = pendingFromRows([...neverSent, ...changed]);
  if (pending.length === 0) {
    console.log('[IndexNow] no new/changed tier1/tier2 sets since last sync.');
    return;
  }

  const urls = pending.map((s) => `https://bricksofindia.com/sets/${s.set_number}-${slugify(s.name)}`);
  console.log(`[IndexNow] submitting ${urls.length} new/changed set URL(s)...`);
  const results = await submitToIndexNow(urls);
  const allOk = results.every((r) => r.ok);

  if (allOk) {
    const now = new Date().toISOString();
    const setNumbers = pending.map((s) => s.set_number);
    const { error: updateErr } = await sb.from('sets').update({ indexnow_submitted_at: now }).in('set_number', setNumbers);
    if (updateErr) throw updateErr;
    console.log(`[IndexNow] marked ${setNumbers.length} set(s) as submitted at ${now}.`);
  } else {
    console.log('[IndexNow] submission had at least one non-ok chunk -- not marking sets as submitted, will retry next run.');
  }
}

main().catch((err) => {
  // A crash fails this step, so a broken run shows up in the workflow.
  console.error('[IndexNow] sync-sets crashed:', err);
  process.exit(1);
});
