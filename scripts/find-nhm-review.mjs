import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb
  .from('news_articles')
  .select('id, title, content')
  .ilike('title', '%natural history%')
  .maybeSingle();

if (error) { console.error(error.message); process.exit(1); }
if (!data) { console.log('Not found in news_articles — trying reviews table...'); }
else {
  console.log('FOUND IN news_articles:');
  console.log('ID:', data.id);
  console.log('Title:', data.title);
  // Find ₹ prices in content
  const prices = [...data.content.matchAll(/₹[\d,]+/g)].map(m => m[0]);
  console.log('₹ mentions:', prices);
}

const { data: r2 } = await sb
  .from('reviews')
  .select('id, title, content')
  .or('title.ilike.%natural history%,slug.ilike.%10326%')
  .maybeSingle();

if (r2) {
  console.log('\nFOUND IN reviews:');
  console.log('ID:', r2.id);
  console.log('Title:', r2.title);
  const prices = [...r2.content.matchAll(/₹[\d,]+/g)].map(m => m[0]);
  console.log('₹ mentions:', prices);
}
