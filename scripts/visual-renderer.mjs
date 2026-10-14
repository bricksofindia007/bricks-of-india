/**
 * BOI Visual Renderer v2 — Playwright headless checks on live published pages.
 * Runs AFTER auto-fixer so it sees corrected pages.
 *
 * #430 (P11 item 3, approved): this job was 44% of the site's requests (1,028 full page loads a
 * day, ~33 requests each, ~9.1k uncached Worker renders, mostly Next <Link> RSC prefetches). Now:
 *   - scope: articles published/updated in the last CHANGED_HOURS (both viewports) plus a
 *     rotating daily sample of ~SAMPLE_PER_DAY others (desktop only), so every article is
 *     re-checked every ceil(total / SAMPLE_PER_DAY) days;
 *   - blocked: images, fonts, media, /_next/image, /api/img and every RSC / prefetch request.
 *     The hero check fetches only the hero's own URL once;
 *   - identifiable: UA suffix "BOI-QualityBot/1 (+https://bricksofindia.com/bot)";
 *   - reconcile only auto-resolves issues for articles/checks actually run (inScope).
 * Env: VR_CHANGED_HOURS (48), VR_SAMPLE_PER_DAY (50), VR_FULL=1 (old full sweep, both viewports);
 *      local smoke only: VR_LIMIT=<n>, VR_NO_WRITE=1 (skip the DB reconcile).
 * Writes issues to content_quality_issues.
 *
 * Usage: node --env-file=.env.local scripts/visual-renderer.mjs
 * CI: requires NEXT_PUBLIC_SITE_URL env var.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { reconcileIssues } from './lib/content-quality-reconcile.mjs';
import { CHECK_NAME_OWNERS } from './lib/content-quality-check-ownership.mjs';

// Single source of truth (scripts/lib/content-quality-check-ownership.mjs),
// CI-verified against every real flag(...) call in this file
// (.github/workflows/content-quality-ownership-lint.yml) -- see
// reconcileIssues' docstring for why this list must be exhaustive and scoped.
const OWNED_CHECK_NAMES = CHECK_NAME_OWNERS['visual-renderer.mjs'];

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

const UPDATED_AT = new Set(['reviews', 'guides']);  // news_articles / blog_posts have no updated_at
async function loadUrls(table, pathPrefix, extraFilter) {
  const rows = [];
  let offset = 0;
  const PAGE = 100;
  while (true) {
    let q = sb.from(table).select(`slug, title, hero_image, category, published_at${UPDATED_AT.has(table) ? ', updated_at' : ''}`).range(offset, offset + PAGE - 1);
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
const allArticles = [...news, ...opinion, ...reviews, ...guides];

// #430 scope: changed (both viewports) + rotating sample (desktop only)
const CHANGED_HOURS = Number(process.env.VR_CHANGED_HOURS ?? 48);
const SAMPLE_PER_DAY = Number(process.env.VR_SAMPLE_PER_DAY ?? 50);
const FULL = process.env.VR_FULL === '1';
const since = Date.now() - CHANGED_HOURS * 3600_000;
const changed = (a) => [a.published_at, a.updated_at].some((t) => t && Date.parse(t) >= since);
const buckets = Math.max(1, Math.ceil(allArticles.length / SAMPLE_PER_DAY));
const dayIndex = Math.floor(Date.now() / 86_400_000);
const bucketOf = (slug) => { let h = 2166136261; for (const ch of slug) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % buckets; };
const articles = FULL ? allArticles.map((a) => ({ ...a, _viewports: ['desktop', 'mobile'] }))
  : allArticles.flatMap((a) => changed(a) ? [{ ...a, _viewports: ['desktop', 'mobile'] }]
    : bucketOf(a.slug) === dayIndex % buckets ? [{ ...a, _viewports: ['desktop'] }] : []);
if (process.env.VR_LIMIT) articles.splice(Number(process.env.VR_LIMIT));  // local smoke tests only
const nChanged = articles.filter((a) => a._viewports.length === 2).length;
const loads = articles.reduce((k, a) => k + a._viewports.length, 0);
console.log(`Visual renderer: ${articles.length} of ${allArticles.length} articles (${FULL ? 'FULL sweep' : `${nChanged} changed in ${CHANGED_HOURS}h + ${articles.length - nChanged} rotating sample, bucket ${dayIndex % buckets}/${buckets}`}) = ${loads} page loads\n`);

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile',  width: 375,  height: 812 },
];
const MOBILE_ONLY = new Set(['horizontal_scroll', 'mobile_overflow']);
const DESKTOP_ONLY = new Set(['h1_missing', 'multiple_h1', 'image_render_broken', 'raw_markdown_visible', 'font_body']);
// What reconcile may auto-resolve: only checks actually run on articles actually loaded.
const ranOn = new Map(articles.map((a) => [a.slug, new Set(a._viewports)]));
const inScope = (slug, check) => {
  const v = ranOn.get(slug);
  if (!v) return false;
  if (MOBILE_ONLY.has(check)) return v.has('mobile');
  if (DESKTOP_ONLY.has(check)) return v.has('desktop');
  return true;
};

// Requests the checks don't need (#430): images, fonts, media, image transforms, RSC/prefetch.
const BLOCK_TYPES = new Set(['image', 'font', 'media']);
let blocked = 0, allowed = 0;
async function blockUnneeded(page) {
  await page.route('**/*', (route) => {
    const req = route.request();
    const url = req.url();
    const h = req.headers();
    if (BLOCK_TYPES.has(req.resourceType()) || url.includes('/_next/image') || url.includes('/api/img')
        || url.includes('_rsc=') || h['rsc'] === '1' || 'next-router-prefetch' in h || h['purpose'] === 'prefetch') {
      blocked++;
      return route.abort();
    }
    allowed++;
    return route.continue();
  });
}

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
// Identifiable UA (#430): Chromium's own UA plus our bot token, so Cloudflare and GA4 can tell it apart.
const baseUA = await (async () => { const p = await browser.newPage(); const ua = await p.evaluate(() => navigator.userAgent); await p.close(); return ua; })();
const context = await browser.newContext({ userAgent: `${baseUA} BOI-QualityBot/1 (+https://bricksofindia.com/bot)` });

for (const art of articles) {
  process.stdout.write(`  ${art.slug.slice(0, 50)}… `);
  const artIssues = [];

  for (const vp of VIEWPORTS.filter((v) => art._viewports.includes(v.name))) {
    const page = await context.newPage();
    await blockUnneeded(page);
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
    // #430: images are blocked in the page, so the hero is checked by fetching ONLY its own URL
    // (the src the page chose, e.g. its /_next/image variant) once: 200 + an image content-type +
    // non-empty body = it renders. One request instead of every image on the page.
    if (vp.name === 'desktop' && art.hero_image) {
      const heroSrc = await page.evaluate(() => {
        const img = document.querySelector('article img[src], main img[src], img[src]');
        return img ? (img.currentSrc || img.src) : null;
      });
      if (heroSrc) {
        let ok = false, why = '';
        try {
          const r = await context.request.get(heroSrc, { timeout: 15000 });
          const type = r.headers()['content-type'] ?? '';
          const len = (await r.body()).length;
          ok = r.ok() && type.startsWith('image/') && len > 0;
          why = `HTTP ${r.status()} ${type || 'no content-type'} ${len} bytes`;
        } catch (e) { why = e.message.slice(0, 80); }
        if (!ok) flag(art, 'image_render_broken', 'critical', `Hero image failed to load (${why}): ${heroSrc.slice(0, 120)}`);
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

await context.close();
await browser.close();

// ── Write to DB ───────────────────────────────────────────────────────────────
//
// BOI Fix Brief (2026-08-24), Phase 0.2 follow-up: this used to be a
// blind INSERT with no dedup, same as content-linter.mjs before that
// fix -- and after content-linter.mjs's fix added a partial unique
// index on (article_slug, check_name) WHERE resolved=false, this exact
// blind insert started hard-failing on every recurring visual issue
// ("duplicate key value violates unique constraint
// content_quality_issues_open_unique", confirmed live, 4 failed batches
// on the first run after that index existed -- and since Supabase
// batch-inserts fail atomically per batch of 50, an unknown number of
// genuinely-new issues in those same batches were silently lost too,
// not just the 4 duplicates). Now reconciles the same way content-
// linter.mjs does, scoped to this script's own check_names only.
console.log(`\nReconciling ${issues.length} visual issue(s)…`);
if (process.env.VR_NO_WRITE === '1') console.log('VR_NO_WRITE=1: not reconciling (local smoke test)', JSON.stringify(issues.map((i) => [i.article_slug, i.check_name, i.detail])));
else await reconcileIssues(sb, issues, OWNED_CHECK_NAMES, 'visual-renderer.mjs', { inScope });

// ── Summary ───────────────────────────────────────────────────────────────────

const counts = { critical: 0, warning: 0, info: 0 };
for (const i of issues) counts[i.severity] = (counts[i.severity] || 0) + 1;

console.log(`\nVisual renderer complete: ${articles.length} articles, ${desktopChecked + mobileChecked} page loads (${desktopChecked} desktop, ${mobileChecked} mobile); requests allowed ${allowed}, blocked ${blocked}`);
console.log(`Critical: ${counts.critical} | Warning: ${counts.warning}`);
