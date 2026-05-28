import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Try without -1 suffix
for (const num of ['10326-1', '10326']) {
  const { data: sp } = await sb.from('store_prices').select('store_id, price_inr, in_stock, set_id').ilike('set_id', `%10326%`).limit(5);
  if (sp?.length) { console.log('store_prices matches for 10326:', JSON.stringify(sp, null, 2)); break; }
}

const { data: sets } = await sb.from('sets').select('set_number, name, lego_mrp_inr').ilike('set_number', '%10326%').limit(5);
console.log('sets matches:', JSON.stringify(sets, null, 2));
