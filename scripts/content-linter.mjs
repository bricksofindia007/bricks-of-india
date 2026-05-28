/**
 * Content Linter — database-level text checks on all published content.
 * Detect-only. Never modifies articles. Writes issues to content_quality_issues.
 * Run: node --env-file=.env.local scripts/content-linter.mjs
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

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Issue accumulator ─────────────────────────────────────────────────────────

/** @type {{ article_id: string|null, article_slug: string, section: string, check_name: string, severity: string, detail: string }[]} */
const issues = [];

function flag(articleId, slug, section, checkName, severity, detail) {
  issues.push({ article_id: articleId ?? null, article_slug: slug, section, check_name: checkName, severity, detail });
  console.log(`  ${severity === 'critical' ? '❌' : severity === 'warning' ? '⚠️ ' : 'ℹ️ '} [${slug}] ${checkName}: ${detail}`);
}

// ── Check sets ────────────────────────────────────────────────────────────────

const MARKDOWN_CHECKS = [
  { re: /\*\*[^*\n]+\*\*/,  name: 'bold_markdown',    detail: 'Bold markdown (**text**) visible in published content' },
  { re: /(?<!\*)\*(?!\*)[^*\n]+\*(?!\*)/,  name: 'italic_markdown',  detail: 'Italic markdown (*text*) visible in published content' },
  { re: /^#{1,6}\s/m,       name: 'heading_markdown', detail: 'Heading markdown (# H1) visible in published content' },
  { re: /^\s*[-*]\s\S/m,    name: 'list_markdown',    detail: 'List markdown (- item) visible in published content' },
];

const HTML_ARTIFACT_CHECKS = [
  { re: /<!--/,          name: 'html_comment',        severity: 'critical', detail: 'HTML comment tag found in content' },
  { re: /INDIA_PARAGRAPH/, name: 'marker_visible',   severity: 'critical', detail: 'INDIA_PARAGRAPH marker text visible in content' },
  { re: /BOI_DRAFT_START/, name: 'draft_marker',     severity: 'critical', detail: 'BOI_DRAFT_START/END marker leaked into published content' },
  { re: /<script\b/i,    name: 'script_tag',          severity: 'critical', detail: '<script> tag found in content' },
  { re: /<style\b/i,     name: 'style_tag',           severity: 'critical', detail: '<style> tag found in content' },
  { re: /<iframe\b/i,    name: 'iframe_tag',          severity: 'critical', detail: '<iframe> tag found in content' },
];

const FORBIDDEN_WORDS = [
  'pinnacle', 'testament', 'cognoscenti', 'whimsical', 'bloke',
  'fever dreams', 'siren call', 'unadulterated', 'folks', 'aficionados',
  'enthusiasts', 'hefty', 'at the end of the day', 'jam', 'stunning', 'marvel',
];

const BAD_OPENERS = ['So,', 'Okay,', 'Alright,', "Let's talk"];

const VALID_VERDICTS = ['BUY NOW', 'WAIT', 'IMPORT ONLY', 'AVOID'];

const INDIA_STORE_RE = /\b(Toycra|MyBrickHouse|Jaiman)\b/i;

// Editorial targets for published content (wider than draft lint gates)
const WORD_COUNT_TARGETS = {
  news:    { min: 600,   max: 1200 },
  review:  { min: 1000,  max: 2500 },
  opinion: { min: 700,   max: 1500 },
  guide:   { min: 800,   max: 2000 },
};

// ALL CAPS words that are expected and not a style violation
const ALLOWED_CAPS = new Set([
  'LEGO', 'HTML', 'HTTP', 'HTTPS', 'JSON', 'ISBN', 'AFOL', 'MFOL',
  'NISB', 'MIB', 'CMF', 'GWP', 'URL', 'API', 'ID', 'DIY', 'FAQ',
  'VIP', 'SKU', 'PDF', 'EOL', 'NFC', 'NYC', 'UK', 'US', 'AU', 'EU',
  'BUY', 'NOW', 'WAIT', 'ONLY', 'AVOID', 'IMPORT', 'INR', 'MRP', 'IGT',
  'VERDICT', 'SALE', 'NASA', 'IKEA', 'BILLY', 'DETOLF', 'DUPLO',
  'WHAT', 'COULD', 'BETTER', 'SHOULD', 'COST', 'GOOD', 'BEST',
]);

function runChecks(content, slug, articleId, section, format) {
  if (!content || content.trim().length === 0) {
    flag(articleId, slug, section, 'empty_content', 'critical', 'Article has no content');
    return;
  }

  // Markdown artifacts
  for (const check of MARKDOWN_CHECKS) {
    if (check.re.test(content)) {
      flag(articleId, slug, section, check.name, 'warning', check.detail);
    }
  }

  // HTML artifacts
  for (const check of HTML_ARTIFACT_CHECKS) {
    if (check.re.test(content)) {
      flag(articleId, slug, section, check.name, check.severity, check.detail);
    }
  }

  // Forbidden words (case-insensitive, whole match)
  const lc = content.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    if (lc.includes(word.toLowerCase())) {
      flag(articleId, slug, section, 'forbidden_word', 'warning', `Forbidden word: "${word}"`);
    }
  }

  // Opener check
  const trimmed = content.trimStart();
  for (const opener of BAD_OPENERS) {
    if (trimmed.startsWith(opener)) {
      flag(articleId, slug, section, 'bad_opener', 'warning', `Forbidden opener: "${opener}"`);
    }
  }

  // Verdict check (news and reviews only)
  if (format === 'news' || format === 'review') {
    const hasVerdict = VALID_VERDICTS.some(v => content.includes(v));
    if (!hasVerdict) {
      flag(articleId, slug, section, 'missing_verdict', 'warning', 'No verdict (BUY NOW / WAIT / IMPORT ONLY / AVOID) found');
    }
  }

  // India Paragraph: ₹ symbol + store name
  const hasRupee = content.includes('₹');
  const hasStore  = INDIA_STORE_RE.test(content);
  if (!hasRupee || !hasStore) {
    const missing = [];
    if (!hasRupee) missing.push('₹ symbol');
    if (!hasStore) missing.push('Indian store name (Toycra/MyBrickHouse/Jaiman)');
    flag(articleId, slug, section, 'missing_india_paragraph', 'warning',
      `India Paragraph incomplete — missing: ${missing.join(', ')}`);
  }

  // Typography: double spaces
  if (/  /.test(content)) {
    flag(articleId, slug, section, 'double_space', 'info', 'Double space found');
  }

  // Typography: >2 consecutive blank lines
  if (/\n{4,}/.test(content)) {
    flag(articleId, slug, section, 'excess_blank_lines', 'info', 'More than 2 consecutive blank lines found');
  }

  // Typography: ALL CAPS words >3 chars (excluding known acronyms)
  const capsMatches = (content.match(/\b[A-Z][A-Z]{3,}\b/g) || [])
    .filter(w => !ALLOWED_CAPS.has(w));
  if (capsMatches.length > 0) {
    flag(articleId, slug, section, 'all_caps_word', 'info',
      `ALL CAPS word(s) found: ${[...new Set(capsMatches)].slice(0, 3).join(', ')}`);
  }

  // Structure: word count vs editorial targets
  const words = content.split(/\s+/).filter(Boolean).length;
  const targets = WORD_COUNT_TARGETS[format] ?? WORD_COUNT_TARGETS.news;
  if (words < targets.min || words > targets.max) {
    flag(articleId, slug, section, 'word_count', 'info',
      `Word count ${words} outside editorial target ${targets.min}–${targets.max} for '${format}'`);
  }

  // Structure: paragraph count < 3
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 20);
  if (paragraphs.length < 3) {
    flag(articleId, slug, section, 'too_few_paragraphs', 'warning',
      `Only ${paragraphs.length} paragraph(s) — expected ≥ 3`);
  }

  // Structure: average paragraph > 200 words
  if (paragraphs.length > 0) {
    const avgWords = Math.round(words / paragraphs.length);
    if (avgWords > 200) {
      flag(articleId, slug, section, 'wall_of_text', 'warning',
        `Average paragraph length is ${avgWords} words — expected ≤ 200 (wall of text risk)`);
    }
  }
}

// ── Jaccard duplicate detection ───────────────────────────────────────────────

function tokenize(text) {
  return new Set(text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean));
}

function jaccard(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersect = 0;
  for (const t of setA) { if (setB.has(t)) intersect++; }
  return intersect / (setA.size + setB.size - intersect);
}

// ── Fetch all published content ───────────────────────────────────────────────

console.log('── Content Linter ──────────────────────────────────────');
console.log('Fetching published content...');

const allArticles = [];

const { data: newsRows, error: newsErr } = await sb
  .from('news_articles').select('id, slug, title, content');
if (newsErr) console.error('news_articles fetch error:', newsErr.message);
for (const row of newsRows ?? []) {
  allArticles.push({ id: row.id, slug: row.slug, title: row.title, content: row.content, section: 'news_articles', format: 'news' });
}

const { data: opinionRows, error: opErr } = await sb
  .from('blog_posts').select('id, slug, title, content').eq('category', 'Opinion');
if (opErr) console.error('blog_posts fetch error:', opErr.message);
for (const row of opinionRows ?? []) {
  allArticles.push({ id: row.id, slug: row.slug, title: row.title, content: row.content, section: 'blog_posts', format: 'opinion' });
}

const { data: reviewRows, error: revErr } = await sb
  .from('reviews').select('id, slug, title, content');
if (revErr) console.error('reviews fetch error:', revErr.message);
for (const row of reviewRows ?? []) {
  allArticles.push({ id: row.id, slug: row.slug, title: row.title, content: row.content, section: 'reviews', format: 'review' });
}

const { data: guideRows, error: guideErr } = await sb
  .from('guides').select('id, slug, title, content');
if (guideErr) console.error('guides fetch error:', guideErr.message);
for (const row of guideRows ?? []) {
  // guides.id is bigint — store as null in the uuid column, use slug as primary ref
  allArticles.push({ id: null, slug: row.slug, title: row.title, content: row.content, section: 'guides', format: 'guide' });
}

console.log(`Loaded ${allArticles.length} articles (${newsRows?.length ?? 0} news, ${opinionRows?.length ?? 0} opinion, ${reviewRows?.length ?? 0} reviews, ${guideRows?.length ?? 0} guides)\n`);

// ── Run per-article checks ────────────────────────────────────────────────────

for (const article of allArticles) {
  runChecks(article.content, article.slug, article.id, article.section, article.format);
}

// ── Duplicate detection (within each section) ─────────────────────────────────

console.log('\nRunning duplicate detection...');

const bySection = {};
for (const a of allArticles) {
  (bySection[a.section] ??= []).push(a);
}

for (const [section, group] of Object.entries(bySection)) {
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const a = group[i], b = group[j];

      const titleSim = jaccard(tokenize(a.title || ''), tokenize(b.title || ''));
      if (titleSim > 0.7) {
        flag(a.id, a.slug, section, 'duplicate_title', 'warning',
          `Title ${(titleSim * 100).toFixed(0)}% similar to "${b.slug}"`);
      }

      const aOpener = (a.content || '').split(/[.!?]/)[0] ?? '';
      const bOpener = (b.content || '').split(/[.!?]/)[0] ?? '';
      if (aOpener.length > 30 && bOpener.length > 30) {
        const openerSim = jaccard(tokenize(aOpener), tokenize(bOpener));
        if (openerSim > 0.8) {
          flag(a.id, a.slug, section, 'duplicate_opener', 'critical',
            `Opening sentence ${(openerSim * 100).toFixed(0)}% similar to "${b.slug}"`);
        }
      }
    }
  }
}

// ── Write issues to DB ────────────────────────────────────────────────────────

const criticalCount = issues.filter(i => i.severity === 'critical').length;
const warningCount  = issues.filter(i => i.severity === 'warning').length;
const infoCount     = issues.filter(i => i.severity === 'info').length;

console.log(`\n── Results ─────────────────────────────────────────────`);
console.log(`Articles checked : ${allArticles.length}`);
console.log(`Total issues     : ${issues.length}`);
console.log(`  Critical       : ${criticalCount}`);
console.log(`  Warnings       : ${warningCount}`);
console.log(`  Info           : ${infoCount}`);

if (issues.length > 0) {
  const BATCH = 200;
  let written = 0;
  for (let offset = 0; offset < issues.length; offset += BATCH) {
    const batch = issues.slice(offset, offset + BATCH);
    const { error } = await sb.from('content_quality_issues').insert(batch);
    if (error) {
      console.error('DB write error:', error.message);
    } else {
      written += batch.length;
    }
  }
  console.log(`\nWrote ${written} rows to content_quality_issues`);
} else {
  console.log('\nAll clean — nothing written to DB');
}

console.log('── Linter done ─────────────────────────────────────────');
