/**
 * Publish pending_drafts in batch.
 * Mirrors the lint gates and insert logic from src/app/admin/pending/actions.ts.
 * Detect-only for lint failures — never auto-fixes content.
 *
 * Usage:
 *   node --env-file=.env.local scripts/publish-drafts.mjs --limit 15
 *   node --env-file=.env.local scripts/publish-drafts.mjs --ids id1,id2,...
 *   node --env-file=.env.local scripts/publish-drafts.mjs --dry-run --limit 15
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL     = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bricksofindia.com').replace(/\/$/, '');

if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env vars'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_I = process.argv.indexOf('--limit');
const LIMIT   = LIMIT_I !== -1 ? parseInt(process.argv[LIMIT_I + 1], 10) : 50;
const IDS_I   = process.argv.indexOf('--ids');
const IDS     = IDS_I !== -1 ? process.argv[IDS_I + 1].split(',').map(s => s.trim()) : null;

const UA = 'BricksOfIndia-RadarBot/1.0 (+https://bricksofindia.com)';

// ── Lint gates (mirrors actions.ts) ──────────────────────────────────────────

const WORD_COUNT_TARGETS = {
  news:    { pass: [270,  440], fail: [225,  500] },
  review:  { pass: [450,  770], fail: [375,  875] },
  opinion: { pass: [360,  550], fail: [300,  625] },
  guide:   { pass: [630, 1100], fail: [525, 1250] },
};
const VALID_VERDICTS   = new Set(['BUY NOW', 'WAIT', 'IMPORT ONLY', 'AVOID']);
const INDIA_COMPARE_RE = /\b(biryani|chai|EMI|Spotify|Netflix|petrol|samosa|litre|liter|movie.?ticket|PVR|butter.?chicken|Swiggy|Zomato|iPhone|months? of|weeks? of|auto.?rickshaw|pizza|pizzas|thali|dosa|subscription|streaming|Jio|Airtel|OTT|paneer|vada|rickshaw|salary|rent)\b/i;
const INDIA_STORE_RE   = /\b(Toycra|MyBrickHouse|Amazon|Flipkart|import.?only)\b/i;

function lintDraft(draft) {
  const body      = draft.draft_body || '';
  const format    = draft.draft_format || 'news';
  const wordCount = draft.word_count ?? body.split(/\s+/).filter(Boolean).length;
  const warnings  = [];
  const isCommunity = draft.draft_verdict === null;

  // Gate 1: word count
  const t = WORD_COUNT_TARGETS[format] ?? WORD_COUNT_TARGETS.news;
  if (wordCount < t.fail[0] || wordCount > t.fail[1]) {
    throw new Error(`[Gate 1 FAIL] Word count ${wordCount} outside hard limit ${t.fail[0]}–${t.fail[1]} for '${format}'`);
  }
  if (wordCount < t.pass[0] || wordCount > t.pass[1]) {
    warnings.push(`[Gate 1 WARN] Word count ${wordCount} outside target ${t.pass[0]}–${t.pass[1]}`);
  }

  // Gate 2: India Paragraph
  const markerIdx = body.indexOf('<!-- INDIA_PARAGRAPH -->');
  if (markerIdx === -1) throw new Error('[Gate 2 FAIL] <!-- INDIA_PARAGRAPH --> marker missing');
  const seg = body.slice(markerIdx);
  if (!INDIA_STORE_RE.test(seg))     throw new Error('[Gate 2 FAIL] No store mention in India Paragraph');
  // Community/MOC content (null verdict) may have no set price — downgrade price+comparison to warnings
  if (!/₹[\d,]+/.test(seg)) {
    if (isCommunity) warnings.push('[Gate 2 WARN] No INR price in India Paragraph (community content)');
    else throw new Error('[Gate 2 FAIL] No INR price in India Paragraph');
  }
  if (!INDIA_COMPARE_RE.test(seg)) {
    if (isCommunity) warnings.push('[Gate 2 WARN] No Indian comparison in India Paragraph (community content)');
    else throw new Error('[Gate 2 FAIL] No Indian comparison in India Paragraph');
  }

  // Gate 3: verdict — required for review and opinion only; news skips this gate
  if (format !== 'news') {
    const v = (draft.draft_verdict || '').trim().toUpperCase();
    if (draft.draft_verdict !== null && !VALID_VERDICTS.has(v)) {
      throw new Error(`[Gate 3 FAIL] Verdict '${draft.draft_verdict}' not in [BUY NOW, WAIT, IMPORT ONLY, AVOID]`);
    }
    if (draft.draft_verdict === null) {
      warnings.push('[Gate 3 WARN] No verdict — publishing as community/informational content');
    }
  }

  return { warnings };
}

// ── Hero image CDN blocklist + fallback chain ─────────────────────────────────
// Editorial CDNs (Brothers Brick/Squarespace, Jay's Brick Blog, Flickr) use
// hotlink protection and are unreliable in headless renderers. When an OG image
// resolves to one of these, we run the same Rebrickable fallback as YouTube.

const YOUTUBE_SRC_RE = /youtube\.com|youtu\.be/i;
const YOUTUBE_IMG_RE = /ytimg\.com|yt3\.ggpht\.com|youtube\.com\/vi\//i;

const EDITORIAL_CDN_BLOCKLIST = new Set([
  'static1.squarespace.com',       // New Elementary
  'media-cdn.brothers-brick.com',  // Brothers Brick
  'live.staticflickr.com',         // Flickr embeds
  'jaysbrickblog.com',             // Jay's Brick Blog
]);

function isEditorialCDN(url) {
  if (!url) return false;
  try { return EDITORIAL_CDN_BLOCKLIST.has(new URL(url).hostname); }
  catch { return false; }
}

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

  // Steps 1+2: extract distinct 4–6 digit set numbers, try Rebrickable for each
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
        if (data.set_img_url) {
          console.log(`  [yt-fallback] set ${num} → ${data.set_img_url.slice(0, 70)}`);
          return data.set_img_url;
        }
      }
    } catch { /* try next */ }
  }

  // Step 3: theme keyword → Rebrickable search → first set with image
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
        if (hit?.set_img_url) {
          console.log(`  [yt-fallback] theme "${theme}" → ${hit.set_img_url.slice(0, 70)}`);
          return hit.set_img_url;
        }
      }
    } catch { /* fall through */ }
  }

  // Step 4: no image resolved
  console.log('  [yt-fallback] no image resolved — hero will be null');
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateSlug(title) {
  return (title || 'untitled')
    .toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function resolveTarget(format) {
  if (format === 'guide')   return { table: 'guides',        path: '/guides', category: 'Guide'   };
  if (format === 'opinion') return { table: 'blog_posts',    path: '/opinion', category: 'Opinion' };
  if (format === 'review')  return { table: 'news_articles', path: '/news',   category: 'Review'  };
  return                           { table: 'news_articles', path: '/news',   category: 'News'    };
}

async function fetchOgImage(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const html = await res.text();
    const ogMatch   = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                   || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const twMatch   = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
                   || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    const og = ogMatch?.[1] || twMatch?.[1];
    return (og && og.startsWith('http')) ? og : null;
  } catch { return null; }
}

// ── Fetch drafts ──────────────────────────────────────────────────────────────

let q = sb.from('pending_drafts')
  .select('id, draft_title, draft_body, draft_verdict, draft_format, word_count, source_url, source_title, updated_at')
  .eq('status', 'draft')
  .not('draft_body', 'is', null)
  .order('updated_at', { ascending: false });

if (IDS) q = q.in('id', IDS);
else     q = q.limit(LIMIT);

const { data: drafts, error: fetchErr } = await q;
if (fetchErr) { console.error('Fetch error:', fetchErr.message); process.exit(1); }

const queue = (drafts ?? []).filter(d => d.draft_title && d.draft_title !== 'undefined' && d.draft_body?.trim().length > 50);
console.log(`━━ publish-drafts${DRY_RUN ? ' [DRY RUN]' : ''} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Drafts to process: ${queue.length} (from ${drafts?.length ?? 0} fetched)\n`);

// ── Process each draft ────────────────────────────────────────────────────────

let published = 0, failed = 0, skipped = 0;
const failures = [];

for (const draft of queue) {
  const label = (draft.draft_title || draft.source_title || draft.id).slice(0, 65);
  process.stdout.write(`  ${label}… `);

  // Lint
  let warnings = [];
  try {
    ({ warnings } = lintDraft(draft));
  } catch (e) {
    failed++;
    failures.push({ title: label, reason: e.message });
    console.log(`FAIL: ${e.message}`);
    continue;
  }
  if (warnings.length > 0) console.log(`\n    WARN: ${warnings.join(' | ')}`);

  const format             = draft.draft_format || 'news';
  const { table, path, category } = resolveTarget(format);
  const title              = draft.draft_title || draft.source_title || 'Untitled';
  const baseSlug           = generateSlug(title);

  if (DRY_RUN) {
    skipped++;
    console.log(`DRY-RUN → /news/${baseSlug} [${format}, verdict=${draft.draft_verdict ?? 'none'}]`);
    continue;
  }

  // Slug uniqueness
  let slug = baseSlug, attempt = 2;
  while (true) {
    const { data: existing } = await sb.from(table).select('id').eq('slug', slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug.slice(0, 57)}-${attempt++}`;
  }

  // OG image — with YouTube + editorial CDN fallback chain
  let heroImage = await fetchOgImage(draft.source_url);
  if (YOUTUBE_SRC_RE.test(draft.source_url) || (heroImage !== null && YOUTUBE_IMG_RE.test(heroImage))) {
    console.log('  [yt] YouTube source — running Rebrickable fallback chain');
    heroImage = await resolveYouTubeHeroImage(draft.draft_title, draft.source_title);
  } else if (isEditorialCDN(heroImage)) {
    console.log(`  [cdn-block] Editorial CDN (${new URL(heroImage).hostname}) — running Rebrickable fallback chain`);
    heroImage = await resolveYouTubeHeroImage(draft.draft_title, draft.source_title);
  }
  if (heroImage) {
    try {
      const imgRes = await fetch(heroImage, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      if (!imgRes.ok) heroImage = null;
    } catch { heroImage = null; }
  }
  if (heroImage) {
    const { data: imgConflict } = await sb.from(table).select('id').eq('hero_image', heroImage).maybeSingle();
    if (imgConflict) heroImage = null;
  }

  // Clean body: strip the processing marker before storing
  const cleanBody = draft.draft_body.replace(/<!--\s*INDIA_PARAGRAPH\s*-->\n?/g, '');
  const excerpt   = cleanBody.replace(/#{1,6}\s/g, '').replace(/\*+([^*]+)\*+/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 160);
  const now       = new Date().toISOString();

  const row = {
    title, slug, content: cleanBody, category, excerpt,
    published_at: now, seo_title: title, seo_description: excerpt,
    ...(heroImage ? { hero_image: heroImage } : {}),
  };

  const { error: insertErr } = await sb.from(table).insert(row);
  if (insertErr) {
    failed++;
    failures.push({ title: label, reason: insertErr.message });
    console.log(`INSERT FAIL: ${insertErr.message}`);
    continue;
  }

  await sb.from('pending_drafts').update({ status: 'published', published_url: `${path}/${slug}` }).eq('id', draft.id);

  published++;
  console.log(`OK → ${SITE_URL}${path}/${slug}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Published : ${published}`);
console.log(`Failed    : ${failed}`);
if (DRY_RUN) console.log(`Dry-run   : ${skipped}`);
if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  ❌ ${f.title.slice(0, 60)}\n     ${f.reason}`);
}
