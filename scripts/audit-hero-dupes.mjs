import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Fetch all news_articles with hero_image, then group in memory
const { data: articles, error } = await sb
  .from('news_articles')
  .select('id, title, hero_image, published_at')
  .not('hero_image', 'is', null)
  .order('published_at', { ascending: false });

if (error) { console.error('Query error:', error.message); process.exit(1); }

// Group by hero_image URL
const byImage = new Map();
for (const a of articles ?? []) {
  const key = a.hero_image;
  if (!byImage.has(key)) byImage.set(key, []);
  byImage.get(key).push(a);
}

const dupes = [...byImage.entries()]
  .filter(([, rows]) => rows.length > 1)
  .sort((a, b) => b[1].length - a[1].length);

console.log(`\nTotal news_articles with hero_image: ${articles?.length ?? 0}`);
console.log(`Unique hero_image URLs: ${byImage.size}`);
console.log(`Duplicate groups (same URL on 2+ articles): ${dupes.length}\n`);

if (dupes.length === 0) {
  console.log('No duplicates found.');
} else {
  for (const [url, rows] of dupes) {
    console.log(`──────────────────────────────────────────────────────`);
    console.log(`Count: ${rows.length}  |  URL: ${url.slice(0, 90)}${url.length > 90 ? '...' : ''}`);
    for (const r of rows) {
      console.log(`  [${r.id}] ${r.title?.slice(0, 70) ?? '(no title)'}`);
    }
  }
  console.log(`──────────────────────────────────────────────────────`);
  console.log(`\nSummary: ${dupes.length} images shared across ${dupes.reduce((n,[,r])=>n+r.length,0)} articles`);
}
