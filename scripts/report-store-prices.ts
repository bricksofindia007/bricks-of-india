/**
 * Post-scrape row-count report for store_prices / price_history.
 *
 * Run: npx tsx scripts/report-store-prices.ts
 * Wired into: .github/workflows/scrape-prices.yml (final step, always() runs).
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

async function report() {
  const { count: spCount } = await sb.from('store_prices').select('*', { count: 'exact', head: true });
  const { count: phCount } = await sb.from('price_history').select('*', { count: 'exact', head: true });
  console.log('store_prices rows:', spCount);
  console.log('price_history rows:', phCount);

  const { data } = await sb.from('store_prices').select('store_id').order('store_id');
  const byStore: Record<string, number> = {};
  for (const r of data ?? []) byStore[r.store_id] = (byStore[r.store_id] ?? 0) + 1;
  console.log('By store:', JSON.stringify(byStore));
}

report().catch((e) => {
  console.error(e);
  process.exit(1);
});
