/**
 * BOI Content Quality Linter v2
 * Detects issues across all published content. Writes to content_quality_issues.
 * Does NOT fix anything — that's content-auto-fixer.mjs.
 *
 * Usage: node --env-file=.env.local scripts/content-linter.mjs
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
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing env vars'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// ── Constants ─────────────────────────────────────────────────────────────────

const FORBIDDEN_WORDS = [
  'pinnacle', 'testament', 'cognoscenti', 'whimsical', 'bloke',
  'fever dreams', 'siren call', 'unadulterated', 'folks', 'aficionados',
  'enthusiasts', 'hefty', 'at the end of the day', 'stunning',
  'marvel', 'impressive', 'delve', 'utilize',
  "that's your jam", "it's your jam",
];
const BAD_OPENERS = ['So,', 'Okay', 'Alright,', "Let's talk"];
const VERDICT_WORDS = ['BUY NOW', 'WAIT', 'IMPORT ONLY', 'AVOID'];
const STORE_NAMES   = ['MyBrickHouse', 'Toycra'];
const SIGNOFF       = 'On that bombshell';

const RUN_AT = new Date().toISOString();

// ── Helpers ───────────────────────────────────────────────────────────────────

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function paragraphs(text) {
  return text.split(/\n\n+/).filter(p => p.trim().length > 0);
}

function jaccardSimilarity(a, b) {
  const tokenize = s => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
  const ta = tokenize(a), tb = tokenize(b);
  const intersection = [...ta].filter(x => tb.has(x)).length;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : intersection / union;
}

function firstSentence(text) {
  return (text.match(/^[^.!?]+[.!?]/) || [text.slice(0, 100)])[0];
}

// ── Issue accumulator ─────────────────────────────────────────────────────────

const issues = [];
const seenFlags = new Set(); // deduplicate: each (slug, check_name) fires once per run

function flag(art, checkName, severity, detail, autoFixable = false) {
  const dedupKey = `${art.slug}|${checkName}`;
  if (seenFlags.has(dedupKey)) return;
  seenFlags.add(dedupKey);
  issues.push({
    checked_at:   RUN_AT,
    article_id:   (typeof art.id === 'string' && art.id.includes('-')) ? art.id : null,
    article_slug: art.slug,
    section:      art._section,
    check_name:   checkName,
    severity,
    detail,
    auto_fixable: autoFixable,
    resolved:     false,
  });
}

// ── Image HTTP check ──────────────────────────────────────────────────────────

const UA = 'BricksOfIndia-RadarBot/1.0 (+https://bricksofindia.com)';

async function checkImageUrl(url) {
  if (url.startsWith('/')) return 200; // local public-folder asset — skip HTTP check, treat as valid
  const timeout = url.includes('cdn.rebrickable.com') ? 12000 : 6000;
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeout) });
    return res.status;
  } catch { return 0; }
}

// ── Load articles ─────────────────────────────────────────────────────────────

async function loadSection(table, extraFilter) {
  const rows = [];
  let offset = 0;
  const PAGE = 200;
  while (true) {
    let q = sb.from(table).select('*').range(offset, offset + PAGE - 1);
    if (extraFilter) q = extraFilter(q);
    const { data, error } = await q;
    if (error) { console.error('Load error', table, error.message); break; }
    if (!data?.length) break;
    for (const r of data) r._section = table;
    rows.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

console.log('Loading articles…');
const [news, opinion, reviews, guides] = await Promise.all([
  loadSection('news_articles'),
  loadSection('blog_posts', q => q.eq('category', 'Opinion')),
  loadSection('reviews'),
  loadSection('guides'),
]);
const all = [...news, ...opinion, ...reviews, ...guides];
console.log(`Loaded: ${news.length} news, ${opinion.length} opinion, ${reviews.length} reviews, ${guides.length} guides = ${all.length} total\n`);

// ── Per-article checks ────────────────────────────────────────────────────────

const imageMap = {}; // url → [slug, ...]

for (const art of all) {
  const body    = art.content || '';
  const section = art._section;
  const isNewsOrReview   = section === 'news_articles' || section === 'reviews';
  const isOpinionOrNews  = section === 'blog_posts'    || section === 'news_articles';

  // MARKDOWN ARTIFACTS ──────────────────────────────────────────────────────

  const asteriskMatches = [...body.matchAll(/(?<!\*)\*(?!\*)([^*\n]{1,100})(?<!\*)\*(?!\*)/g)];
  for (const m of asteriskMatches.slice(0, 3))
    flag(art, 'markdown_asterisk', 'warning', `Asterisk markdown: ${m[0].slice(0, 60)}`, true);

  const boldMatches = [...body.matchAll(/\*\*([^*\n]{1,100})\*\*/g)];
  for (const m of boldMatches.slice(0, 3))
    flag(art, 'markdown_bold', 'warning', `Bold markdown: ${m[0].slice(0, 60)}`, true);

  const headerMatches = [...body.matchAll(/^#{1,6}\s.+/gm)];
  for (const m of headerMatches.slice(0, 2))
    flag(art, 'markdown_header', 'warning', `Markdown header: ${m[0].slice(0, 60)}`, true);

  const listMatches = [...body.matchAll(/^\s*[-*]\s+\S/gm)];
  for (const m of listMatches.slice(0, 2))
    flag(art, 'markdown_list', 'warning', `Markdown list item: ${m[0].slice(0, 60)}`, true);

  if (body.includes('  '))
    flag(art, 'double_space', 'info', 'Double space found in body', true);

  if (body.split('\n').some(l => /\s+$/.test(l)))
    flag(art, 'trailing_space', 'info', 'Trailing whitespace on one or more lines', true);

  if (/\n{3,}/.test(body))
    flag(art, 'consecutive_blank_lines', 'info', '3+ consecutive blank lines', true);

  // Capitalisation after period — skip URLs and set numbers
  const capErrors = [...body.matchAll(/\.\s+([a-z])(?=[a-z]{2,})/g)]
    .filter(m => !/https?:|www\.|[0-9]{4,}/.test(body.slice(Math.max(0, m.index - 20), m.index + 20)));
  for (const m of capErrors.slice(0, 2))
    flag(art, 'capitalisation_error', 'info', `Lowercase after period: "${m[0].slice(0, 40)}"`, true);

  // HTML ARTIFACTS ──────────────────────────────────────────────────────────

  if (body.includes('<!--'))
    flag(art, 'html_comment_visible', 'critical', 'HTML comment visible in body', true);

  if (body.includes('INDIA_PARAGRAPH'))
    flag(art, 'india_paragraph_marker', 'critical', 'INDIA_PARAGRAPH marker visible in body', true);

  if (body.includes('BOI_DRAFT_START') || body.includes('BOI_DRAFT_END'))
    flag(art, 'draft_marker_leaked', 'critical', 'Draft marker leaked into body', true);

  if (/<script|<iframe|<style/i.test(body))
    flag(art, 'script_injection', 'critical', 'Possible script injection in body', false);

  // VOICE CODEX ─────────────────────────────────────────────────────────────

  const bodyLower = body.toLowerCase();

  for (const word of FORBIDDEN_WORDS) {
    if (bodyLower.includes(word.toLowerCase()))
      flag(art, 'forbidden_word', 'warning', `Forbidden word: "${word}"`, true);
  }

  // Jaiman Toys reference — store removed 2026-05-31
  if (/jaiman/i.test(body))
    flag(art, 'jaiman_reference', 'warning', 'Article mentions Jaiman Toys (store removed 2026-05-31)', true);

  const firstWords = body.trimStart().slice(0, 60);
  for (const opener of BAD_OPENERS) {
    if (firstWords.startsWith(opener)) {
      flag(art, 'bad_opener', 'warning', `Bad opener: "${firstWords.slice(0, 50)}"`, false);
      break;
    }
  }

  if (isNewsOrReview && art.category === 'Review' && !VERDICT_WORDS.some(v => body.includes(v)))
    flag(art, 'missing_verdict', 'critical', 'No verdict found (BUY NOW/WAIT/IMPORT ONLY/AVOID)', true);

  if (isNewsOrReview && ['New Sets', 'India Launches', 'Review'].includes(art.category) && !body.includes('₹'))
    flag(art, 'missing_india_paragraph', 'critical', 'No INR price (₹) found in body', false);

  if (isNewsOrReview && !STORE_NAMES.some(s => body.includes(s)))
    flag(art, 'missing_store_mention', 'warning', 'No store name found (MyBrickHouse / Toycra)', false);

  if (isOpinionOrNews && !body.includes(SIGNOFF))
    flag(art, 'missing_signoff', 'info', `Missing "${SIGNOFF}" signoff`, true);

  // STRUCTURE ───────────────────────────────────────────────────────────────

  const wc = wordCount(body);
  const wt = ({ news_articles: { lo: 250, hi: 500 }, reviews: { lo: 400, hi: 900 }, blog_posts: { lo: 300, hi: 700 }, guides: { lo: 500, hi: 1500 } })[section] ?? { lo: 250, hi: 500 };
  if (wc < wt.lo)       flag(art, 'word_count_low',  'warning', `Word count ${wc}, target ≥${wt.lo}`, false);
  else if (wc > wt.hi)  flag(art, 'word_count_high', 'info',    `Word count ${wc} above target ${wt.hi}`, false);

  const paras = paragraphs(body);
  if (paras.length < 3)
    flag(art, 'thin_content', 'warning', `Only ${paras.length} paragraphs`, false);

  for (let i = 0; i < paras.length; i++) {
    const pw = wordCount(paras[i]);
    if (pw > 200) flag(art, 'wall_of_text', 'warning', `Paragraph ${i + 1} is ${pw} words`, false);
  }

  // IMAGE CHECKS ────────────────────────────────────────────────────────────

  // guides use featured_image_url; news/reviews/blog use hero_image
  const imgUrl = art.hero_image || art.image_url || art.featured_image_url || null;

  // Only flag missing_image if slug contains a set number — MOC/community articles have no image source
  const hasSetNumber = /\b\d{4,6}\b/.test(art.slug || '');
  if (!imgUrl && hasSetNumber) {
    flag(art, 'missing_image', 'critical', 'No image URL set', false);
  } else {
    // exclude YouTube maxresdefault and canonical fallback from placeholder check
    const CANONICAL_FALLBACK = '/fallback-hero.png';
    if (imgUrl !== CANONICAL_FALLBACK && (/placeholder|no-image|fallback|blank/i.test(imgUrl) || (/\bdefault\b/i.test(imgUrl) && !/ytimg\.com|youtube/i.test(imgUrl))))
      flag(art, 'placeholder_image', 'critical', `Placeholder image URL: ${imgUrl.slice(0, 80)}`, false);
    if (!imageMap[imgUrl]) imageMap[imgUrl] = [];
    imageMap[imgUrl].push({ slug: art.slug, section });
  }
}

// ── Duplicate detection ───────────────────────────────────────────────────────

console.log('Running duplicate detection…');
for (let i = 0; i < all.length; i++) {
  for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    const tSim = jaccardSimilarity(a.title || '', b.title || '');
    if (tSim > 0.7) {
      flag(a, 'duplicate_title', 'warning', `Similar title (${Math.round(tSim * 100)}%) to: ${b.slug}`, false);
      flag(b, 'duplicate_title', 'warning', `Similar title (${Math.round(tSim * 100)}%) to: ${a.slug}`, false);
    }
    const oSim = jaccardSimilarity(firstSentence(a.content || ''), firstSentence(b.content || ''));
    if (oSim > 0.8) {
      flag(a, 'duplicate_opener', 'warning', `Similar opener (${Math.round(oSim * 100)}%) to: ${b.slug}`, false);
      flag(b, 'duplicate_opener', 'warning', `Similar opener (${Math.round(oSim * 100)}%) to: ${a.slug}`, false);
    }
  }
}

// ── Image HTTP checks ─────────────────────────────────────────────────────────

const uniqueUrls = Object.keys(imageMap);
console.log(`Checking ${uniqueUrls.length} unique image URLs…`);
const imageStatusMap = {};
await Promise.allSettled(
  uniqueUrls.map(async url => { imageStatusMap[url] = await checkImageUrl(url); })
);

const imageRegistryRows = [];
for (const [url, entries] of Object.entries(imageMap)) {
  const status = imageStatusMap[url] ?? 0;
  const isDuplicate = entries.length > 1;
  for (const { slug, section } of entries) {
    const art = all.find(a => a.slug === slug);
    imageRegistryRows.push({
      checked_at: RUN_AT, article_slug: slug, section, image_url: url,
      http_status: status, is_duplicate: isDuplicate,
      duplicate_of: isDuplicate ? entries.filter(e => e.slug !== slug).map(e => e.slug) : [],
    });
    if (status !== 200) {
      flag(art, 'broken_image', 'critical',
        status === 0
          ? `Image request failed (timeout): ${url.slice(0, 80)}`
          : `Image returns HTTP ${status}: ${url.slice(0, 80)}`,
        false);
    }
    if (isDuplicate) {
      const dupSlugs = entries.filter(e => e.slug !== slug).map(e => e.slug);
      const setNumA = slug.match(/\b(\d{4,6})\b/)?.[1];
      const sameset = dupSlugs.some(dupSlug => {
        const setNumB = dupSlug.match(/\b(\d{4,6})\b/)?.[1];
        return setNumA && setNumB && setNumA === setNumB;
      });
      // Suppress duplicate_image if both articles share the same set number — same product, expected
      if (!sameset)
        flag(art, 'duplicate_image', 'warning',
          `Image shared with: ${dupSlugs.slice(0, 3).join(', ')}`,
          false);
    }
  }
}

// ── Write issues to DB ────────────────────────────────────────────────────────

console.log(`\nWriting ${issues.length} issues to DB…`);
const BATCH = 50;
for (let i = 0; i < issues.length; i += BATCH) {
  const { error } = await sb.from('content_quality_issues').insert(issues.slice(i, i + BATCH));
  if (error) console.error('Insert error:', error.message);
}

console.log(`Writing ${imageRegistryRows.length} image registry rows…`);
for (let i = 0; i < imageRegistryRows.length; i += BATCH) {
  const { error } = await sb.from('content_image_registry').insert(imageRegistryRows.slice(i, i + BATCH));
  if (error) console.error('Image registry error:', error.message);
}

// ── Summary ───────────────────────────────────────────────────────────────────

const counts = { critical: 0, warning: 0, info: 0 };
for (const i of issues) counts[i.severity] = (counts[i.severity] || 0) + 1;
const autoFixable = issues.filter(i => i.auto_fixable).length;

console.log(`\nLinter complete: ${all.length} articles checked`);
console.log(`Critical: ${counts.critical} | Warning: ${counts.warning} | Info: ${counts.info}`);
console.log(`Auto-fixable: ${autoFixable} | Manual required: ${issues.length - autoFixable}`);

// ── Root-cause breakdown ──────────────────────────────────────────────────────

const bySeverity = { critical: [], warning: [], info: [] };
const byCheck = {};
for (const issue of issues) {
  byCheck[issue.check_name] = byCheck[issue.check_name] || { count: 0, severity: issue.severity };
  byCheck[issue.check_name].count++;
}
for (const [checkName, { count, severity }] of Object.entries(byCheck)) {
  (bySeverity[severity] ?? (bySeverity.info)).push({ checkName, count });
}
for (const sev of ['critical', 'warning', 'info']) {
  const group = bySeverity[sev].sort((a, b) => b.count - a.count);
  if (!group.length) continue;
  console.log(`\n  [${sev.toUpperCase()}]`);
  for (const { checkName, count } of group) {
    console.log(`    ${String(count).padStart(3)}  ${checkName}`);
  }
}
