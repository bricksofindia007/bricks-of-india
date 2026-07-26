/**
 * Ongoing IndexNow sync for sets -- the ongoing replacement for "ping on
 * sitemap change." Classification itself is DB-enforced (see migration
 * 20260727000000_index_tier_classification.sql, triggers on sets and
 * store_prices), so rather than hooking every individual writer to
 * `sets` (generate-approved-drafts.ts, radar-08-reviews.js,
 * scrape-now.mjs, sync-rebrickable.js -- 4+ separate scripts), this
 * reads DB state directly: any tier1/tier2 set that's new or has
 * changed since its last IndexNow submission gets (re-)submitted, scoped
 * to actual changed URLs, not the whole sitemap.
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

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = getSecret('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('::error::NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function main() {
  const PAGE = 1000;
  const pending: { set_number: string; name: string }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb
      .from('sets')
      .select('set_number, name, updated_at, indexnow_submitted_at')
      .in('index_tier', ['tier1', 'tier2'])
      .or('indexnow_submitted_at.is.null,updated_at.gt.indexnow_submitted_at')
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    pending.push(...data);
    if (data.length < PAGE) break;
  }

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
  // Never fail the workflow over this -- matches the old ping's
  // continue-on-error intent, just enforced in the script itself since
  // this runs as one step among several in scrape-prices.yml.
  console.error('[IndexNow] sync-sets crashed (non-fatal):', err);
});
