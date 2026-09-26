/**
 * Post-scrape staleness check (PR-A, 2026-09-26). Exits 1 -- which makes
 * scrape-prices.yml send its failure email via workflow-failure-notify.mjs,
 * the same alert path retention-cleanup.yml uses (#192) -- when either:
 *   - a tracked store's newest scraped_at is older than PRICE_STALE_HOURS
 *     (the scraper ran but wrote nothing for that store, twice in a row), or
 *   - under 80% of a store's in-stock rows are fresher than PRICE_STALE_HOURS.
 * The site stops badging rows past PRICE_STALE_HOURS, so this is the
 * threshold at which visitors start seeing the effect. The "scraper didn't
 * run at all" case is health-check.mjs Check 5 (nightly, 7h).
 *
 * Run: npx tsx scripts/check-price-freshness.ts
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '../src/lib/get-secret';
import { PRICE_STALE_HOURS } from '../src/lib/price-freshness';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = getSecret('SUPABASE_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('::error::NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const STORES = ['mybrickhouse', 'toycra'];
const MIN_FRESH_SHARE = 0.8;

async function main() {
  const cutoff = new Date(Date.now() - PRICE_STALE_HOURS * 3_600_000).toISOString();
  const problems: string[] = [];
  for (const store of STORES) {
    const { data: newest, error } = await sb.from('store_prices').select('scraped_at')
      .eq('store_id', store).order('scraped_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    const ageH = newest ? (Date.now() - new Date(newest.scraped_at).getTime()) / 3_600_000 : Infinity;
    const [{ count: inStock }, { count: fresh }] = await Promise.all([
      sb.from('store_prices').select('*', { count: 'exact', head: true }).eq('store_id', store).eq('in_stock', true),
      sb.from('store_prices').select('*', { count: 'exact', head: true }).eq('store_id', store).eq('in_stock', true).gte('scraped_at', cutoff),
    ]);
    const share = inStock ? (fresh ?? 0) / inStock : 0;
    console.log(`[freshness] ${store}: newest ${ageH.toFixed(1)}h old; in-stock fresh ${fresh}/${inStock} (${(share * 100).toFixed(0)}%) within ${PRICE_STALE_HOURS}h`);
    if (ageH > PRICE_STALE_HOURS) problems.push(`${store}: newest price is ${ageH.toFixed(1)}h old (limit ${PRICE_STALE_HOURS}h)`);
    else if (share < MIN_FRESH_SHARE) problems.push(`${store}: only ${(share * 100).toFixed(0)}% of in-stock rows scraped within ${PRICE_STALE_HOURS}h`);
  }
  if (problems.length) {
    for (const p of problems) console.error(`::error::${p}`);
    process.exit(1);
  }
  console.log('[freshness] OK');
}
main().catch((e) => { console.error('::error::freshness check failed to run:', e.message ?? e); process.exit(1); });
