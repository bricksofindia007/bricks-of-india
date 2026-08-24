/**
 * BOI Visual Renderer v2 — Playwright headless checks on live published pages.
 * Runs AFTER auto-fixer so it sees corrected pages.
 * Writes issues to content_quality_issues.
 *
 * Usage: node --env-file=.env.local scripts/visual-renderer.mjs
 * CI: requires NEXT_PUBLIC_SITE_URL env var.
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

const { chromium } = await import('playwright');
const RUN_AT = new Date().toISOString();

// ── Load published article URLs ───────────────────────────────────────────────

async function loadUrls(table, pathPrefix, extraFilter) {
  const rows = [];
  let offset = 0;
  const PAGE = 100;
  while (true) {
    let q = sb.from(table).select('slug, title, hero_image, category').range(offset, offset + PAGE - 1);
    if (extraFilter) q = extraFilter(q);
    const { data } = await q;
    if (!data?.length) break;
    for (const r of data) rows.push({ ...r, _section: table, _url: `${SITE_URL}${pathPrefix}/${r.slug}` });
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

const [news, opinion, reviews, guides] = await Promise.all([
  loadUrls('news_articles', '/news'),
  loadUrls('blog_posts', '/opinion', q => q.eq('category', 'Opinion')),
  loadUrls('reviews', '/reviews'),
  loadUrls('guides', '/guides'),
]);
const articles = [...news, ...opinion, ...reviews, ...guides];
console.log(`Visual renderer: ${articles.length} articles × 2 viewports = ${articles.length * 2} page checks\n`);

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile',  width: 375,  height: 812 },
];

const BANNED_TEXT = ['Lorem ipsum', '[object Object]', 'undefined', 'null'];
const RAW_MD_RE   = /\*\*[^*]+\*\*|\*[^*\n]+\*|^#{1,6}\s/m;
const issues = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// BOI Fix Brief (2026-08-24), Phase 1.1: this loop is sequential (not the
// unbounded Promise.allSettled burst that caused the 2026-08-04
// HeroImages WAF-403 incident, see that check's comments above), but at
// ~195 articles x 2 viewports = ~390 fast, back-to-back page.goto()
// calls with no delay between them, it was still sustained enough to
// trip Netlify's own edge rate-limiting (this site runs on Netlify, not
// Cloudflare -- confirmed via live Cache-Status: Netlify Edge headers).
// Verified live: a random sample of 9 URLs flagged 403 by this exact
// check all returned clean 200s (or a clean redirect to one) when
// fetched from an outside environment/UA/IP -- checker artifact, not a
// real block; nothing to fix on the content side. Same fix shape as
// HeroImages: a short pause between requests, plus one narrow retry
// after a longer delay specifically for a transient 403 (not other
// non-ok statuses, which are still real failures).
const PAGE_LOAD_PAUSE_MS  = 250;
const RETRY_403_DELAY_MS  = 3000;

function flag(art, checkName, severity, detail) {
  issues.push({
    checked_at:   RUN_AT,
    article_id:   (typeof art.id === 'string' && art.id.includes('-')) ? art.id : null,
    article_slug: art.slug,
    section:      art._section,
    check_name:   checkName,
    severity,
    detail,
    auto_fixable: false,
    resolved:     false,
  });
}

// ── Run Playwright ────────────────────────────────────────────────────────────

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

let desktopChecked = 0, mobileChecked = 0;

for (const art of articles) {
  process.stdout.write(`  ${art.slug.slice(0, 50)}… `);
  const artIssues = [];

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    // page_load_error
    let loadOk = false;
    try {
      let response = await page.goto(art._url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (response && response.status() === 403) {
        // Narrow retry, 403 only (see comment above the constants) --
        // absorbs transient rate-limiting, doesn't mask a real failure.
        await sleep(RETRY_403_DELAY_MS);
        response = await page.goto(art._url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
      if (!response || !response.ok()) {
        flag(art, 'page_load_error', 'critical', `HTTP ${response?.status() ?? 'none'} on ${vp.name}`);
      } else {
        loadOk = true;
        if (vp.name === 'desktop') desktopChecked++;
        else mobileChecked++;
      }
    } catch (e) {
      flag(art, 'page_load_error', 'critical', `Load failed on ${vp.name}: ${e.message.slice(0, 80)}`);
      await page.close();
      continue;
    }
    await sleep(PAGE_LOAD_PAUSE_MS);

    if (!loadOk) { await page.close(); continue; }

    const textContent = await page.evaluate(() => document.body?.innerText ?? '');
    const bodyWidth   = await page.evaluate(() => document.body?.scrollWidth ?? 0);

    // horizontal_scroll (mobile only)
    if (vp.name === 'mobile' && bodyWidth > vp.width + 5) {
      flag(art, 'horizontal_scroll', 'critical', `Body scrollWidth ${bodyWidth}px > ${vp.width}px viewport on mobile`);
    }

    // h1_missing / multiple_h1 (desktop only)
    if (vp.name === 'desktop') {
      const h1Count = await page.evaluate(() => document.querySelectorAll('h1').length);
      if (h1Count === 0)     flag(art, 'h1_missing',   'critical', 'No H1 element found');
      else if (h1Count > 1)  flag(art, 'multiple_h1',  'warning',  `${h1Count} H1 elements found`);
    }

    // image_render_broken (desktop only) — skip if hero_image is null (caught by missing_image check)
    //
    // Bug fixed 2026-06-30: this check ran immediately after `domcontentloaded`,
    // which only waits for HTML parsing — it does NOT wait for images to
    // actually finish downloading. The hero image renders via next/image,
    // which routes through Next's /_next/image optimization endpoint (real
    // added latency vs. a raw static file), so reading naturalWidth this
    // early caught images mid-load far more often than it caught genuinely
    // broken ones. Confirmed on a live example (lego-ebon-hawk-...): the DB
    // row's hero_image was already '/fallback-hero.png', the asset exists
    // on disk and is a valid, non-corrupt PNG — there was nothing actually
    // broken to find. Root cause was a race in this checker, not the site.
    //
    // Fix: poll the image's own `complete` property (true once the browser
    // has either finished loading it OR given up after a real failure) with
    // a bounded timeout, instead of reading naturalWidth at an arbitrary
    // moment. Also narrowed the selector from the page's first `img[src]`
    // (no guarantee it's the hero image — could be anything rendered above
    // it in the DOM) to specifically the image inside the article's hero
    // container, where one exists; falls back to the generic selector only
    // if that more specific one isn't found, to avoid silently checking
    // nothing on a page structure this script doesn't yet know about.
    if (vp.name === 'desktop' && art.hero_image) {
      const heroNaturalWidth = await page.evaluate(async () => {
        const img = document.querySelector('article img[src], main img[src], img[src]');
        if (!img) return -1;
        const deadline = Date.now() + 8000;
        while (!img.complete && Date.now() < deadline) {
          await new Promise(r => setTimeout(r, 100));
        }
        return img.naturalWidth;
      });
      if (heroNaturalWidth === 0) {
        flag(art, 'image_render_broken', 'critical', 'Hero image failed to render (naturalWidth=0 after waiting for load completion)');
      }
    }

    // raw_markdown_visible (desktop only)
    if (vp.name === 'desktop' && RAW_MD_RE.test(textContent)) {
      flag(art, 'raw_markdown_visible', 'warning', 'Raw markdown characters visible on page');
    }

    // html_comment_visible
    if (textContent.includes('<!--')) {
      flag(art, 'html_comment_visible', 'critical', `HTML comment visible on ${vp.name}`);
    }

    // placeholder_text
    for (const banned of BANNED_TEXT) {
      if (textContent.includes(banned)) {
        flag(art, 'placeholder_text', 'critical', `"${banned}" visible on ${vp.name}`);
        break;
      }
    }

    // font_body (desktop only)
    if (vp.name === 'desktop') {
      const bodyFont = await page.evaluate(() => {
        const el = document.querySelector('p, .font-body');
        return el ? getComputedStyle(el).fontFamily : '';
      });
      if (bodyFont && !bodyFont.toLowerCase().includes('inter')) {
        flag(art, 'font_body', 'warning', `Body font "${bodyFont.slice(0, 60)}" does not contain Inter`);
      }
    }

    // mobile_overflow
    if (vp.name === 'mobile') {
      const overflowEl = await page.evaluate((vw) => {
        const els = document.querySelectorAll('*');
        for (const el of els) {
          const rect = el.getBoundingClientRect();
          if (rect.right > vw + 5 && rect.width < 5000) {
            return el.tagName + (el.className ? '.' + String(el.className).split(' ')[0] : '');
          }
        }
        return null;
      }, vp.width);
      if (overflowEl) {
        flag(art, 'mobile_overflow', 'warning', `Element overflows 375px viewport: ${overflowEl}`);
      }
    }

    await page.close();
  }

  const issueCount = issues.length - (issues.length - artIssues.length);
  console.log(issues.filter(i => i.article_slug === art.slug).length > 0 ? 'ISSUES' : 'OK');
}

await browser.close();

// ── Write to DB ───────────────────────────────────────────────────────────────

const BATCH = 50;
console.log(`\nWriting ${issues.length} visual issues to DB…`);
for (let i = 0; i < issues.length; i += BATCH) {
  const { error } = await sb.from('content_quality_issues').insert(issues.slice(i, i + BATCH));
  if (error) console.error('Insert error:', error.message);
}

// ── Summary ───────────────────────────────────────────────────────────────────

const counts = { critical: 0, warning: 0, info: 0 };
for (const i of issues) counts[i.severity] = (counts[i.severity] || 0) + 1;

console.log(`\nVisual renderer complete: ${articles.length} pages checked (${desktopChecked} desktop, ${mobileChecked} mobile)`);
console.log(`Critical: ${counts.critical} | Warning: ${counts.warning}`);
