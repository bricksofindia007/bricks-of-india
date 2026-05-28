import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const raw = readFileSync('.env.local', 'utf-8');
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq < 0) continue;
  const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
  if (k && !process.env[k]) process.env[k] = v;
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await sb.from('store_prices').select('store_id,price_inr,in_stock,scraped_at').eq('set_id', '10326');
console.log(JSON.stringify(data, null, 2));
