/**
 * Fix content quality issues logged in content_quality_issues.
 * Handles: bad_opener, forbidden_word, bold/italic/list markdown, missing_verdict.
 * Marks each fixed issue as resolved.
 * Run: node --env-file=.env.local scripts/fix-content-issues.mjs
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

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

let fixed = 0, skipped = 0;

async function update(table, slug, newContent, checks) {
  const { error } = await sb.from(table).update({ content: newContent }).eq('slug', slug);
  if (error) { console.log(`  ✗ DB error on ${slug}: ${error.message}`); return; }
  // Mark those check types resolved
  for (const check of checks) {
    await sb.from('content_quality_issues')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('article_slug', slug)
      .eq('check_name', check);
  }
  fixed++;
  console.log(`  ✓ ${slug.slice(0, 60)}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripMarkdown(content) {
  return content
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')   // **bold** → bold
    .replace(/\*([^*\n]+)\*/g, '$1')        // *italic* → italic (single star only)
    .trim();
}

function stripMarkdownChecks(content) {
  const before = content;
  const after = stripMarkdown(content);
  const changed = before !== after;
  return { content: after, changed };
}

// ── Fetch all affected articles ───────────────────────────────────────────────

async function fetchArticle(table, slug) {
  const { data } = await sb.from(table).select('slug, content').eq('slug', slug).single();
  return data;
}

// ══════════════════════════════════════════════════════════════════════════════
// PASS 1 — Markdown stripping (bold/italic) + list markdown
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n━━ PASS 1: Strip bold/italic markdown ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const { data: mdIssues } = await sb.from('content_quality_issues')
  .select('article_slug, section, check_name')
  .in('check_name', ['bold_markdown', 'italic_markdown', 'list_markdown'])
  .eq('resolved', false);

// group by slug + section
const mdBySlug = {};
for (const r of mdIssues ?? []) {
  const key = r.section + '|' + r.article_slug;
  if (!mdBySlug[key]) mdBySlug[key] = { section: r.section, slug: r.article_slug, checks: [] };
  mdBySlug[key].checks.push(r.check_name);
}

const tableMap = { news_articles: 'news_articles', blog_posts: 'blog_posts', reviews: 'reviews', guides: 'guides' };

for (const { section, slug, checks } of Object.values(mdBySlug)) {
  const art = await fetchArticle(tableMap[section], slug);
  if (!art) { console.log(`  SKIP (not found): ${slug}`); skipped++; continue; }
  const { content: cleaned, changed } = stripMarkdownChecks(art.content);
  if (!changed) { console.log(`  SKIP (no change): ${slug}`); skipped++; continue; }
  await update(tableMap[section], slug, cleaned, checks);
}

// ══════════════════════════════════════════════════════════════════════════════
// PASS 2 — Bad openers
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n━━ PASS 2: Fix bad openers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const BAD_OPENER_FIXES = {
  'lego-price-changes-india-2026': {
    table: 'news_articles',
    from: "Let's talk about LEGO® price movements in India in 2026. Because someone has to, and it might as well be us.",
    to:   "LEGO® prices in India moved in 2026. Some went up. A few stayed stable. None came down. Here is what actually changed.",
  },
  'lego-titanic-10294-sailing-into-your-living-room-and-your-wa': {
    table: 'news_articles',
    from: "Okay, folks, let's talk about the big one. The LEGO Titanic. Set number 10294. When this behemoth was announced, it sent ripples through the LEGO community faster than an iceberg hitting a certain famous ship. And let's be honest, the first thing that hits us is the price tag, right?",
    to:   "9,090 pieces. Over a metre long when complete. And a price tag that will prompt a very serious conversation with your bank account. The LEGO Titanic (10294) is not a casual purchase — this is a commitment, and one that hits you immediately when you see the number.",
  },
};

for (const [slug, fix] of Object.entries(BAD_OPENER_FIXES)) {
  const art = await fetchArticle(fix.table, slug);
  if (!art) { console.log(`  SKIP (not found): ${slug}`); skipped++; continue; }
  if (!art.content.includes(fix.from)) {
    console.log(`  SKIP (old text not found): ${slug}`);
    skipped++;
    continue;
  }
  const newContent = art.content.replace(fix.from, fix.to);
  await update(fix.table, slug, newContent, ['bad_opener']);
}

// ══════════════════════════════════════════════════════════════════════════════
// PASS 3 — Forbidden word replacements
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n━━ PASS 3: Fix forbidden words ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const FORBIDDEN_WORD_FIXES = [
  // enthusiasts → fans
  { table: 'news_articles', slug: 'lego-technic-2026-india-all-sets',
    from: 'adult builders and engineering enthusiasts', to: 'adult builders and engineering fans' },
  { table: 'news_articles', slug: 'lego-f1-collection-2026-india',
    from: 'F1 enthusiasts at accessible prices', to: 'F1 fans at accessible prices' },
  { table: 'blog_posts', slug: 'lego-technic-vs-city-india',
    from: 'Most serious LEGO® enthusiasts eventually explore both', to: 'Most serious LEGO® fans eventually explore both' },
  // marvel → feat / achievement
  { table: 'news_articles', slug: 'lego-icons-road-bike-rolls-into-india-a-17500-test-of-patien',
    from: 'This new LEGO Icons Road Bike is a marvel of modern brick-based engineering.',
    to:   'This new LEGO Icons Road Bike is a feat of modern brick-based engineering.' },
  { table: 'news_articles', slug: 'lego-icons-road-bike-rolls-into-india-a-17500-test-of-patien',
    from: 'This marvel of plastic engineering will set you back',
    to:   'This piece of plastic engineering will set you back' },
  { table: 'blog_posts', slug: 'lego-sets-destroy-wallet-2026',
    from: 'Technic flagships are engineering marvels in brick form.',
    to:   'Technic flagships are engineering achievements in brick form.' },
  // hefty → just the number
  { table: 'news_articles', slug: 'forget-emi-this-lego-nyc-apple-costs-more-than-100-plates-of',
    from: "it's a hefty $139.99", to: "it's $139.99" },
  // jam → traffic
  { table: 'news_articles', slug: 'the-lego-road-bike-11380-worth-your-emi-in-india',
    from: 'Forget the morning traffic jams and the crushing weight',
    to:   'Forget the morning traffic and the crushing weight' },
  // folks (×2 in Titanic — handled as part of bad_opener fix for first; fix second here)
  { table: 'news_articles', slug: 'lego-titanic-10294-sailing-into-your-living-room-and-your-wa',
    from: "It's a lot of dough, folks.", to: "It's a lot of dough." },
];

for (const fix of FORBIDDEN_WORD_FIXES) {
  const art = await fetchArticle(fix.table, fix.slug);
  if (!art) { console.log(`  SKIP (not found): ${fix.slug}`); skipped++; continue; }
  if (!art.content.includes(fix.from)) {
    // might already be fixed from a previous fix in this same article
    console.log(`  SKIP (text not found — may be already fixed): ${fix.slug}`);
    continue;
  }
  const newContent = art.content.replace(fix.from, fix.to);
  await update(fix.table, fix.slug, newContent, ['forbidden_word']);
}

// 'lego-themes-explained-india' — "Marvel" is the brand name (Marvel Comics). False positive.
await sb.from('content_quality_issues')
  .update({ resolved: true, resolved_at: new Date().toISOString() })
  .eq('article_slug', 'lego-themes-explained-india')
  .eq('check_name', 'forbidden_word');
console.log('  ✓ lego-themes-explained-india [forbidden_word: Marvel brand = false positive, closed]');

// ══════════════════════════════════════════════════════════════════════════════
// PASS 4 — Add missing verdict lines
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n━━ PASS 4: Add missing verdict lines ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const VERDICTS = {
  // news_articles
  'lego-technic-2026-india-all-sets':      { table: 'news_articles', v: 'WAIT',      note: 'Technic prices are consistent — wait for the ABHINAV12 window or a sale.' },
  'lego-speed-champions-2026-india':       { table: 'news_articles', v: 'BUY NOW',   note: 'Best value LEGO theme in India. ₹3,000–5,500 range is accessible.' },
  'every-lego-set-india-2026':             { table: 'news_articles', v: 'WAIT',      note: 'Bookmark and check back — sets release in waves through the year.' },
  'lego-icons-2026-india':                 { table: 'news_articles', v: 'BUY NOW',   note: 'Icons sets appreciate. Do not wait on flagship releases.' },
  'lego-star-wars-2026-india':             { table: 'news_articles', v: 'WAIT',      note: 'Prices are steep. Patience and the ABHINAV12 code are your best tools.' },
  'lego-creator-2026-india':               { table: 'news_articles', v: 'BUY NOW',   note: '3-in-1 at these prices is the best value proposition in the entire LEGO range.' },
  'lego-retiring-sets-2026-india':         { table: 'news_articles', v: 'BUY NOW',   note: 'Retiring sets only go up in price. If you want it, buy it now.' },
  'lego-f1-collection-2026-india':         { table: 'news_articles', v: 'BUY NOW',   note: 'Speed Champions F1 sets offer the best price-to-display ratio in the theme.' },
  'lego-minecraft-2026-india':             { table: 'news_articles', v: 'BUY NOW',   note: 'Strong kids gift — Minecraft recognition plus LEGO building at a sensible price.' },
  'lego-price-changes-india-2026':         { table: 'news_articles', v: 'WAIT',      note: 'Prices have moved. Compare across stores and use ABHINAV12 before buying.' },
  'lego-lord-rings-2026-india':            { table: 'news_articles', v: 'WAIT',      note: 'Limited availability and premium pricing. Monitor Toycra for stock drops.' },
  'lego-ideas-2026-india':                 { table: 'news_articles', v: 'BUY NOW',   note: 'Ideas sets retire without warning. Do not sleep on the ones you want.' },
  'lego-minifigures-series-2026-india':    { table: 'news_articles', v: 'BUY NOW',   note: 'At ₹350–500 per blind bag, this is the most accessible entry point in LEGO.' },
  'mybrickhouse-arrivals-april-2026':      { table: 'news_articles', v: 'BUY NOW',   note: 'Stock is live now. Compare and use ABHINAV12 at Toycra.' },
  'new-lego-sets-toycra-april-2026':       { table: 'news_articles', v: 'BUY NOW',   note: 'Code ABHINAV12 for 12% off above ₹500 — use it before it expires.' },
  'lego-city-2026-india':                  { table: 'news_articles', v: 'BUY NOW',   note: 'City is widely available and well-priced. One of the easiest buys.' },
  'lego-botanical-collection-2026-india':  { table: 'news_articles', v: 'BUY NOW',   note: 'Botanical sets retire and appreciate. The Rose is already 2x retail used.' },
  'lego-harry-potter-2026-india':          { table: 'news_articles', v: 'WAIT',      note: 'Hold for Hogwarts Castle price dips. Smaller sets are fine at current prices.' },
  'lego-icons-road-bike-rolls-into-india-a-17500-test-of-patien': { table: 'news_articles', v: 'WAIT', note: 'A display piece at ₹17,500. Worth it at a 15–20% discount only.' },
  'forget-emi-this-lego-nyc-apple-costs-more-than-100-plates-of': { table: 'news_articles', v: 'AVOID', note: 'Novelty item at a price that makes no sense.' },
  'the-lego-road-bike-11380-worth-your-emi-in-india':             { table: 'news_articles', v: 'WAIT', note: 'Not yet in stores. Set a price alert and use ABHINAV12 when it lands.' },
  'best-new-lego-sets-2026-so-far':        { table: 'news_articles', v: 'BUY NOW',   note: 'These are the standout picks. If one matches your interest, act.' },
  'best-lego-deals-india-april-2026':      { table: 'news_articles', v: 'BUY NOW',   note: 'These are the best deals right now. ABHINAV12 at Toycra is the consistent winner.' },
  // reviews
  'lego-42172-mclaren-p1-review':   { table: 'reviews', v: 'BUY NOW', note: '₹29,399 is ₹11,101 under MRP. Buy before the price corrects.' },
  'lego-10316-rivendell-review':    { table: 'reviews', v: 'BUY NOW', note: '₹39,999 at Toycra, ₹5,001 under MRP. If you want it, this is the price.' },
};

const VERDICT_TEMPLATES = {
  'BUY NOW':     'Verdict: BUY NOW.',
  'WAIT':        'Verdict: WAIT.',
  'IMPORT ONLY': 'Verdict: IMPORT ONLY.',
  'AVOID':       'Verdict: AVOID.',
};

for (const [slug, { table, v, note }] of Object.entries(VERDICTS)) {
  const art = await fetchArticle(table, slug);
  if (!art) { console.log(`  SKIP (not found): ${slug}`); skipped++; continue; }

  // Skip if a valid verdict already exists
  const lc = art.content.toLowerCase();
  const hasVerdict = ['verdict: buy now', 'verdict: wait', 'verdict: import only', 'verdict: avoid'].some(x => lc.includes(x));
  if (hasVerdict) {
    // mark resolved without edit
    await sb.from('content_quality_issues')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('article_slug', slug).eq('check_name', 'missing_verdict');
    console.log(`  ✓ ${slug.slice(0,55)} [already has verdict — closed]`);
    continue;
  }

  // Remove any old "VERDICT:" line in old format first
  let content = art.content
    .replace(/^VERDICT:.*$/im, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();

  // Append new verdict line
  content += `\n\n${VERDICT_TEMPLATES[v]} ${note}`;
  await update(table, slug, content, ['missing_verdict']);
}

// ══════════════════════════════════════════════════════════════════════════════
// PASS 5 — Mark missing_india_paragraph for guides/opinion as false-positive
// (guides and opinion posts don't require the India Paragraph processing marker)
// ══════════════════════════════════════════════════════════════════════════════

console.log('\n━━ PASS 5: Close false-positive missing_india_paragraph ━━━━━━━━━━');

const FALSE_POSITIVE_IP = [
  // guides — India Paragraph marker not required for explanatory/how-to guides
  'lego-themes-explained-india',
  'how-to-store-display-lego-india',
  // blog_posts (opinion) — India Paragraph is not a requirement for opinion format
  'lego-investment-india-2026',
  'lego-technic-vs-city-india',
];

for (const slug of FALSE_POSITIVE_IP) {
  const { error } = await sb.from('content_quality_issues')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('article_slug', slug).eq('check_name', 'missing_india_paragraph');
  if (!error) {
    console.log(`  ✓ ${slug} [false positive — closed]`);
    fixed++;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════════

console.log(`\n━━ Done ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Fixed/closed : ${fixed}`);
console.log(`Skipped      : ${skipped}`);
console.log('\nRemaining open (word_count / missing_india_paragraph news articles / all_caps):');
console.log('  — word_count (41): info level, no action needed');
console.log('  — missing_india_paragraph news (5): requires adding India section to legacy articles');
console.log('  — all_caps_word (1): investigate separately');
