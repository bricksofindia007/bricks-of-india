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
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  }
} catch {}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 1. All store_prices rows for 10326 (any format)
const { data: sp, error: spErr } = await sb
  .from('store_prices')
  .select('*')
  .or('set_id.eq.10326,set_id.eq.10326-1,set_id.ilike.%10326%');
console.log('=== store_prices (10326 any format) ===');
if (spErr) console.error(spErr.message);
else console.log(JSON.stringify(sp, null, 2));

// 2. sets table — how is 10326 stored?
const { data: sets, error: setsErr } = await sb
  .from('sets')
  .select('set_number, name, lego_mrp_inr, theme')
  .ilike('set_number', '%10326%');
console.log('\n=== sets (10326 any format) ===');
if (setsErr) console.error(setsErr.message);
else console.log(JSON.stringify(sets, null, 2));

// 3. store_prices for mybrickhouse generally — sample to see set_id format
const { data: mbh, error: mbhErr } = await sb
  .from('store_prices')
  .select('set_id, store_id, price_inr, in_stock, scraped_at')
  .eq('store_id', 'mybrickhouse')
  .order('scraped_at', { ascending: false })
  .limit(20);
console.log('\n=== mybrickhouse recent store_prices (set_id format sample) ===');
if (mbhErr) console.error(mbhErr.message);
else console.log(JSON.stringify(mbh, null, 2));

// 4. Total mybrickhouse rows
const { count } = await sb
  .from('store_prices')
  .select('*', { count: 'exact', head: true })
  .eq('store_id', 'mybrickhouse');
console.log('\n=== mybrickhouse total row count ===', count);
