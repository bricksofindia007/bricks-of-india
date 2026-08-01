/**
 * Catalogue Health Audit — DB checks (row counts, price/image coverage,
 * scraper staleness). Live-endpoint checks stay inline in the workflow.
 *
 * Run: npx tsx scripts/catalogue-audit.ts
 * Wired into: .github/workflows/catalogue-audit.yml (weekly, Mon 03:30 UTC).
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '../src/lib/get-secret';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = getSecret('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('::error::NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function audit() {
  const failures: string[] = [];

  // 1. Total row count (threshold 8,000 — ~26k Rebrickable entries dedup to ~10k unique set_numbers)
  const { count: totalRows } = await sb.from('sets').select('*', { count: 'exact', head: true });
  console.log('sets total rows:', totalRows);
  if (!totalRows || totalRows < 8000) failures.push('sets row count ' + totalRows + ' < 8,000');

  // 2. Rows with lego_mrp_inr
  const { count: scopedRows } = await sb.from('sets').select('*', { count: 'exact', head: true }).gte('year', 2020);
  const { count: pricedRows } = await sb
    .from('sets')
    .select('*', { count: 'exact', head: true })
    .gte('year', 2020)
    .not('lego_mrp_inr', 'is', null);
  const pricePct = scopedRows ? Math.round(((pricedRows ?? 0) / scopedRows) * 100) : 0;
  console.log('sets with lego_mrp_inr:', pricedRows, '(' + pricePct + '%)');
  if (pricePct < 45) failures.push('only ' + pricePct + '% of 2020+ sets have lego_mrp_inr (threshold: 45%)');

  // 3. Rows with image_url
  const { count: imageRows } = await sb.from('sets').select('*', { count: 'exact', head: true }).not('image_url', 'is', null);
  const imgPct = totalRows ? Math.round(((imageRows ?? 0) / totalRows) * 100) : 0;
  console.log('sets with image_url:', imageRows, '(' + imgPct + '%)');
  if (imgPct < 80) failures.push('only ' + imgPct + '% of sets have image_url (threshold: 80%)');

  // 4. Scraper staleness: each store in store_prices
  const { data: prices } = await sb.from('store_prices').select('store_id, scraped_at').order('scraped_at', { ascending: false });
  const byStore: Record<string, string> = {};
  for (const p of prices ?? []) {
    if (!byStore[p.store_id]) byStore[p.store_id] = p.scraped_at;
  }
  for (const [store, latest] of Object.entries(byStore)) {
    const days = (Date.now() - new Date(latest).getTime()) / 86400000;
    console.log('store_prices', store, 'last scraped:', latest, '(' + days.toFixed(1) + 'd ago)');
    if (days > 8) failures.push('scraper stale: ' + store + ' last ran ' + days.toFixed(1) + 'd ago (threshold: 8d)');
  }

  if (failures.length > 0) {
    console.error('FAILURES:', failures.join('; '));
    process.exit(1);
  }
  console.log('All DB checks passed.');
}

audit().catch((e) => {
  console.error(e);
  process.exit(1);
});
