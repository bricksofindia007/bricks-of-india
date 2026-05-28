/**
 * Strips <!-- ... --> HTML comments and bare "THE XYZ" heading lines from
 * all content rows in news_articles, reviews, and blog_posts.
 * Safe to re-run: idempotent (only updates rows that actually change).
 */
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
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  }
} catch {}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function cleanBody(content) {
  return content
    // Remove all HTML comments (<!-- ... -->), including <!-- INDIA_PARAGRAPH -->
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove bare "THE SOMETHING" heading lines (all-caps section markers)
    .replace(/^THE [A-Z\s]+$/gm, '')
    // Collapse 3+ consecutive blank lines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const TABLES = [
  { name: 'news_articles', bodyCol: 'content' },
  { name: 'reviews',       bodyCol: 'content' },
  { name: 'blog_posts',    bodyCol: 'content' },
];

let totalFixed = 0;

for (const { name, bodyCol } of TABLES) {
  // Fetch rows that contain HTML comments
  const { data, error } = await sb
    .from(name)
    .select(`id, slug, ${bodyCol}`)
    .like(bodyCol, '%<!--%');

  if (error) { console.error(`[${name}] query error:`, error.message); continue; }
  if (!data?.length) { console.log(`[${name}] 0 rows with HTML comments — clean`); continue; }

  console.log(`[${name}] ${data.length} row(s) with HTML comments:`);

  for (const row of data) {
    const original = row[bodyCol];
    const cleaned  = cleanBody(original);
    if (cleaned === original) { console.log(`  ${row.slug}: no change after clean`); continue; }

    const { error: upErr } = await sb
      .from(name)
      .update({ [bodyCol]: cleaned })
      .eq('id', row.id);

    if (upErr) {
      console.error(`  ${row.slug}: UPDATE FAILED — ${upErr.message}`);
    } else {
      const removed = (original.match(/<!--[\s\S]*?-->/g) ?? []).map(m => m.slice(0, 60));
      console.log(`  ${row.slug}: cleaned — removed: ${JSON.stringify(removed)}`);
      totalFixed++;
    }
  }
}

console.log(`\nDone. ${totalFixed} row(s) updated.`);

// Verify: re-query to confirm zero remain
console.log('\nVerification:');
for (const { name, bodyCol } of TABLES) {
  const { count } = await sb.from(name).select('*', { count: 'exact', head: true }).like(bodyCol, '%<!--%');
  console.log(`  ${name}: ${count ?? 0} rows with HTML comments remaining`);
}
