import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data } = await sb
  .from('reviews')
  .select('id, content')
  .eq('id', '70db543d-ae1e-42c9-849b-b105c4ae15c5')
  .single();

// Print every sentence / paragraph containing ₹
const paras = data.content.split('\n');
for (const p of paras) {
  if (p.includes('₹')) console.log(p);
}
