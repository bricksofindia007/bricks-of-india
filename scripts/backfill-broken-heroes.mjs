/**
 * backfill-broken-heroes.mjs
 *
 * Identifies news_articles/blog_posts rows where hero_image currently returns
 * non-200 on a sequential HEAD probe, then re-runs the Rebrickable resolution
 * chain to rescue what it can. Unrescuable rows get '/fallback-hero.png'.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-broken-heroes.mjs          # dry run
 *   node --env-file=.env.local scripts/backfill-broken-heroes.mjs --apply  # write to DB
 */

import { createClient } from '@supabase/supabase-js';

const APPLY        = process.argv.includes('--apply');
const HERO_FALLBACK = '/fallback-hero.png';
const UA = 'BricksOfIndia-RadarBot/1.0 (+https://bricksofindia.com)';
const PROBE_TIMEOUT = 8000;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function resolveHeroImage(title, body) {
  const rbKey  = process.env.REBRICKABLE_API_KEY;
  const rbHdrs = { 'User-Agent': UA, ...(rbKey ? { Authorization: `key ${rbKey}` } : {}) };
  const combined = `${title ?? ''} ${body ?? ''}`;

  // Step 1: extract up to 5 set numbers → try each on Rebrickable
  const seen = new Set();
  const setNums = [];
  const re = /\b(\d{4,6})\b/g;
  let m;
  while ((m = re.exec(combined)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); setNums.push(m[1]); }
  }
  for (const num of setNums.slice(0, 5)) {
    try {
      const res = await fetch(
        `https://rebrickable.com/api/v3/lego/sets/${num}-1/`,
        { headers: rbHdrs, signal: AbortSignal.timeout(5000) },
      );
      if (res.ok) {
        const data = await res.json();
        if (data.set_img_url) return data.set_img_url;
      }
    } catch { /* try next */ }
  }

  // Step 2: no set number matched — return null
  return null;
}

async function probeUrl(url) {
  if (!url || url.startsWith('/')) return 200; // local asset, skip
  try {
    const r = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(PROBE_TIMEOUT) });
    return r.status;
  } catch { return 0; }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n━━ backfill-broken-heroes${APPLY ? ' [APPLY]' : ' [DRY RUN]'} ━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

// Load all articles that have a non-local hero_image
const tables = [
  { name: 'news_articles', imgCol: 'hero_image' },
  { name: 'blog_posts',    imgCol: 'hero_image' },
];

const articles = [];
for (const { name, imgCol } of tables) {
  const { data } = await sb.from(name).select(`id, slug, title, content, ${imgCol}`).not(imgCol, 'is', null);
  for (const r of (data || [])) {
    const url = r[imgCol];
    if (url && !url.startsWith('/')) articles.push({ table: name, id: r.id, slug: r.slug, title: r.title, content: r.content, hero_image: url });
  }
}

// Deduplicate URLs to probe — probe each URL once sequentially
const uniqueUrls = [...new Set(articles.map(a => a.hero_image))];
console.log(`Loaded ${articles.length} articles across ${tables.length} tables`);
console.log(`Probing ${uniqueUrls.length} unique hero_image URLs sequentially (${PROBE_TIMEOUT}ms timeout)…\n`);

const urlStatus = {};
for (const url of uniqueUrls) {
  const status = await probeUrl(url);
  urlStatus[url] = status;
  if (status !== 200) console.log(`  [${status || 'TIMEOUT'}] ${url.slice(0, 90)}`);
}

const brokenArticles = articles.filter(a => urlStatus[a.hero_image] !== 200);
const okCount = articles.length - brokenArticles.length;
console.log(`\nProbe complete: ${okCount} OK, ${brokenArticles.length} broken/timeout\n`);

if (brokenArticles.length === 0) {
  console.log('Nothing broken — done.');
  process.exit(0);
}

// Run resolution chain for each broken article
let rescueCount = 0, fallbackCount = 0, updatedCount = 0;
const rescued = [], needsFallback = [];

for (const art of brokenArticles) {
  process.stdout.write(`  Resolving ${art.slug.slice(0, 55)}… `);
  const resolved = await resolveHeroImage(art.title, art.content);
  if (resolved) {
    rescueCount++;
    rescued.push({ ...art, newUrl: resolved });
    console.log(`RESCUE → ${resolved.slice(0, 70)}`);
  } else {
    fallbackCount++;
    needsFallback.push(art);
    console.log(`NEEDS-FALLBACK (→ ${HERO_FALLBACK})`);
  }
}

console.log(`\n${'─'.repeat(70)}`);
console.log(`KEEP-AS-IS: ${okCount} (probe returned 200 — no action needed)`);
console.log(`RESCUE:     ${rescueCount}`);
console.log(`NEEDS-FALLBACK: ${fallbackCount}`);
console.log(`Total broken scanned: ${brokenArticles.length}`);

if (APPLY) {
  console.log('\nApplying updates…');
  for (const { table, id, slug, newUrl } of rescued) {
    const { error } = await sb.from(table).update({ hero_image: newUrl }).eq('id', id);
    if (error) console.log(`  ✗ ${slug}: ${error.message}`);
    else { updatedCount++; console.log(`  ✓ RESCUE  ${slug}`); }
  }
  for (const { table, id, slug } of needsFallback) {
    const { error } = await sb.from(table).update({ hero_image: HERO_FALLBACK }).eq('id', id);
    if (error) console.log(`  ✗ ${slug}: ${error.message}`);
    else { updatedCount++; console.log(`  ✓ FALLBACK ${slug}`); }
  }
  console.log(`\nUpdated ${updatedCount} rows.`);
}
