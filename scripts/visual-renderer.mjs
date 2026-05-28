/**
 * Visual Renderer — Playwright headless checks on live published pages.
 * Detect-only. Never modifies content. Writes issues to content_quality_issues.
 *
 * DO NOT RUN LOCALLY until content-linter confirms a clean run first.
 * Requires live site at NEXT_PUBLIC_SITE_URL (needs Playwright + chromium).
 *
 * Run: node --env-file=.env.local scripts/visual-renderer.mjs
 */

import { chromium } from 'playwright';
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
const CHROME_PATH  = process.env.CHROME_PATH;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Issue accumulator ─────────────────────────────────────────────────────────

/** @type {object[]} */
const issues = [];

function flag(slug, section, checkName, severity, detail) {
  issues.push({ article_id: null, article_slug: slug, section, check_name: checkName, severity, detail });
  console.log(`  ${severity === 'critical' ? '❌' : '⚠️ '} [${slug}] ${checkName}: ${detail}`);
}

// ── Build page list from DB ───────────────────────────────────────────────────

console.log('── Visual Renderer ─────────────────────────────────────');
console.log(`Target: ${SITE_URL}`);

const pages = [];

const { data: newsRows }    = await sb.from('news_articles').select('slug');
const { data: opinionRows } = await sb.from('blog_posts').select('slug').eq('category', 'Opinion');
const { data: reviewRows }  = await sb.from('reviews').select('slug');
const { data: guideRows }   = await sb.from('guides').select('slug');

for (const r of newsRows    ?? []) pages.push({ path: `/news/${r.slug}`,    slug: r.slug, section: 'news_articles' });
for (const r of opinionRows ?? []) pages.push({ path: `/opinion/${r.slug}`, slug: r.slug, section: 'blog_posts' });
for (const r of reviewRows  ?? []) pages.push({ path: `/reviews/${r.slug}`, slug: r.slug, section: 'reviews' });
for (const r of guideRows   ?? []) pages.push({ path: `/guides/${r.slug}`,  slug: r.slug, section: 'guides' });

console.log(`Checking ${pages.length} pages at desktop (1280×800) + mobile (375×812)\n`);

// ── Playwright setup ──────────────────────────────────────────────────────────

const launchArgs = {
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  headless: true,
};
if (CHROME_PATH) launchArgs.executablePath = CHROME_PATH;

const browser = await chromium.launch(launchArgs);

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile',  width: 375,  height: 812, isMobile: true },
];

// ── Checks per page ───────────────────────────────────────────────────────────

async function checkPage(page, url, slug, section, viewportName) {
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  if (!resp || resp.status() >= 400) {
    flag(slug, section, 'http_error', 'critical', `${url} returned HTTP ${resp?.status() ?? 'no response'} on ${viewportName}`);
    return;
  }

  // H1: must be exactly one
  const h1Count = await page.locator('h1').count();
  if (h1Count === 0) {
    flag(slug, section, 'missing_h1', 'critical', `No <h1> found on ${viewportName}`);
  } else if (h1Count > 1) {
    flag(slug, section, 'multiple_h1', 'warning', `${h1Count} <h1> elements found on ${viewportName} — expected exactly 1`);
  }

  // Heading hierarchy: no h3 without a preceding h2
  const hasH3 = (await page.locator('h3').count()) > 0;
  const hasH2 = (await page.locator('h2').count()) > 0;
  if (hasH3 && !hasH2) {
    flag(slug, section, 'heading_hierarchy', 'warning', `<h3> found without a preceding <h2> on ${viewportName}`);
  }

  // Raw markdown visible in page text
  const bodyText = await page.evaluate(() => document.body.innerText);
  if (/\*\*[^*]{1,80}\*\*/.test(bodyText)) {
    flag(slug, section, 'raw_markdown_bold', 'critical', `Raw **bold** markdown visible in rendered page on ${viewportName}`);
  }
  if (/^#{1,3}\s/m.test(bodyText)) {
    flag(slug, section, 'raw_markdown_heading', 'critical', `Raw # heading markdown visible in rendered page on ${viewportName}`);
  }

  // [object Object] in text
  if (bodyText.includes('[object Object]')) {
    flag(slug, section, 'object_object', 'critical', `[object Object] visible in rendered page on ${viewportName}`);
  }

  // Horizontal scroll on mobile
  if (viewportName === 'mobile') {
    const hasScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (hasScroll) {
      flag(slug, section, 'horizontal_scroll', 'warning', 'Horizontal scroll detected on mobile (375px viewport)');
    }
  }

  // Hero image: check first article img
  const firstImg = page.locator('article img, main img').first();
  const imgCount = await page.locator('article img, main img').count();
  if (imgCount > 0) {
    const src = await firstImg.getAttribute('src').catch(() => null);
    const alt = await firstImg.getAttribute('alt').catch(() => null);

    if (!src) {
      flag(slug, section, 'hero_no_src', 'critical', `Hero image has no src on ${viewportName}`);
    } else {
      // Verify image HTTP status
      const imgUrl = src.startsWith('http') ? src : `${SITE_URL}${src}`;
      try {
        const imgRes = await fetch(imgUrl, { method: 'HEAD', signal: AbortSignal.timeout(8_000) });
        if (!imgRes.ok) {
          flag(slug, section, 'hero_broken', 'critical', `Hero image HTTP ${imgRes.status}: ${imgUrl}`);
        }
      } catch (e) {
        flag(slug, section, 'hero_fetch_error', 'warning', `Hero image fetch failed: ${e.message.slice(0, 60)}`);
      }

      // Placeholder check (Next.js blur placeholder or generic placeholder text)
      if (src.includes('data:image') || src.includes('blur') || src.includes('placeholder')) {
        flag(slug, section, 'hero_placeholder', 'warning', `Hero image appears to be a placeholder on ${viewportName}: ${src.slice(0, 60)}`);
      }
    }

    if (!alt || alt.trim().length === 0) {
      flag(slug, section, 'hero_no_alt', 'warning', `Hero image missing alt text on ${viewportName}`);
    }
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────

let checked = 0;
const CONCURRENCY = 4;

async function processPage(p) {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile ?? false,
      userAgent: vp.isMobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    try {
      await checkPage(page, `${SITE_URL}${p.path}`, p.slug, p.section, vp.name);
    } catch (e) {
      flag(p.slug, p.section, 'page_error', 'critical', `${vp.name} check threw: ${e.message.slice(0, 80)}`);
    } finally {
      await context.close();
    }
  }
  checked++;
  if (checked % 10 === 0) console.log(`  Progress: ${checked}/${pages.length}`);
}

// Process in batches to avoid overwhelming the server
for (let i = 0; i < pages.length; i += CONCURRENCY) {
  await Promise.all(pages.slice(i, i + CONCURRENCY).map(processPage));
}

await browser.close();

// ── Write issues to DB ────────────────────────────────────────────────────────

const criticalCount = issues.filter(i => i.severity === 'critical').length;
const warningCount  = issues.filter(i => i.severity === 'warning').length;

console.log(`\n── Results ─────────────────────────────────────────────`);
console.log(`Pages checked  : ${pages.length} × ${VIEWPORTS.length} viewports`);
console.log(`Total issues   : ${issues.length} (${criticalCount} critical, ${warningCount} warnings)`);

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
  console.log(`Wrote ${written} rows to content_quality_issues`);
} else {
  console.log('All visual checks passed — nothing written to DB');
}

console.log('── Visual renderer done ────────────────────────────────');
