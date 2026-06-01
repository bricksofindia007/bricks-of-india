/**
 * Script A — Backfill: replace editorial CDN hero images with Rebrickable equivalents.
 *
 * Problem: 27 news_articles have hero_image URLs from editorial CDNs
 * (Brothers Brick, New Elementary/Squarespace, Jay's Brick Blog, Flickr)
 * that use hotlink protection or are unreliable in headless renderers.
 *
 * Fix per article:
 *   1. Extract set number from slug or title
 *   2. If found → Rebrickable API → set_img_url
 *   3. If not found → null (ArticleCard shows generic fallback — acceptable for MOC content)
 *   4. HEAD-verify new URL before saving
 *   5. Deduplicate: skip if another article already uses that image
 *
 * Run: node --env-file=.env.local scripts/fix-editorial-hero-images.mjs
 * Dry run: node --env-file=.env.local scripts/fix-editorial-hero-images.mjs --dry-run
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

const DRY_RUN = process.argv.includes('--dry-run');

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const UA = 'BricksOfIndia-Fix/1.0 (+https://bricksofindia.com)';
const REBRICKABLE_KEY = process.env.REBRICKABLE_API_KEY;

const EDITORIAL_CDN_DOMAINS = new Set([
  'static1.squarespace.com',
  'media-cdn.brothers-brick.com',
  'live.staticflickr.com',
  'jaysbrickblog.com',
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractSetNumbers(slug, title) {
  const combined = `${slug} ${title ?? ''}`;
  const seen = new Set();
  const nums = [];
  const re = /\b(\d{4,6})\b/g;
  let m;
  while ((m = re.exec(combined)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); nums.push(m[1]); }
  }
  return nums;
}

async function tryRebrickableSet(setNum) {
  try {
    const headers = { 'User-Agent': UA };
    if (REBRICKABLE_KEY) headers.Authorization = `key ${REBRICKABLE_KEY}`;
    const res = await fetch(`https://rebrickable.com/api/v3/lego/sets/${setNum}-1/`, {
      headers,
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.set_img_url ?? null;
  } catch { return null; }
}

async function headOk(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000), headers: { 'User-Agent': UA } });
    return res.ok;
  } catch { return false; }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`━━ fix-editorial-hero-images${DRY_RUN ? ' [DRY RUN]' : ''} ━━━━━━━━━━━━━━━━━━━━━━━━`);

// Fetch all articles with editorial CDN hero images
const { data: all, error } = await sb
  .from('news_articles')
  .select('id, slug, title, hero_image')
  .not('hero_image', 'is', null);

if (error) { console.error('Fetch error:', error.message); process.exit(1); }

const atRisk = (all ?? []).filter(r => {
  try { return EDITORIAL_CDN_DOMAINS.has(new URL(r.hero_image).hostname); }
  catch { return false; }
});

console.log(`At-risk articles: ${atRisk.length}\n`);

// Build set of already-used hero images (for dedup)
const { data: usedImgRows } = await sb.from('news_articles').select('hero_image').not('hero_image', 'is', null);
const usedImages = new Set((usedImgRows ?? []).map(r => r.hero_image).filter(Boolean));

let replaced = 0, nulled = 0, skipped = 0;

for (const article of atRisk) {
  const label = article.slug.slice(0, 55);
  const oldDomain = new URL(article.hero_image).hostname;
  process.stdout.write(`  [${oldDomain}] ${label}… `);

  const setNums = extractSetNumbers(article.slug, article.title);
  let newImage = null;

  // Try Rebrickable for each set number
  for (const num of setNums.slice(0, 5)) {
    const img = await tryRebrickableSet(num);
    if (!img) continue;
    if (usedImages.has(img)) {
      console.log(`\n    skip-dedup: ${num} → ${img.slice(0, 50)} already used`);
      continue;
    }
    const ok = await headOk(img);
    if (!ok) { console.log(`\n    head-fail: ${img.slice(0, 50)}`); continue; }
    newImage = img;
    break;
  }

  if (newImage) {
    console.log(`→ Rebrickable (${newImage.slice(0, 60)})`);
    if (!DRY_RUN) {
      const { error: upErr } = await sb.from('news_articles').update({ hero_image: newImage }).eq('id', article.id);
      if (upErr) { console.log(`    FAIL: ${upErr.message}`); skipped++; continue; }
      usedImages.add(newImage); // prevent sibling articles from picking same image
      usedImages.delete(article.hero_image);
    }
    replaced++;
  } else {
    // No set number found or no Rebrickable image available → null (MOC/community content)
    console.log(`→ null (MOC/community — no set number; generic fallback will render)`);
    if (!DRY_RUN) {
      const { error: upErr } = await sb.from('news_articles').update({ hero_image: null }).eq('id', article.id);
      if (upErr) { console.log(`    FAIL: ${upErr.message}`); skipped++; continue; }
    }
    nulled++;
  }

  // Brief pause to avoid Rebrickable rate limit
  await new Promise(r => setTimeout(r, 600));
}

console.log(`\n━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Replaced with Rebrickable: ${replaced}`);
console.log(`Set to null (MOC/community): ${nulled}`);
console.log(`Errors/skipped: ${skipped}`);
if (DRY_RUN) console.log('(dry run — no DB writes)');
