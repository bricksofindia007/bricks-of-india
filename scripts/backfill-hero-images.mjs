/**
 * backfill-hero-images.mjs
 *
 * Re-runs the Rebrickable fallback chain for every article with
 * hero_image = '/fallback-hero.png'. Prints a RESCUE/KEEP-FALLBACK list.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-hero-images.mjs          # dry run
 *   node --env-file=.env.local scripts/backfill-hero-images.mjs --apply  # write to DB
 */

import { createClient } from '@supabase/supabase-js';

const APPLY   = process.argv.includes('--apply');
const HERO_FALLBACK = '/fallback-hero.png';
const UA = 'BricksOfIndia-RadarBot/1.0 (+https://bricksofindia.com)';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing Supabase env vars'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const LEGO_THEME_KEYWORDS = [
  'Technic','City','Star Wars','Harry Potter','Ideas','Icons','Creator','Ninjago',
  'Friends','Marvel','DC','Disney','Minecraft','Speed Champions','Architecture',
  'Botanical','BrickHeadz','Duplo','Monkie Kid','Jurassic World','Super Mario',
  'Dreamzzz','Classic','Seasonal','DOTS','Dimensions','Hidden Side',
];

async function resolveYouTubeHeroImage(title, body) {
  const rbKey  = process.env.REBRICKABLE_API_KEY;
  const rbHdrs = { 'User-Agent': UA, ...(rbKey ? { Authorization: `key ${rbKey}` } : {}) };
  const combined = `${title ?? ''} ${body ?? ''}`;

  // Step 1+2: extract up to 5 set numbers → try each on Rebrickable
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

  // Step 3: theme keyword → Rebrickable search
  const titleLower = (title ?? '').toLowerCase();
  const theme = LEGO_THEME_KEYWORDS.find(t => titleLower.includes(t.toLowerCase()));
  if (theme) {
    try {
      const res = await fetch(
        `https://rebrickable.com/api/v3/lego/sets/?search=${encodeURIComponent(theme)}&ordering=-year&page_size=5`,
        { headers: rbHdrs, signal: AbortSignal.timeout(5000) },
      );
      if (res.ok) {
        const data = await res.json();
        const hit = (data.results ?? []).find(s => s.set_img_url);
        if (hit?.set_img_url) return hit.set_img_url;
      }
    } catch { /* fall through */ }
  }

  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n━━ backfill-hero-images${APPLY ? ' [APPLY]' : ' [DRY RUN]'} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

const { data: articles, error } = await sb
  .from('news_articles')
  .select('id, slug, title, content')
  .eq('hero_image', HERO_FALLBACK);

if (error) { console.error('Query error:', error.message); process.exit(1); }
console.log(`Found ${articles.length} articles with hero_image = '${HERO_FALLBACK}'\n`);

let rescueCount = 0, keepCount = 0, updatedCount = 0;
const rescued = [];

for (const art of articles) {
  const resolved = await resolveYouTubeHeroImage(art.title, art.content);

  if (resolved) {
    rescueCount++;
    rescued.push({ id: art.id, slug: art.slug, url: resolved });
    console.log(`RESCUE:         ${art.slug}`);
    console.log(`  → ${resolved.slice(0, 100)}`);
  } else {
    keepCount++;
    console.log(`KEEP-FALLBACK:  ${art.slug} (legitimate — no set found)`);
  }
}

console.log(`\n──────────────────────────────────────────────────────────────────`);
console.log(`Rescuable: ${rescueCount}, Legitimate fallback: ${keepCount}, Total scanned: ${articles.length}`);

if (APPLY && rescued.length > 0) {
  console.log(`\nApplying ${rescued.length} updates…`);
  for (const { id, slug, url } of rescued) {
    const { error: upErr } = await sb
      .from('news_articles')
      .update({ hero_image: url })
      .eq('id', id);
    if (upErr) {
      console.log(`  ✗ ${slug}: ${upErr.message}`);
    } else {
      updatedCount++;
      console.log(`  ✓ ${slug}`);
    }
  }
  console.log(`\nUpdated ${updatedCount} rows.`);
} else if (APPLY) {
  console.log('\nNothing to update.');
}
