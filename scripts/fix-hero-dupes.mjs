import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

console.log('── PART A: retroactive hero image dedup ──────────────────────');

// Group 1: 60422-1.jpg — null out 3 less-specific articles
const group1 = [
  'f9c023c9-c3a3-408b-a836-03c639a44485',
  '0452418c-2c0f-44d5-a98a-d350f2b7601a',
  '7b618b3f-51fd-4b41-a688-c6411e340eb0',
];
const { error: e1 } = await sb
  .from('news_articles')
  .update({ hero_image: null })
  .in('id', group1);
if (e1) { console.error('Group 1 failed:', e1.message); process.exit(1); }
console.log(`Group 1 (60422-1.jpg): nulled ${group1.length} rows ✓`);

// Group 2: 10317-1.jpg — null out "Price Changes" article
const { error: e2 } = await sb
  .from('news_articles')
  .update({ hero_image: null })
  .eq('id', '77cdac0c-6022-4724-8235-ad1bbe42d1ea');
if (e2) { console.error('Group 2 failed:', e2.message); process.exit(1); }
console.log('Group 2 (10317-1.jpg): nulled 1 row ✓');

// Group 3: 76919-1.jpg — null out "Speed Champions" article
const { error: e3 } = await sb
  .from('news_articles')
  .update({ hero_image: null })
  .eq('id', 'c7adfb71-e733-4eeb-9689-774511952cd8');
if (e3) { console.error('Group 3 failed:', e3.message); process.exit(1); }
console.log('Group 3 (76919-1.jpg): nulled 1 row ✓');

// Verification — should return 0 groups
console.log('\n── Verification query ────────────────────────────────────────');
const { data: all } = await sb
  .from('news_articles')
  .select('hero_image')
  .not('hero_image', 'is', null);

const counts = new Map();
for (const r of all ?? []) {
  counts.set(r.hero_image, (counts.get(r.hero_image) ?? 0) + 1);
}
const remaining = [...counts.entries()].filter(([, n]) => n > 1);

if (remaining.length === 0) {
  console.log('✓ 0 duplicate hero_image groups remaining — clean.');
} else {
  console.error(`✗ ${remaining.length} duplicate group(s) still present:`);
  for (const [url, n] of remaining) {
    console.error(`  count=${n}  ${url.slice(0, 80)}`);
  }
  process.exit(1);
}
