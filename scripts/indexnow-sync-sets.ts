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
import { isPending, chunk, MAX_URLS_PER_REQUEST, UPDATE_BATCH } from './lib/indexnow-pending';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = getSecret('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('::error::NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type SetRow = {
  set_number: string;
  name: string;
  updated_at: string | null;
  indexnow_submitted_at: string | null;
};

async function main() {
  // Only the four columns the job needs. Ordered so pages are stable.
  const PAGE = 1000;
  const rows: SetRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb
      .from('sets')
      .select('set_number, name, updated_at, indexnow_submitted_at')
      .in('index_tier', ['tier1', 'tier2'])
      .order('set_number', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }

  const pending = rows.filter(isPending);
  console.log(`[IndexNow] tier1/tier2 sets read: ${rows.length}; pending: ${pending.length}.`);
  if (pending.length === 0) {
    console.log('[IndexNow] no new/changed tier1/tier2 sets since last sync.');
    return;
  }

  let submitted = 0;
  let marked = 0;
  let notSubmitted = 0;
  for (const part of chunk(pending, MAX_URLS_PER_REQUEST)) {
    const urls = part.map((s) => `https://bricksofindia.com/sets/${s.set_number}-${slugify(s.name)}`);
    console.log(`[IndexNow] submitting ${urls.length} set URL(s)...`);
    const results = await submitToIndexNow(urls);
    if (!results.every((r) => r.ok)) {
      // Not marked, so the next run retries these sets.
      notSubmitted += urls.length;
      console.log(`[IndexNow] ${urls.length} URL(s) NOT submitted (non-ok response); will retry next run.`);
      continue;
    }
    submitted += urls.length;
    const now = new Date().toISOString();
    for (const batch of chunk(part, UPDATE_BATCH)) {
      const { error: updateErr } = await sb
        .from('sets')
        .update({ indexnow_submitted_at: now })
        .in('set_number', batch.map((s) => s.set_number));
      if (updateErr) throw updateErr;
      marked += batch.length;
    }
  }
  console.log(`[IndexNow] done: submitted ${submitted}, marked ${marked}, not submitted ${notSubmitted}.`);
}

main().catch((err) => {
  // Still non-fatal to the scrape job (it runs after the price write).
  // The line below names the failure so it is visible in the run log.
  console.error('[IndexNow] sync-sets FAILED, NO set URLs submitted this run (non-fatal to the job):', err);
});
