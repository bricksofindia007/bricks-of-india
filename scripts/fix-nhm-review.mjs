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

// Find the NHM review
const { data, error } = await sb
  .from('reviews')
  .select('id, title, content, slug')
  .or('slug.ilike.%10326%,title.ilike.%natural history%')
  .maybeSingle();

if (error) { console.error('Query error:', error.message); process.exit(1); }
if (!data) { console.log('NHM review not found in reviews table'); process.exit(0); }

console.log('Found review:', data.id, '|', data.title);
console.log('Slug:', data.slug);

// Show all ₹ mentions in current content
const prices = [...data.content.matchAll(/₹[\d,]+/g)].map(m => m[0]);
console.log('\nCurrent ₹ mentions:', prices);

// Show the India paragraph section
const lines = data.content.split('\n');
const indiaStart = lines.findIndex(l => l.includes('INDIA_PARAGRAPH') || l.includes('India') || l.includes('₹'));
const indiaSection = lines.slice(Math.max(0, indiaStart - 2), indiaStart + 15);
console.log('\n--- India section context ---');
indiaSection.forEach((l, i) => console.log(`${indiaStart - 2 + i}: ${l}`));

// Print full content for inspection
console.log('\n--- FULL CONTENT ---');
console.log(data.content);
