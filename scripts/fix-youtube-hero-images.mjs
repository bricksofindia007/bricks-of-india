/**
 * Backfill: fix bad hero images in news_articles.
 * Targets:
 *   - hero_image containing YouTube CDN domains (ytimg.com, yt3.ggpht.com, youtube.com/vi/)
 *   - hero_image that is null or empty
 *
 * Fallback chain:
 *   1. Extract set numbers from title + content (with year-exclusion filter) → Rebrickable set image
 *   2. Extract LEGO theme keyword from title → Rebrickable search image
 *   3. null (no hero image)
 *
 * Usage:
 *   node --env-file=.env.local scripts/fix-youtube-hero-images.mjs --dry-run
 *   node --env-file=.env.local scripts/fix-youtube-hero-images.mjs
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

const sb      = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const DRY_RUN = process.argv.includes('--dry-run');
const UA      = 'BricksOfIndia-RadarBot/1.0 (+https://bricksofindia.com)';
const RB_KEY  = process.env.REBRICKABLE_API_KEY;
const RB_HDRS = { 'User-Agent': UA, ...(RB_KEY ? { Authorization: `key ${RB_KEY}` } : {}) };

const YOUTUBE_IMG_RE = /ytimg\.com|yt3\.ggpht\.com|youtube\.com\/vi\//i;

// Slugs to never touch — year-range false positives or manually verified as acceptable null
const SKIP_SLUGS = new Set([
  '1999-lego-adventurers-amazon-ancient-ruins-in-india-a-relic-',
]);

// Year-exclusion: 4-digit numbers in 1930-2030 that look like calendar years, not set numbers.
// Filters: number starts the title, or is preceded by year-context words in the combined text.
function isYearLike(num, matchIndex, combined, title) {
  const n = parseInt(num, 10);
  if (n < 1930 || n > 2030 || num.length !== 4) return false;
  if ((title ?? '').trim().startsWith(num)) return true;
  const before = combined.slice(Math.max(0, matchIndex - 35), matchIndex);
  return /\b(year|since|from|in|of|during|around|back\s+in|released|launched|arrived)\s+$/i.test(before);
}

// keyword → Rebrickable search term map (checked in order, first match wins)
const KEYWORD_THEME_MAP = [
  // Star Wars (must come before generic "imperial", "clone" etc.)
  {
    keywords: ['star wars', 'lambda shuttle', 'imperial shuttle', 'vader', 'mandalorian',
               'bo-katan', 'boba fett', 'houndstooth', 'jabba', 'jedi', 'sith',
               'clone', 'death star', 'millennium falcon', 'x-wing', 'tie fighter',
               'stormtrooper', 'at-at', 'at-rt', 'at-st', 'lightsaber'],
    search: 'Star Wars',
  },
  // Gaming / retro consoles (most specific first)
  { keywords: ['sega genesis', 'sega mega drive', 'sega'], search: 'Sega Genesis' },
  { keywords: ['atari'],                                    search: 'Atari' },
  { keywords: ['sonic the hedgehog', 'sonic'],              search: 'Sonic' },
  { keywords: ['pac-man', 'pacman'],                        search: 'PAC-MAN' },
  { keywords: ['nintendo', 'game boy', 'gameboy', 'nes '],  search: 'Nintendo' },
  { keywords: ['gaming', 'retro console', 'mini console'],  search: 'Icons' },
  // Licensed / super heroes
  { keywords: ['harry potter', 'hogwarts', 'hermione', 'dumbledore', 'quidditch'], search: 'Harry Potter' },
  { keywords: ['batman', 'superman', 'wonder woman', 'justice league', 'dc comics', 'gotham'], search: 'DC' },
  { keywords: ['spider-man', 'iron man', 'avengers', 'thor', 'captain america', 'hulk', 'marvel'], search: 'Marvel' },
  { keywords: ['jurassic', 'dinosaur'], search: 'Jurassic World' },
  { keywords: ['disney', 'frozen', 'elsa', 'moana', 'encanto'],  search: 'Disney' },
  // Themes
  { keywords: ['technic', 'bulldozer', 'excavator', 'crane', 'tractor', 'motorbike', 'motorcycle'], search: 'Technic' },
  { keywords: ['road bike', 'bicycle', 'truck', 'heavy haul'], search: 'Technic' },
  { keywords: ['formula 1', 'formula one', ' f1 ', 'ferrari', 'lamborghini', 'mclaren', 'porsche', 'speed champion'], search: 'Speed Champions' },
  { keywords: ['city', 'police', 'fire station', 'ambulance'], search: 'City' },
  { keywords: ['ninjago', 'ninja'], search: 'Ninjago' },
  { keywords: ['friends', 'heartlake'], search: 'Friends' },
  { keywords: ['minecraft', 'creeper'], search: 'Minecraft' },
  { keywords: ['castle', 'medieval', 'knight', 'dragon'], search: 'Castle' },
  { keywords: ['ideas', 'fan design', 'fan build', 'moc', 'custom build', 'custom lego'], search: 'Ideas' },
  { keywords: ['botanical', 'flower', 'orchid', 'bonsai'], search: 'Botanical Collection' },
];

function findThemeSearch(title) {
  const lower = (title ?? '').toLowerCase();
  for (const entry of KEYWORD_THEME_MAP) {
    if (entry.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
      return entry.search;
    }
  }
  return null;
}

async function resolveImage(title, content) {
  const combined = `${title ?? ''} ${content ?? ''}`;

  // Step 1+2: set numbers → Rebrickable (year-like numbers excluded)
  const seen = new Set();
  const setNums = [];
  const re = /\b(\d{4,6})\b/g;
  let m;
  while ((m = re.exec(combined)) !== null) {
    if (seen.has(m[1])) continue;
    if (isYearLike(m[1], m.index, combined, title)) { seen.add(m[1]); continue; }
    seen.add(m[1]);
    setNums.push(m[1]);
  }
  for (const num of setNums.slice(0, 5)) {
    try {
      const res = await fetch(
        `https://rebrickable.com/api/v3/lego/sets/${num}-1/`,
        { headers: RB_HDRS, signal: AbortSignal.timeout(6000) },
      );
      if (res.ok) {
        const data = await res.json();
        if (data.set_img_url) return { image: data.set_img_url, via: `set ${num}` };
      }
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }

  // Step 3: keyword→theme map → Rebrickable search
  const searchTerm = findThemeSearch(title);
  if (searchTerm) {
    try {
      const res = await fetch(
        `https://rebrickable.com/api/v3/lego/sets/?search=${encodeURIComponent(searchTerm)}&ordering=-year&page_size=5`,
        { headers: RB_HDRS, signal: AbortSignal.timeout(6000) },
      );
      if (res.ok) {
        const data = await res.json();
        const hit = (data.results ?? []).find(s => s.set_img_url);
        if (hit?.set_img_url) return { image: hit.set_img_url, via: `keyword→"${searchTerm}"` };
      }
    } catch {}
  }

  // Step 4: no image
  return { image: null, via: 'no match' };
}

// ── Fetch affected articles ───────────────────────────────────────────────────

console.log(`\n━━ fix-bad-hero-images${DRY_RUN ? ' [DRY RUN]' : ''} ━━━━━━━━━━━━━━━━━━━━━━`);

const PAGE = 1000;
const affected = [];
for (let offset = 0; ; offset += PAGE) {
  const { data, error } = await sb
    .from('news_articles')
    .select('id, slug, title, content, hero_image')
    .range(offset, offset + PAGE - 1);
  if (error) { console.error('Fetch error:', error.message); process.exit(1); }
  if (!data || data.length === 0) break;
  for (const row of data) {
    if (SKIP_SLUGS.has(row.slug)) continue;
    if (!row.hero_image || YOUTUBE_IMG_RE.test(row.hero_image)) affected.push(row);
  }
  if (data.length < PAGE) break;
}

console.log(`\nArticles needing hero image fix: ${affected.length}\n`);

if (affected.length === 0) {
  console.log('Nothing to fix.');
  process.exit(0);
}

// ── Process each ─────────────────────────────────────────────────────────────

let fixed = 0, nulled = 0, errors = 0;

for (const article of affected) {
  const old = article.hero_image;
  const { image: newImg, via } = await resolveImage(article.title, article.content);

  const status = newImg ? `→ ${via}` : '→ null (no match)';
  console.log(`  ${article.slug}`);
  console.log(`    OLD: ${old ? old.slice(0, 90) : 'null'}`);
  console.log(`    NEW: ${newImg ? newImg.slice(0, 90) : 'null'} [${via}]`);

  if (!DRY_RUN) {
    const { error } = await sb
      .from('news_articles')
      .update({ hero_image: newImg })
      .eq('id', article.id);
    if (error) {
      console.log(`    ERROR: ${error.message}`);
      errors++;
    } else {
      newImg ? fixed++ : nulled++;
    }
  } else {
    newImg ? fixed++ : nulled++;
  }

  await new Promise(r => setTimeout(r, 400)); // polite between articles
}

console.log(`\n━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Total affected : ${affected.length}`);
console.log(`Fixed (image)  : ${fixed}`);
console.log(`Nulled         : ${nulled}`);
if (errors) console.log(`Errors         : ${errors}`);
if (DRY_RUN) console.log('\n[DRY RUN] No changes written.');
