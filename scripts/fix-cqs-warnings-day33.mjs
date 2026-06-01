/**
 * Comprehensive CQS warning fixes — Day 33
 *
 * Part A: Strip "Jaiman Toys" from all news_articles
 *   Jaiman removed from platform 2026-05-31. Articles generated before removal
 *   still mention it. Replacement: remove from three-store lists, leaving
 *   "MyBrickHouse and Toycra". Runs across ALL news_articles (bulk safe).
 *
 * Part B: Fix duplicate hero image on lego-sets-destroy-wallet-2026
 *   Both it and star-wars-lego-will-bankrupt-you use Brickset 75313-1 (AT-AT).
 *   star-wars article keeps it (thematically correct). destroy-wallet gets
 *   replaced with Rebrickable 10366 (Tropical Aquarium — big, expensive, fits).
 *
 * Part C: Append missing signoff to news_articles
 *   "On that bombshell, bubyee." is the BOI voice close. 14+ articles are
 *   missing it (CQS info flag). Append only to articles that end without it
 *   and are in news_articles (blog_posts have varied endings by design).
 *
 * Run: node --env-file=.env.local scripts/fix-cqs-warnings-day33.mjs
 * Dry run: node --env-file=.env.local scripts/fix-cqs-warnings-day33.mjs --dry-run
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

const DRY = process.argv.includes('--dry-run');
const UA  = 'BricksOfIndia-Fix/1.0 (+https://bricksofindia.com)';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function strip(s) { return (s || '').replace(/\s+$/, ''); }

// ── Part A: Jaiman Toys removal ───────────────────────────────────────────────
console.log('\n━━ Part A: Jaiman Toys removal ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Fetch all news_articles that still mention Jaiman
const { data: allArticles, error: fetchErr } = await sb
  .from('news_articles')
  .select('id, slug, content')
  .ilike('content', '%Jaiman%');

if (fetchErr) { console.error('Fetch error:', fetchErr.message); process.exit(1); }

const jaimanArticles = (allArticles ?? []).filter(a => /Jaiman/i.test(a.content));
console.log(`Found ${jaimanArticles.length} articles mentioning Jaiman`);

let jaimanFixed = 0;
for (const a of jaimanArticles) {
  let c = a.content;

  // Pattern 1: "MyBrickHouse, Toycra, and Jaiman Toys" → "MyBrickHouse and Toycra"
  c = c.replace(/MyBrickHouse,\s*Toycra,\s*and\s*Jaiman\s*Toys/gi, 'MyBrickHouse and Toycra');
  // Pattern 2: "Toycra, and Jaiman Toys" → "Toycra" (when MBH not adjacent)
  c = c.replace(/Toycra,\s*and\s*Jaiman\s*Toys/gi, 'Toycra');
  // Pattern 3: "MyBrickHouse and Jaiman Toys" → "MyBrickHouse and Toycra"
  c = c.replace(/MyBrickHouse\s*and\s*Jaiman\s*Toys/gi, 'MyBrickHouse and Toycra');
  // Pattern 4: standalone ", and Jaiman Toys" or "and Jaiman Toys" remaining
  c = c.replace(/,?\s*and\s*Jaiman\s*Toys/gi, '');
  // Pattern 5: bare "Jaiman Toys" (shouldn't remain, but catch-all)
  c = c.replace(/Jaiman\s*Toys/gi, 'Toycra');

  if (c === a.content) {
    console.log(`  SKIP (no change): ${a.slug.slice(0, 55)}`);
    continue;
  }

  const matches = (a.content.match(/Jaiman/gi) ?? []).length;
  console.log(`  ${DRY ? '[DRY] ' : ''}${a.slug.slice(0, 55)} — removed ${matches} Jaiman mention(s)`);

  if (!DRY) {
    const { error } = await sb.from('news_articles').update({ content: c }).eq('id', a.id);
    if (error) console.log(`    FAIL: ${error.message}`);
    else jaimanFixed++;
  } else {
    jaimanFixed++;
  }
}
console.log(`Part A done: ${jaimanFixed} articles updated`);

// ── Part B: Duplicate hero fix ────────────────────────────────────────────────
console.log('\n━━ Part B: Duplicate hero fix ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const DESTROY_SLUG = 'lego-sets-destroy-wallet-2026';
const { data: destroyPost } = await sb.from('blog_posts').select('id, hero_image')
  .eq('slug', DESTROY_SLUG).maybeSingle();

if (!destroyPost) {
  console.log('  lego-sets-destroy-wallet-2026 not found in blog_posts');
} else {
  const DUPLICATE_HERO = 'https://images.brickset.com/sets/images/75313-1.jpg';
  if (destroyPost.hero_image !== DUPLICATE_HERO) {
    console.log(`  Hero is not the duplicate (${(destroyPost.hero_image||'null').slice(0,60)}) — skipping`);
  } else {
    // Fetch Rebrickable image for 10366 (Tropical Aquarium — big, expensive, fits article theme)
    console.log('  Fetching Rebrickable image for 10366 (Tropical Aquarium)...');
    let newHero = null;
    try {
      const rbKey = process.env.REBRICKABLE_API_KEY;
      const headers = { 'User-Agent': UA, ...(rbKey ? { Authorization: `key ${rbKey}` } : {}) };
      const res = await fetch('https://rebrickable.com/api/v3/lego/sets/10366-1/', {
        headers, signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        newHero = data.set_img_url ?? null;
      } else {
        console.log(`  Rebrickable HTTP ${res.status} for 10366 — trying 10698 (Classic Large Creative Box)`);
        const res2 = await fetch('https://rebrickable.com/api/v3/lego/sets/10698-1/', {
          headers, signal: AbortSignal.timeout(8000),
        });
        if (res2.ok) { const d2 = await res2.json(); newHero = d2.set_img_url ?? null; }
      }
    } catch (e) {
      console.log(`  Rebrickable fetch error: ${e.message}`);
    }

    if (!newHero) {
      console.log('  No Rebrickable image resolved — setting hero to null (generic fallback)');
      newHero = null;
    } else {
      console.log(`  New hero: ${newHero.slice(0, 70)}`);
    }

    if (!DRY) {
      const { error } = await sb.from('blog_posts')
        .update({ hero_image: newHero })
        .eq('id', destroyPost.id);
      if (error) console.log(`  FAIL: ${error.message}`);
      else console.log(`  ✓ Updated hero on ${DESTROY_SLUG}`);
    } else {
      console.log(`  [DRY] Would set hero to ${newHero ? newHero.slice(0,60) : 'null'}`);
    }
  }
}

// ── Part C: Missing signoff ───────────────────────────────────────────────────
console.log('\n━━ Part C: Missing signoff in news_articles ━━━━━━━━━━━━━━━━━━━━━━━');

// The slugs known to be missing signoff (from CQS audit)
const MISSING_SIGNOFF_SLUGS = [
  'lego-11380-road-bike-a-2-foot-bicycle-that-costs-12400',
  'fallout-lego-mocs-wasteland-wonders-for-your-shelf',
  'lego-mario-kart-luigi-mach-8-72050-worth-18999',
  'lego-gears-a-deep-dive-into-interlocking-plastic-cogs',
  'unplanned-lego-photos-finding-creativity-in-chaos-2',
  'pinterest-for-lego-mocs-your-digital-inspiration-board',
  'lego-wheels-tires-not-just-for-cars-anymore',
  'the-adorabuild-contest-your-last-chance-to-win-bricks',
  'reviving-your-lego-9v-train-motors-diy-guide-released',
  'weapon-wednesday-tiny-lego-weapons-find-a-home',
  'lego-megatron-brickheadz-your-wallet-is-safe-for-now',
  'bionicles-tahu-celebrates-25-years-with-epic-fan-builds',
  'lego-themes-from-ideas-to-art-how-they-change',
  'microscale-moonshot-is-this-fan-build-worth-the-wait',
  'lego-ebon-hawk-your-wallet-remains-safe-for-now',
];

const SIGNOFF = '\n\nOn that bombshell, bubyee.';

const { data: signoffArticles } = await sb.from('news_articles')
  .select('id, slug, content')
  .in('slug', MISSING_SIGNOFF_SLUGS);

console.log(`Found ${(signoffArticles ?? []).length} of ${MISSING_SIGNOFF_SLUGS.length} slugs`);

let signoffFixed = 0;
for (const a of signoffArticles ?? []) {
  if (/on that bombshell/i.test(a.content)) {
    console.log(`  SKIP (already has signoff): ${a.slug.slice(0, 55)}`);
    continue;
  }
  const fixed = strip(a.content) + SIGNOFF;
  console.log(`  ${DRY ? '[DRY] ' : ''}${a.slug.slice(0, 55)}`);
  if (!DRY) {
    const { error } = await sb.from('news_articles').update({ content: fixed }).eq('id', a.id);
    if (error) console.log(`    FAIL: ${error.message}`);
    else signoffFixed++;
  } else {
    signoffFixed++;
  }
}
console.log(`Part C done: ${signoffFixed} articles updated`);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Jaiman removed: ${jaimanFixed} articles`);
console.log(`Duplicate hero fixed: ${destroyPost ? 1 : 0}`);
console.log(`Signoff added: ${signoffFixed} articles`);
if (DRY) console.log('(dry run — no DB writes)');
