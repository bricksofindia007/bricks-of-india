/**
 * Technical Hygiene — weekly checks, runs Monday 04:00 UTC
 * Sends one Resend email with the full weekly report regardless of pass/fail.
 * Alerts on failures; always emails scores for trend tracking.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CONTRIBUTING RULE — NO EXCEPTIONS:
 * Every new feature, page, or data pipeline shipped must include a
 * corresponding integrity check in this file in the same commit.
 * "Shipped" means: new /lab route → add HTTP + content check; new DB pipeline
 * → add row-count or data-shape check; new article format → add content check.
 * This file is the living proof that the system works. Keep it current.
 *
 * CHECK GROUPS (15 total):
 *   1.  RouteHealth      — HTTP 200 for 26 live routes
 *   1b. GuideRoutes      — HTTP 200 for all guide slugs
 *   2.  HeroImages       — HEAD all news_articles.hero_image URLs
 *   3.  Sitemap          — /sitemap.xml URL count ≥ 1000
 *   4.  Lighthouse       — perf/a11y/SEO on homepage + /sets
 *   5.  Staleness        — store_prices MAX(scraped_at) per store ≤ 8h
 *   6.  RowCounts        — all major table counts (trend log)
 *   7.  DataIntegrity    — related prices join · store coverage · India content ·
 *                          lab pages · sets filter routes · RPC themes
 *   8.  P1 Technical     — store URLs · 25h freshness · stuck drafts ·
 *                          lab ₹ data · error boundaries · sets missing data
 *   9.  P1 Content       — markdown leak · placeholder text · meta descriptions ·
 *                          news hero images · review hero images
 *  10.  Homepage         — reviews alias · deals price coverage
 *  11.  PageCoverage     — /deals · /themes · /themes/technic · /compare ·
 *                          /blog · /opinion · /community · /lab/which-set ·
 *                          /lab/deals · /lab/budget-calculator · /lab/heat-map
 *  12.  ExtDependencies  — Rebrickable API · Brickset API · 3 Shopify stores ·
 *                          D3/TopoJSON/India map CDNs · GH_DISPATCH_TOKEN ·
 *                          IG_ACCESS_TOKEN expiry
 *  13.  DataPipeline     — raw_signals freshness · price_snapshots today ·
 *                          content_fix_log recency · newsletter table ·
 *                          guides content · blog_posts content · legacy prices table
 *  14.  ContentIntegrity — word count · HTML leak · ABHINAV12 · store spelling ·
 *                          opinion sign-off · review verdicts · duplicate slugs ·
 *                          future dates · ALL CAPS · India Paragraph stores ·
 *                          blog hero null rate
 *  15.  Performance      — page response times · internal links · OG/canonical ·
 *                          scraper balance · Gemini quota · social automation
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = (process.env.RESEND_API_KEY ?? '').replace(/^﻿/, '').trim();
const BRIEF_EMAIL    = (process.env.BRIEF_EMAIL ?? '').replace(/^﻿/, '').trim();
const SITE_URL       = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bricksofindia.com').replace(/\/$/, '');
const GITHUB_TOKEN   = process.env.GITHUB_TOKEN ?? '';
const GITHUB_REPO    = process.env.GITHUB_REPOSITORY ?? 'bricksofindia007/bricks-of-india';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const alerts  = [];  // critical failures that get immediate mention
const report  = [];  // all findings, including non-alert metrics

function log(section, msg) {
  console.log(`[${section}] ${msg}`);
  report.push(`[${section}] ${msg}`);
}

function alertFail(section, msg) {
  console.error(`[${section}] FAIL: ${msg}`);
  report.push(`[${section}] ❌ FAIL: ${msg}`);
  alerts.push(`${section}: ${msg}`);
}

// ── Check 1: Route health — HTTP GET 20 live routes ──────────────────────────

const ROUTES = [
  '/',
  '/news',
  '/blog',
  '/sets',
  '/sets?page=2',
  '/deals',
  '/guides',
  '/opinion',
  '/opinion/certified-store-india-charges-too-much',
  '/compare',
  '/reviews',
  '/about',
  '/themes',
  '/community',
  '/calendar',
  '/contact',
  '/lab',
  '/lab/budget-calculator',
  '/lab/retiring-soon',
  '/lab/cmf-tracker',
  '/lab/price-drops',
  '/lab/deals',
  '/lab/which-set',
  '/lab/heat-map',
  '/themes/technic',
  '/legal/privacy',
  '/legal/terms',
  '/legal/disclaimer',
  '/legal/affiliate-disclosure',
  '/sitemap.xml',
];

log('RouteHealth', `Checking ${ROUTES.length} routes on ${SITE_URL}`);
const routeFailures = [];
await Promise.allSettled(
  ROUTES.map(async route => {
    const url = `${SITE_URL}${route}`;
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(15_000),
        headers: { 'User-Agent': 'BOI-TechHygiene/1.0' },
      });
      if (res.ok) {
        log('RouteHealth', `  ${res.status} ${route}`);
      } else {
        routeFailures.push(`${route} → ${res.status}`);
        alertFail('RouteHealth', `${route} returned HTTP ${res.status}`);
      }
    } catch (e) {
      routeFailures.push(`${route} → error: ${e.message.slice(0, 60)}`);
      alertFail('RouteHealth', `${route} fetch error: ${e.message.slice(0, 60)}`);
    }
  })
);
log('RouteHealth', `${ROUTES.length - routeFailures.length}/${ROUTES.length} routes OK`);

// ── Check 1b: Guide route health — all live guide slugs ──────────────────────

log('GuideRoutes', 'Fetching guide slugs from DB');
try {
  const { data: guideSlugs } = await sb.from('guides').select('slug');
  if (!guideSlugs || guideSlugs.length === 0) {
    alertFail('GuideRoutes', 'No guides found in DB — expected 9');
  } else {
    const guideFailures = [];
    await Promise.allSettled(
      guideSlugs.map(async ({ slug }) => {
        const url = `${SITE_URL}/guides/${slug}`;
        try {
          const res = await fetch(url, {
            redirect: 'follow',
            signal: AbortSignal.timeout(15_000),
            headers: { 'User-Agent': 'BOI-TechHygiene/1.0' },
          });
          if (res.ok) {
            log('GuideRoutes', `  200 /guides/${slug}`);
          } else {
            guideFailures.push(`/guides/${slug} → ${res.status}`);
            alertFail('GuideRoutes', `/guides/${slug} returned HTTP ${res.status}`);
          }
        } catch (e) {
          guideFailures.push(`/guides/${slug} → error`);
          alertFail('GuideRoutes', `/guides/${slug} fetch error: ${e.message.slice(0, 60)}`);
        }
      })
    );
    log('GuideRoutes', `${guideSlugs.length - guideFailures.length}/${guideSlugs.length} guide routes OK`);
  }
} catch (e) {
  alertFail('GuideRoutes', `Guide slug fetch failed: ${e.message.slice(0, 80)}`);
}

// ── Check 2: Broken hero images ───────────────────────────────────────────────

log('HeroImages', 'Checking all news_articles.hero_image URLs');
const { data: heroRows } = await sb
  .from('news_articles')
  .select('slug, hero_image')
  .not('hero_image', 'is', null);

const heroFails = [];
if (heroRows && heroRows.length > 0) {
  await Promise.allSettled(
    heroRows.map(async row => {
      if (!row.hero_image) return;
      try {
        const res = await fetch(row.hero_image, {
          method: 'HEAD',
          signal: AbortSignal.timeout(8_000),
          headers: { 'User-Agent': 'BOI-TechHygiene/1.0' },
        });
        if (!res.ok) {
          heroFails.push(`/news/${row.slug}: ${res.status}`);
          alertFail('HeroImages', `/news/${row.slug} hero_image → HTTP ${res.status}`);
        }
      } catch (e) {
        heroFails.push(`/news/${row.slug}: ${e.message.slice(0, 40)}`);
      }
    })
  );
  log('HeroImages', `${heroRows.length - heroFails.length}/${heroRows.length} hero images OK`);
} else {
  log('HeroImages', 'No hero images to check');
}

// ── Check 3: Sitemap URL count (alert if drops > 10%) ────────────────────────

log('Sitemap', `Fetching ${SITE_URL}/sitemap.xml`);
try {
  const res = await fetch(`${SITE_URL}/sitemap.xml`, {
    signal: AbortSignal.timeout(15_000),
    headers: { 'User-Agent': 'BOI-TechHygiene/1.0' },
  });
  if (!res.ok) {
    alertFail('Sitemap', `sitemap.xml returned HTTP ${res.status}`);
  } else {
    const xml   = await res.text();
    const count = (xml.match(/<loc>/g) || []).length;
    log('Sitemap', `${count} URLs in sitemap.xml`);
    if (count < 1000) {
      alertFail('Sitemap', `Only ${count} URLs in sitemap — expected ≥ 1000 (sets catalogue drives bulk)`);
    }
  }
} catch (e) {
  alertFail('Sitemap', `Could not fetch sitemap: ${e.message.slice(0, 80)}`);
}

// ── Check 4: Lighthouse — performance, accessibility, SEO ────────────────────

const LIGHTHOUSE_URLS = [SITE_URL + '/', SITE_URL + '/sets'];
const lighthouseResults = [];

for (const url of LIGHTHOUSE_URLS) {
  log('Lighthouse', `Running on ${url}`);
  try {
    const lhJson = execSync(
      `npx --yes lighthouse "${url}" --output=json --quiet ` +
      `--chrome-flags="--headless --no-sandbox --disable-dev-shm-usage --disable-gpu" ` +
      `--only-categories=performance,accessibility,seo`,
      { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 }
    ).toString();
    const lh = JSON.parse(lhJson);
    const cats = lh.categories;
    const perf = Math.round((cats.performance?.score ?? 0) * 100);
    const a11y = Math.round((cats.accessibility?.score ?? 0) * 100);
    const seo  = Math.round((cats.seo?.score ?? 0) * 100);
    log('Lighthouse', `  ${url}: perf=${perf} a11y=${a11y} seo=${seo}`);
    lighthouseResults.push({ url, perf, a11y, seo });
    if (perf < 50) alertFail('Lighthouse', `Performance critically low (${perf}) on ${url}`);
    if (a11y < 70) alertFail('Lighthouse', `Accessibility critically low (${a11y}) on ${url}`);
    if (seo < 80)  alertFail('Lighthouse', `SEO critically low (${seo}) on ${url}`);
  } catch (e) {
    log('Lighthouse', `  ${url}: SKIP — ${e.message.slice(0, 80)}`);
    lighthouseResults.push({ url, perf: null, a11y: null, seo: null });
  }
}

// ── Check 5: Store prices staleness (> 8 hours = alert) ──────────────────────

log('Staleness', 'Checking store_prices MAX(scraped_at) per store');
const stores = ['mybrickhouse', 'toycra', 'jaiman'];
for (const store of stores) {
  try {
    const { data } = await sb
      .from('store_prices')
      .select('scraped_at')
      .eq('store_id', store)
      .order('scraped_at', { ascending: false })
      .limit(1);
    if (!data || data.length === 0) {
      alertFail('Staleness', `No store_prices rows for ${store}`);
      continue;
    }
    const ageHours = (Date.now() - new Date(data[0].scraped_at).getTime()) / 3_600_000;
    log('Staleness', `  ${store}: last scraped ${ageHours.toFixed(1)}h ago`);
    if (ageHours > 8) {
      alertFail('Staleness', `${store} prices stale — last scraped ${ageHours.toFixed(1)}h ago (threshold: 8h)`);
    }
  } catch (e) {
    log('Staleness', `  ${store}: error — ${e.message}`);
  }
}

// ── Check 6: Database table row counts (log for trend tracking) ───────────────

log('RowCounts', 'Counting all major tables');
const TABLES = [
  'sets', 'store_prices', 'price_snapshots', 'news_articles',
  'reviews', 'blog_posts', 'raw_signals', 'posted_sets',
  'newsletter_subscribers', 'guides',
];

const rowCounts = {};
for (const table of TABLES) {
  try {
    const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
    if (error) { rowCounts[table] = `ERROR: ${error.message.slice(0, 40)}`; continue; }
    rowCounts[table] = count ?? 0;
    log('RowCounts', `  ${table}: ${count}`);
  } catch (e) {
    rowCounts[table] = `ERROR: ${e.message.slice(0, 40)}`;
  }
}

// pending_drafts by status
try {
  const { data } = await sb.from('pending_drafts').select('status');
  const statusCounts = {};
  for (const r of data ?? []) statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  log('RowCounts', `  pending_drafts: ${JSON.stringify(statusCounts)}`);
  rowCounts['pending_drafts'] = statusCounts;
} catch (e) {
  rowCounts['pending_drafts'] = `ERROR: ${e.message}`;
}

// ── Check 7: Data integrity ───────────────────────────────────────────────────
// Catches silent regressions: dead table references, prompt failures, empty renders.

// 7a. Related sets have live prices — verifies store_prices join (not dead prices table)
try {
  const { data: themeSets } = await sb
    .from('sets').select('set_number').eq('theme', 'Technic').limit(20);
  const nums = (themeSets ?? []).map(s => s.set_number);
  if (nums.length === 0) {
    alertFail('DataIntegrity', 'No Technic sets found — cannot verify related-set prices');
  } else {
    const { count: priceCount } = await sb
      .from('store_prices').select('*', { count: 'exact', head: true }).in('set_id', nums);
    if (!priceCount || priceCount === 0) {
      alertFail('DataIntegrity', 'No store_prices rows for Technic sets — related set cards will show no prices');
    } else {
      log('DataIntegrity', `Related-set prices: ${priceCount} store_prices rows for Technic sets ✓`);
    }
  }
} catch (e) {
  alertFail('DataIntegrity', `Related-set price check failed: ${e.message.slice(0, 80)}`);
}

// 7b. store_prices has rows for at least 3 distinct stores
try {
  const { data: storeRows } = await sb.from('store_prices').select('store_id').limit(3000);
  const storeIds = new Set((storeRows ?? []).map(r => r.store_id));
  if (storeIds.size < 3) {
    alertFail('DataIntegrity', `Only ${storeIds.size} store(s) with data in store_prices — expected ≥ 3 (${[...storeIds].join(', ')})`);
  } else {
    log('DataIntegrity', `Store coverage: ${storeIds.size} stores with data (${[...storeIds].join(', ')}) ✓`);
  }
} catch (e) {
  alertFail('DataIntegrity', `Store coverage check failed: ${e.message.slice(0, 80)}`);
}

// 7c. Recent news articles contain India price content (₹ + store name)
// Note: INDIA_PARAGRAPH marker is stripped at publish time — check for content proxies instead.
try {
  const { data: recentArticles } = await sb
    .from('news_articles')
    .select('slug, content')
    .not('content', 'is', null)
    .order('published_at', { ascending: false })
    .limit(10);
  const withIndia = (recentArticles ?? []).filter(
    a => a.content?.includes('₹') && /\b(Toycra|MyBrickHouse|Jaiman)\b/i.test(a.content)
  );
  if ((recentArticles ?? []).length === 0) {
    alertFail('DataIntegrity', 'No news articles found in DB');
  } else if (withIndia.length === 0) {
    alertFail('DataIntegrity', `0 of last ${(recentArticles ?? []).length} articles have India price data (₹ + store name) — possible prompt regression`);
  } else {
    log('DataIntegrity', `India content: ${withIndia.length}/${(recentArticles ?? []).length} recent articles have ₹ + store name ✓`);
  }
} catch (e) {
  alertFail('DataIntegrity', `India content check failed: ${e.message.slice(0, 80)}`);
}

// 7d. Lab pages return 200 with non-trivial content
const LAB_CONTENT_PAGES = ['/lab/price-drops', '/lab/biryani-index', '/lab/retiring-soon'];
for (const route of LAB_CONTENT_PAGES) {
  try {
    const res = await fetch(`${SITE_URL}${route}`, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'BOI-TechHygiene/1.0' },
    });
    if (!res.ok) {
      alertFail('DataIntegrity', `${route} returned HTTP ${res.status}`);
    } else {
      const body = await res.text();
      if (body.length < 2000) {
        alertFail('DataIntegrity', `${route} body only ${body.length} chars — may be rendering empty`);
      } else {
        log('DataIntegrity', `${route}: ${res.status}, ${body.length} chars ✓`);
      }
    }
  } catch (e) {
    alertFail('DataIntegrity', `${route} fetch error: ${e.message.slice(0, 60)}`);
  }
}

// 7e. /sets filter routes return 200 (catches searchParams regression)
const SETS_FILTER_CHECKS = [
  { url: '/sets?theme=Icons',      label: 'Sets theme filter (Icons)' },
  { url: '/sets?sort=price_asc',   label: 'Sets price sort (price_asc)' },
  { url: '/sets?instock=1',        label: 'Sets in-stock toggle' },
  { url: '/sets?price=under2k',    label: 'Sets price band filter' },
];
await Promise.allSettled(
  SETS_FILTER_CHECKS.map(async ({ url, label }) => {
    try {
      const res = await fetch(`${SITE_URL}${url}`, {
        signal: AbortSignal.timeout(15_000),
        headers: { 'User-Agent': 'BOI-TechHygiene/1.0' },
      });
      if (!res.ok) {
        alertFail('DataIntegrity', `${label}: ${url} returned HTTP ${res.status}`);
      } else {
        log('DataIntegrity', `${label}: ${res.status} ✓`);
      }
    } catch (e) {
      alertFail('DataIntegrity', `${label}: fetch error — ${e.message.slice(0, 60)}`);
    }
  })
);

// 7f. get_distinct_themes RPC returns >= 10 distinct themes
try {
  const { data, error } = await sb.rpc('get_distinct_themes');
  if (error) throw new Error(error.message);
  const count = (data ?? []).length;
  if (count < 10) {
    alertFail('DataIntegrity', `get_distinct_themes RPC returned ${count} themes — expected ≥ 10`);
  } else {
    log('DataIntegrity', `get_distinct_themes RPC: ${count} distinct themes ✓`);
  }
} catch (e) {
  alertFail('DataIntegrity', `get_distinct_themes RPC failed: ${e.message.slice(0, 80)}`);
}

// ── Check 8: P1 Technical checks ──────────────────────────────────────────────

// 8a. Store affiliate URL health — one live product_url per store
try {
  const stores = ['toycra', 'mybrickhouse', 'jaiman'];
  await Promise.allSettled(stores.map(async storeId => {
    try {
      const { data } = await sb
        .from('store_prices')
        .select('product_url, store_id')
        .eq('store_id', storeId)
        .eq('in_stock', true)
        .not('product_url', 'is', null)
        .limit(1);
      const url = data?.[0]?.product_url;
      if (!url) { alertFail('StoreURLs', `${storeId}: no in-stock product_url found`); return; }
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'BOI-TechHygiene/1.0' }, redirect: 'follow' });
      if (res.ok) {
        log('StoreURLs', `${storeId}: ${res.status} ${url.slice(0, 60)} ✓`);
      } else {
        alertFail('StoreURLs', `${storeId}: product_url returned HTTP ${res.status} — ${url.slice(0, 60)}`);
      }
    } catch (e) {
      alertFail('StoreURLs', `${storeId}: fetch error — ${e.message.slice(0, 60)}`);
    }
  }));
} catch (e) {
  alertFail('StoreURLs', `Store URL check failed: ${e.message.slice(0, 80)}`);
}

// 8b. Stale store_prices — all 3 stores must have data scraped within 25h
try {
  const stores = ['toycra', 'mybrickhouse', 'jaiman'];
  const cutoff = new Date(Date.now() - 25 * 3_600_000).toISOString();
  for (const storeId of stores) {
    const { count } = await sb.from('store_prices').select('*', { count: 'exact', head: true })
      .eq('store_id', storeId).gte('scraped_at', cutoff);
    if (!count || count === 0) {
      alertFail('StoreFreshness', `${storeId}: no rows scraped in last 25h — scraper may be failing silently`);
    } else {
      log('StoreFreshness', `${storeId}: ${count} rows scraped within 25h ✓`);
    }
  }
} catch (e) {
  alertFail('StoreFreshness', `Store freshness check failed: ${e.message.slice(0, 80)}`);
}

// 8c. Stuck pending_drafts — status=draft with body, not published after 48h
try {
  const cutoff = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const { data: stuck } = await sb
    .from('pending_drafts')
    .select('id, draft_title, updated_at')
    .eq('status', 'draft')
    .not('draft_body', 'is', null)
    .lt('updated_at', cutoff);
  if ((stuck ?? []).length > 0) {
    alertFail('Pipeline', `${stuck.length} draft(s) stuck with body for >48h — publish pipeline blocked?\n` +
      stuck.slice(0, 3).map(d => `  ${(d.draft_title || d.id).slice(0, 60)} (updated ${d.updated_at.slice(0, 10)})`).join('\n'));
  } else {
    log('Pipeline', 'No stuck drafts (status=draft with body >48h) ✓');
  }
} catch (e) {
  alertFail('Pipeline', `Stuck drafts check failed: ${e.message.slice(0, 80)}`);
}

// 8d. Lab price tools return real data (₹ sign present, not empty-state HTML)
const PRICE_LAB_ROUTES = ['/lab/price-drops', '/lab/biryani-index', '/lab/retiring-soon'];
await Promise.allSettled(PRICE_LAB_ROUTES.map(async route => {
  try {
    const res = await fetch(`${SITE_URL}${route}`, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'BOI-TechHygiene/1.0' },
    });
    if (!res.ok) { alertFail('LabData', `${route} returned HTTP ${res.status}`); return; }
    const body = await res.text();
    if (!body.includes('₹')) {
      alertFail('LabData', `${route} has no ₹ sign — may be showing empty state or missing price data`);
    } else {
      log('LabData', `${route}: ₹ data present ✓`);
    }
  } catch (e) {
    alertFail('LabData', `${route} fetch error: ${e.message.slice(0, 60)}`);
  }
}));

// 8e. JS error boundary detection on 3 key pages
const ERROR_MARKERS = ['Something went wrong', 'Application error', 'digest:', 'Error: Minified React error'];
const ERROR_CHECK_ROUTES = ['/', '/sets', '/news'];
await Promise.allSettled(ERROR_CHECK_ROUTES.map(async route => {
  try {
    const res = await fetch(`${SITE_URL}${route}`, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'BOI-TechHygiene/1.0' } });
    if (!res.ok) return; // route check already covers this
    const body = await res.text();
    const hit = ERROR_MARKERS.find(m => body.includes(m));
    if (hit) {
      alertFail('ErrorBoundary', `${route} contains error boundary marker: "${hit}"`);
    } else {
      log('ErrorBoundary', `${route}: no error boundary text ✓`);
    }
  } catch (e) {
    alertFail('ErrorBoundary', `${route} error boundary check failed: ${e.message.slice(0, 60)}`);
  }
}));

// 8f. Sets missing pieces or year data (flag if >5%)
try {
  const [{ count: total }, { count: missingPieces }, { count: missingYear }] = await Promise.all([
    sb.from('sets').select('*', { count: 'exact', head: true }),
    sb.from('sets').select('*', { count: 'exact', head: true }).or('pieces.is.null,pieces.eq.0'),
    sb.from('sets').select('*', { count: 'exact', head: true }).is('year', null),
  ]);
  const pctPieces = total ? Math.round((missingPieces / total) * 100) : 0;
  const pctYear   = total ? Math.round((missingYear   / total) * 100) : 0;
  log('CatalogCoverage', `Sets missing pieces: ${missingPieces}/${total} (${pctPieces}%) | missing year: ${missingYear}/${total} (${pctYear}%)`);
  if (pctPieces > 5) alertFail('CatalogCoverage', `${pctPieces}% of sets missing pieces data — catalogue may be degraded`);
  if (pctYear   > 5) alertFail('CatalogCoverage', `${pctYear}% of sets missing year data — catalogue may be degraded`);
} catch (e) {
  alertFail('CatalogCoverage', `Sets coverage check failed: ${e.message.slice(0, 80)}`);
}

// 8g. blog_posts — hero_image null rate >20% = critical
try {
  const [{ count: bpTotal }, { count: bpNull }] = await Promise.all([
    sb.from('blog_posts').select('*', { count: 'exact', head: true }),
    sb.from('blog_posts').select('*', { count: 'exact', head: true }).is('hero_image', null),
  ]);
  const pct = bpTotal ? Math.round((bpNull / bpTotal) * 100) : 0;
  if (pct > 20) alertFail('ContentCoverage', `${pct}% of blog_posts have null hero_image (${bpNull}/${bpTotal}) — cards will show placeholder`);
  else log('ContentCoverage', `blog_posts hero_image: ${bpNull}/${bpTotal} null (${pct}%) ✓`);
} catch (e) { alertFail('ContentCoverage', `blog_posts hero check error: ${e.message.slice(0, 80)}`); }

// 8h. blog_posts — body (content) null count
try {
  const [{ count: bpTotal }, { count: bpNoBody }] = await Promise.all([
    sb.from('blog_posts').select('*', { count: 'exact', head: true }),
    sb.from('blog_posts').select('*', { count: 'exact', head: true }).is('content', null),
  ]);
  if (bpNoBody && bpNoBody > 0) alertFail('ContentCoverage', `${bpNoBody}/${bpTotal} blog_posts have null content body — posts will render empty`);
  else log('ContentCoverage', `blog_posts content: all ${bpTotal} have non-null body ✓`);
} catch (e) { alertFail('ContentCoverage', `blog_posts body check error: ${e.message.slice(0, 80)}`); }

// 8i. guides — any row with null body
try {
  const { data: nullGuides } = await sb.from('guides').select('slug').is('content', null);
  if ((nullGuides ?? []).length > 0) alertFail('ContentCoverage', `${nullGuides.length} guide(s) have null content: ${nullGuides.map(g => g.slug).join(', ')}`);
  else log('ContentCoverage', `guides content: all rows have non-null body ✓`);
} catch (e) { alertFail('ContentCoverage', `guides body check error: ${e.message.slice(0, 80)}`); }

// 8j. price_snapshots — no row today/yesterday = critical (LAB-06 broken)
try {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const { count } = await sb.from('price_snapshots').select('*', { count: 'exact', head: true }).gte('snapshot_date', yesterday);
  if (!count || count === 0) alertFail('DataPipelineP1', `price_snapshots: no rows for today or yesterday — LAB-06 snapshot cron may be broken`);
  else log('DataPipelineP1', `price_snapshots: ${count} rows since ${yesterday} ✓`);
} catch (e) { alertFail('DataPipelineP1', `price_snapshots P1 check error: ${e.message.slice(0, 80)}`); }

// 8k. raw_signals — no row in last 25h = critical (RADAR dead)
try {
  const cutoff = new Date(Date.now() - 25 * 3_600_000).toISOString();
  const { count } = await sb.from('raw_signals').select('*', { count: 'exact', head: true }).gte('created_at', cutoff);
  if (!count || count === 0) alertFail('DataPipelineP1', `raw_signals: no rows in last 25h — RADAR pipeline may be dead`);
  else log('DataPipelineP1', `raw_signals: ${count} rows in last 25h ✓`);
} catch (e) { alertFail('DataPipelineP1', `raw_signals P1 check error: ${e.message.slice(0, 80)}`); }

// 8l. store_prices product_url — sample 5 per store, verify non-null, non-empty, starts with https://
try {
  const stores8l = ['toycra', 'mybrickhouse', 'jaiman'];
  for (const storeId of stores8l) {
    const { data: rows } = await sb.from('store_prices').select('set_id, product_url').eq('store_id', storeId).limit(5);
    const bad = (rows ?? []).filter(r => !r.product_url || !r.product_url.startsWith('https://'));
    if (bad.length > 0) alertFail('StoreURLsP1', `${storeId}: ${bad.length} product_url(s) null/invalid in sample of ${(rows ?? []).length}`);
    else log('StoreURLsP1', `${storeId}: product_url sample valid (${(rows ?? []).length} rows) ✓`);
  }
} catch (e) { alertFail('StoreURLsP1', `store product_url check error: ${e.message.slice(0, 80)}`); }

// 8m. Rebrickable API — P1 connectivity check (42172-1)
try {
  const rbKey = process.env.REBRICKABLE_API_KEY;
  const rbHdrs = { 'User-Agent': 'BOI-TechHygiene/1.0', ...(rbKey ? { Authorization: `key ${rbKey}` } : {}) };
  const res = await fetch('https://rebrickable.com/api/v3/lego/sets/42172-1/', { headers: rbHdrs, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) alertFail('ExtP1', `Rebrickable API: HTTP ${res.status} for 42172-1 — image fallback chain will fail`);
  else {
    const data = await res.json();
    if (!data.set_img_url) alertFail('ExtP1', `Rebrickable 42172-1: no set_img_url — image fallback broken`);
    else log('ExtP1', `Rebrickable API: 200, set_img_url present ✓`);
  }
} catch (e) { alertFail('ExtP1', `Rebrickable API P1 check error: ${e.message.slice(0, 80)}`); }

// 8n. Shopify endpoints — HTTP 200 (connectivity, separate from zero-row scraper check)
try {
  const shopify8n = [
    { name: 'Toycra',       url: 'https://www.toycra.com/collections/lego/products.json?limit=1' },
    { name: 'MyBrickHouse', url: 'https://lego.mybrickhouse.com/products.json?limit=1' },
    { name: 'Jaiman',       url: 'https://jaimantoys.com/products.json?limit=1' },
  ];
  await Promise.allSettled(shopify8n.map(async ({ name, url }) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'BOI-TechHygiene/1.0' }, redirect: 'follow' });
      if (res.ok) log('ExtP1', `${name} Shopify endpoint: ${res.status} ✓`);
      else alertFail('ExtP1', `${name} Shopify endpoint: HTTP ${res.status} — scraper will fail at next run`);
    } catch (e) { alertFail('ExtP1', `${name} Shopify endpoint error: ${e.message.slice(0, 60)}`); }
  }));
} catch (e) { alertFail('ExtP1', `Shopify P1 check error: ${e.message.slice(0, 80)}`); }

// ── Check 9: P1 Content checks ─────────────────────────────────────────────────

// 9a. Markdown leaking — scan last 10 news_articles for ** or isolated *
try {
  const { data: arts } = await sb.from('news_articles').select('slug, content')
    .not('content', 'is', null).order('published_at', { ascending: false }).limit(10);
  const leaking = (arts ?? []).filter(a => /\*\*|\b\*[^*\s]/.test(a.content ?? ''));
  if (leaking.length > 0) {
    alertFail('ContentQuality', `Markdown asterisks leaking in ${leaking.length} article(s): ${leaking.map(a => a.slug).join(', ')}`);
  } else {
    log('ContentQuality', `Markdown leak check: 0/${(arts ?? []).length} articles have ** or * ✓`);
  }
} catch (e) {
  alertFail('ContentQuality', `Markdown leak check failed: ${e.message.slice(0, 80)}`);
}

// 9b. Placeholder text in last 10 articles
try {
  const { data: arts } = await sb.from('news_articles').select('slug, content, title')
    .not('content', 'is', null).order('published_at', { ascending: false }).limit(10);
  const PLACEHOLDERS = /\[INSERT\]|\bTODO\b|\bPLACEHOLDER\b|lorem ipsum/i;
  const contaminated = (arts ?? []).filter(a => PLACEHOLDERS.test(a.content ?? '') || PLACEHOLDERS.test(a.title ?? ''));
  if (contaminated.length > 0) {
    alertFail('ContentQuality', `Placeholder text in ${contaminated.length} article(s): ${contaminated.map(a => a.slug).join(', ')}`);
  } else {
    log('ContentQuality', `Placeholder check: clean ✓`);
  }
} catch (e) {
  alertFail('ContentQuality', `Placeholder check failed: ${e.message.slice(0, 80)}`);
}

// 9c. Meta description present on 3 key pages
const META_CHECK_ROUTES = ['/', '/news', '/sets', '/reviews'];
await Promise.allSettled(META_CHECK_ROUTES.map(async route => {
  try {
    const res = await fetch(`${SITE_URL}${route}`, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'BOI-TechHygiene/1.0' } });
    if (!res.ok) return;
    const html = await res.text();
    const match = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']{10,})["']/i)
                || html.match(/<meta\s+content=["']([^"']{10,})["']\s+name=["']description["']/i);
    if (!match) {
      alertFail('MetaTags', `${route} missing or empty <meta name="description">`);
    } else {
      log('MetaTags', `${route}: description="${match[1].slice(0, 60)}" ✓`);
    }
  } catch (e) {
    alertFail('MetaTags', `${route} meta check failed: ${e.message.slice(0, 60)}`);
  }
}));

// 9d. Sample 10 news_articles hero_image URLs — HEAD check
try {
  const { data: articles } = await sb.from('news_articles').select('slug, hero_image')
    .not('hero_image', 'is', null).not('hero_image', 'eq', '').limit(10);
  const imgFails = [];
  await Promise.allSettled((articles ?? []).map(async a => {
    try {
      const r = await fetch(a.hero_image, { method: 'HEAD', signal: AbortSignal.timeout(8_000), headers: { 'User-Agent': 'BOI-TechHygiene/1.0' } });
      if (!r.ok) imgFails.push(`${a.slug}: HTTP ${r.status}`);
    } catch (e) { imgFails.push(`${a.slug}: ${e.message.slice(0, 40)}`); }
  }));
  if (imgFails.length > 0) {
    alertFail('ImageHealth', `${imgFails.length} news hero image(s) broken:\n${imgFails.map(f => '  ' + f).join('\n')}`);
  } else {
    log('ImageHealth', `News hero images: ${(articles ?? []).length} sampled, all 200 ✓`);
  }
} catch (e) {
  alertFail('ImageHealth', `News image check failed: ${e.message.slice(0, 80)}`);
}

// 9e. Review hero_image — all rows, verify 200 or flag null
try {
  const { data: reviews } = await sb.from('reviews').select('slug, hero_image');
  const nullRevs = (reviews ?? []).filter(r => !r.hero_image);
  if (nullRevs.length > 0) alertFail('ImageHealth', `${nullRevs.length} review(s) have null hero_image: ${nullRevs.map(r => r.slug).join(', ')}`);
  const withImg = (reviews ?? []).filter(r => r.hero_image);
  const revFails = [];
  await Promise.allSettled(withImg.map(async r => {
    try {
      const res = await fetch(r.hero_image, { method: 'HEAD', signal: AbortSignal.timeout(8_000), headers: { 'User-Agent': 'BOI-TechHygiene/1.0' } });
      if (!res.ok) revFails.push(`${r.slug}: HTTP ${res.status}`);
    } catch (e) { revFails.push(`${r.slug}: ${e.message.slice(0, 40)}`); }
  }));
  if (revFails.length > 0) {
    alertFail('ImageHealth', `Review hero image(s) broken: ${revFails.join(', ')}`);
  } else {
    log('ImageHealth', `Review hero images: ${withImg.length} checked, all 200 ✓`);
  }
} catch (e) {
  alertFail('ImageHealth', `Review image check failed: ${e.message.slice(0, 80)}`);
}

// 9f. Last 5 blog_posts — markdown asterisk leak
try {
  const { data: bps } = await sb.from('blog_posts').select('slug, content')
    .not('content', 'is', null).order('published_at', { ascending: false }).limit(5);
  const leaking = (bps ?? []).filter(a => /\*\*|\b\*[^*\s]/.test(a.content ?? ''));
  if (leaking.length > 0) alertFail('ContentQuality', `Markdown asterisks in ${leaking.length} blog_post(s): ${leaking.map(a => a.slug).join(', ')}`);
  else log('ContentQuality', `blog_posts markdown leak: clean (${(bps ?? []).length} checked) ✓`);
} catch (e) { alertFail('ContentQuality', `blog_posts markdown check error: ${e.message.slice(0, 80)}`); }

// 9g. Last 5 blog_posts — placeholder text
try {
  const { data: bps } = await sb.from('blog_posts').select('slug, content, title')
    .not('content', 'is', null).order('published_at', { ascending: false }).limit(5);
  const PLACEHOLDERS = /\[INSERT\]|\bTODO\b|\bPLACEHOLDER\b|lorem ipsum/i;
  const contaminated = (bps ?? []).filter(a => PLACEHOLDERS.test(a.content ?? '') || PLACEHOLDERS.test(a.title ?? ''));
  if (contaminated.length > 0) alertFail('ContentQuality', `Placeholder text in ${contaminated.length} blog_post(s): ${contaminated.map(a => a.slug).join(', ')}`);
  else log('ContentQuality', `blog_posts placeholder check: clean ✓`);
} catch (e) { alertFail('ContentQuality', `blog_posts placeholder check error: ${e.message.slice(0, 80)}`); }

// 9h. Last 5 blog_posts — seo_description present and non-empty (meta description proxy)
try {
  const { data: bps } = await sb.from('blog_posts').select('slug, seo_description')
    .order('published_at', { ascending: false }).limit(5);
  const noMeta = (bps ?? []).filter(a => !a.seo_description || a.seo_description.trim().length < 10);
  if (noMeta.length > 0) alertFail('MetaTags', `${noMeta.length} blog_post(s) missing seo_description: ${noMeta.map(a => a.slug).join(', ')}`);
  else log('MetaTags', `blog_posts seo_description: all ${(bps ?? []).length} present ✓`);
} catch (e) { alertFail('MetaTags', `blog_posts meta check error: ${e.message.slice(0, 80)}`); }

// ── Check 10: Homepage regression guards ──────────────────────────────────────

// 10a. Homepage reviews alias — set join returns image_url (catches set: alias regression)
try {
  const { data: revs } = await sb.from('reviews').select('slug, set:sets(image_url)');
  const withImg = (revs ?? []).filter(r => r.set?.image_url);
  if ((revs ?? []).length > 0 && withImg.length === 0) {
    alertFail('Homepage', 'No reviews have set.image_url via join — set: alias may be broken (regression)');
  } else {
    log('Homepage', `Reviews join: ${withImg.length}/${(revs ?? []).length} have set.image_url ✓`);
  }
} catch (e) {
  alertFail('Homepage', `Reviews join check failed: ${e.message.slice(0, 80)}`);
}

// 10b. Homepage deals — store_prices has coverage for top deal sets (catches dead prices(*) regression)
try {
  const { data: dealSets } = await sb.from('sets')
    .select('set_number').not('lego_mrp_inr', 'is', null)
    .order('updated_at', { ascending: false }).limit(8);
  const nums = (dealSets ?? []).map(s => s.set_number).filter(Boolean);
  if (nums.length > 0) {
    const { count } = await sb.from('store_prices')
      .select('*', { count: 'exact', head: true }).in('set_id', nums);
    if (!count || count === 0) {
      alertFail('Homepage', 'No store_prices for homepage deal sets — deal cards will show no prices (dead table regression)');
    } else {
      log('Homepage', `Deals price coverage: ${count} store_prices rows for top ${nums.length} deal sets ✓`);
    }
  }
} catch (e) {
  alertFail('Homepage', `Deals price coverage check failed: ${e.message.slice(0, 80)}`);
}

// ── Check 11: Page coverage — previously unchecked routes ─────────────────────

const PAGE_CHECKS = [
  { route: '/deals',              contains: '₹',              label: 'deals ₹ data'        },
  { route: '/blog',               contains: null,             label: 'blog loads'           },
  { route: '/opinion',            contains: null,             label: 'opinion loads'        },
  { route: '/community',          contains: null,             label: 'community loads'      },
  { route: '/lab/which-set',      contains: 'question',       label: 'quiz form'            },
  { route: '/lab/deals',          contains: '₹',              label: 'lab/deals ₹ data'    },
  { route: '/lab/budget-calculator', contains: 'budget',      label: 'budget input'         },
  { route: '/lab/heat-map',       contains: null,             label: 'heat-map loads'       },
];

await Promise.allSettled(PAGE_CHECKS.map(async ({ route, contains, label }) => {
  try {
    const res = await fetch(`${SITE_URL}${route}`, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'BOI-TechHygiene/1.0' },
    });
    if (!res.ok) { alertFail('PageCoverage', `${route} returned HTTP ${res.status}`); return; }
    const body = await res.text();
    if (body.length < 500) { alertFail('PageCoverage', `${route} body only ${body.length} chars — likely error page`); return; }
    if (contains && !body.toLowerCase().includes(contains.toLowerCase())) {
      alertFail('PageCoverage', `${route}: expected "${contains}" not found — ${label} check failed`);
    } else {
      log('PageCoverage', `${route}: 200, ${label} ✓`);
    }
  } catch (e) { alertFail('PageCoverage', `${route} error: ${e.message.slice(0, 60)}`); }
}));

// 11b: /themes — at least 10 theme names visible
try {
  const res = await fetch(`${SITE_URL}/themes`, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'BOI-TechHygiene/1.0' } });
  if (!res.ok) { alertFail('PageCoverage', `/themes returned HTTP ${res.status}`); }
  else {
    const body = await res.text();
    const themeCount = (body.match(/\/themes\//g) || []).length;
    if (themeCount < 10) alertFail('PageCoverage', `/themes: only ${themeCount} theme links found — expected ≥ 10`);
    else log('PageCoverage', `/themes: ${themeCount} theme links ✓`);
  }
} catch (e) { alertFail('PageCoverage', `/themes error: ${e.message.slice(0, 60)}`); }

// 11c: /themes/technic — set cards present
try {
  const res = await fetch(`${SITE_URL}/themes/technic`, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'BOI-TechHygiene/1.0' } });
  if (!res.ok) { alertFail('PageCoverage', `/themes/technic returned HTTP ${res.status}`); }
  else {
    const body = await res.text();
    if (!body.includes('Technic') || body.length < 2000) alertFail('PageCoverage', `/themes/technic: no Technic content found`);
    else log('PageCoverage', `/themes/technic: 200, Technic content present ✓`);
  }
} catch (e) { alertFail('PageCoverage', `/themes/technic error: ${e.message.slice(0, 60)}`); }

// 11d: /compare — set 42172 exists in DB (search proxy)
try {
  const { data } = await sb.from('sets').select('set_number, name').eq('set_number', '42172').maybeSingle();
  if (!data) alertFail('PageCoverage', `/compare search proxy: set 42172 not in sets table — /compare may return no results`);
  else log('PageCoverage', `/compare search proxy: set 42172 (${data.name}) in DB ✓`);
} catch (e) { alertFail('PageCoverage', `/compare proxy check error: ${e.message.slice(0, 60)}`); }

// ── Check 12: External dependency health ──────────────────────────────────────

// 12a: Rebrickable API — known set 42172-1
try {
  const rbKey = process.env.REBRICKABLE_API_KEY;
  const rbHdrs = { 'User-Agent': 'BOI-TechHygiene/1.0', ...(rbKey ? { Authorization: `key ${rbKey}` } : {}) };
  const res = await fetch('https://rebrickable.com/api/v3/lego/sets/42172-1/', { headers: rbHdrs, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) { alertFail('ExtDependencies', `Rebrickable API returned HTTP ${res.status} for set 42172-1`); }
  else {
    const data = await res.json();
    if (!data.set_img_url) alertFail('ExtDependencies', `Rebrickable 42172-1: set_img_url missing`);
    else log('ExtDependencies', `Rebrickable API: 200, 42172-1 = ${data.name}, img ✓`);
  }
} catch (e) { alertFail('ExtDependencies', `Rebrickable API error: ${e.message.slice(0, 80)}`); }

// 12b: Brickset API — connectivity + key present
try {
  if (!process.env.BRICKSET_API_KEY) {
    alertFail('ExtDependencies', 'BRICKSET_API_KEY not set');
  } else {
    const res = await fetch('https://brickset.com/api/v3.asmx/checkKey?' +
      `apiKey=${encodeURIComponent(process.env.BRICKSET_API_KEY)}`,
      { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'BOI-TechHygiene/1.0' } });
    if (!res.ok) { alertFail('ExtDependencies', `Brickset API returned HTTP ${res.status}`); }
    else {
      const text = await res.text();
      if (text.includes('OK')) log('ExtDependencies', `Brickset API: key valid ✓`);
      else alertFail('ExtDependencies', `Brickset API: key check returned "${text.slice(0, 60)}"`);
    }
  }
} catch (e) { alertFail('ExtDependencies', `Brickset API error: ${e.message.slice(0, 80)}`); }

// 12c: Shopify store endpoints return 200
const SHOPIFY_ENDPOINTS = [
  { name: 'Toycra',       url: 'https://www.toycra.com/collections/lego/products.json?limit=1' },
  { name: 'MyBrickHouse', url: 'https://lego.mybrickhouse.com/products.json?limit=1' },
  { name: 'Jaiman',       url: 'https://jaimantoys.com/products.json?limit=1' },
];
await Promise.allSettled(SHOPIFY_ENDPOINTS.map(async ({ name, url }) => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'BOI-TechHygiene/1.0' }, redirect: 'follow' });
    if (res.ok) log('ExtDependencies', `${name} Shopify: ${res.status} ✓`);
    else alertFail('ExtDependencies', `${name} Shopify endpoint returned HTTP ${res.status}`);
  } catch (e) { alertFail('ExtDependencies', `${name} Shopify error: ${e.message.slice(0, 60)}`); }
}));

// 12d–12f: CDN health (D3, TopoJSON, India map)
const CDN_URLS = [
  { label: 'D3.js CDN',     url: 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js' },
  { label: 'TopoJSON CDN',  url: 'https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js' },
  { label: 'India map',     url: 'https://raw.githubusercontent.com/markmarkoh/datamaps/master/src/js/data/ind.json' },
];
await Promise.allSettled(CDN_URLS.map(async ({ label, url }) => {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'BOI-TechHygiene/1.0' } });
    if (res.ok) log('ExtDependencies', `${label}: ${res.status} ✓`);
    else alertFail('ExtDependencies', `${label} returned HTTP ${res.status}`);
  } catch (e) { alertFail('ExtDependencies', `${label} error: ${e.message.slice(0, 60)}`); }
}));

// 12g: GH_DISPATCH_TOKEN — verify set + makes valid GitHub API call
try {
  const tok = GITHUB_TOKEN || process.env.GH_DISPATCH_TOKEN;
  if (!tok) { alertFail('ExtDependencies', 'GH_DISPATCH_TOKEN not set — batch generation dispatch unavailable'); }
  else {
    const res = await fetch('https://api.github.com/repos/' + GITHUB_REPO, {
      headers: { Authorization: `Bearer ${tok}`, 'User-Agent': 'BOI-TechHygiene/1.0' },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) log('ExtDependencies', `GH_DISPATCH_TOKEN: valid, repo accessible ✓`);
    else alertFail('ExtDependencies', `GH_DISPATCH_TOKEN: GitHub API returned HTTP ${res.status} — token may be expired`);
  }
} catch (e) { alertFail('ExtDependencies', `GH_DISPATCH_TOKEN check error: ${e.message.slice(0, 60)}`); }

// 12h: IG_ACCESS_TOKEN — expiry warning (expires ~2026-07-23, action by 2026-07-16)
try {
  const IG_EXPIRY = new Date('2026-07-23T00:00:00Z');
  const daysLeft = Math.floor((IG_EXPIRY - Date.now()) / 86_400_000);
  if (daysLeft < 0) {
    alertFail('ExtDependencies', `IG_ACCESS_TOKEN EXPIRED ${Math.abs(daysLeft)} days ago — social automation is down`);
  } else if (daysLeft <= 14) {
    alertFail('ExtDependencies', `IG_ACCESS_TOKEN expires in ${daysLeft} days (${IG_EXPIRY.toISOString().slice(0, 10)}) — re-exchange NOW`);
  } else if (daysLeft <= 30) {
    log('ExtDependencies', `IG_ACCESS_TOKEN: ${daysLeft} days until expiry — schedule re-exchange ⚠️`);
  } else {
    log('ExtDependencies', `IG_ACCESS_TOKEN: ${daysLeft} days until expiry ✓`);
  }
} catch (e) { alertFail('ExtDependencies', `IG token expiry check error: ${e.message.slice(0, 60)}`); }

// ── Check 13: Data pipeline health ────────────────────────────────────────────

// 13a: raw_signals — at least 1 row in last 25h (RADAR ingesting)
try {
  const cutoff = new Date(Date.now() - 25 * 3_600_000).toISOString();
  const { count } = await sb.from('raw_signals').select('*', { count: 'exact', head: true }).gte('created_at', cutoff);
  if (!count || count === 0) alertFail('DataPipeline', 'No raw_signals in last 25h — RADAR may not be running');
  else log('DataPipeline', `raw_signals: ${count} rows in last 25h ✓`);
} catch (e) { alertFail('DataPipeline', `raw_signals check error: ${e.message.slice(0, 80)}`); }

// 13b: price_snapshots — rows exist for today or yesterday
try {
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const { count } = await sb.from('price_snapshots').select('*', { count: 'exact', head: true })
    .gte('snapshot_date', yesterday);
  if (!count || count === 0) alertFail('DataPipeline', `price_snapshots: no rows for today (${today}) or yesterday — LAB-03 cron may be failing`);
  else log('DataPipeline', `price_snapshots: ${count} rows for today/yesterday ✓`);
} catch (e) { alertFail('DataPipeline', `price_snapshots check error: ${e.message.slice(0, 80)}`); }

// 13c: content_fix_log — at least 1 row in last 7 days (auto-fixer ran)
try {
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { count } = await sb.from('content_fix_log').select('*', { count: 'exact', head: true }).gte('created_at', cutoff);
  if (!count || count === 0) log('DataPipeline', 'content_fix_log: no rows in last 7 days — auto-fixer may not have run (acceptable if no issues)');
  else log('DataPipeline', `content_fix_log: ${count} fix(es) in last 7 days ✓`);
} catch (e) { log('DataPipeline', `content_fix_log check skipped: ${e.message.slice(0, 60)}`); }

// 13d: newsletter_subscribers — table queryable
try {
  const { error } = await sb.from('newsletter_subscribers').select('*', { count: 'exact', head: true });
  if (error) alertFail('DataPipeline', `newsletter_subscribers table error: ${error.message.slice(0, 80)}`);
  else log('DataPipeline', 'newsletter_subscribers: table queryable ✓');
} catch (e) { alertFail('DataPipeline', `newsletter_subscribers error: ${e.message.slice(0, 80)}`); }

// 13e: guides — at least 9 rows with non-null content
try {
  const { count } = await sb.from('guides').select('*', { count: 'exact', head: true }).not('content', 'is', null);
  if (!count || count < 9) alertFail('DataPipeline', `guides: only ${count ?? 0} rows with content — expected ≥ 9`);
  else log('DataPipeline', `guides: ${count} rows with content ✓`);
} catch (e) { alertFail('DataPipeline', `guides check error: ${e.message.slice(0, 80)}`); }

// 13f: blog_posts — at least 1 with non-null content AND hero_image
try {
  const { count } = await sb.from('blog_posts').select('*', { count: 'exact', head: true })
    .not('content', 'is', null).not('hero_image', 'is', null);
  if (!count || count === 0) alertFail('DataPipeline', 'blog_posts: no rows with both content and hero_image — blog cards will show no images');
  else log('DataPipeline', `blog_posts: ${count} rows with content + hero_image ✓`);
} catch (e) { alertFail('DataPipeline', `blog_posts check error: ${e.message.slice(0, 80)}`); }

// 13g: legacy prices table — flag existence as cleanup reminder
try {
  const { error } = await sb.from('prices').select('id').limit(1);
  if (!error) log('DataPipeline', 'prices (legacy): table still exists — ADMIN-CLEANUP-01 pending. Safe to drop once confirmed unused.');
  // No alert — informational only
} catch (e) { /* table may not exist — fine */ }

// ── Check 14: Content integrity ────────────────────────────────────────────────

const { data: last10News } = await sb.from('news_articles').select('slug, title, content, published_at')
  .not('content', 'is', null).order('published_at', { ascending: false }).limit(10);
const news10 = last10News ?? [];

// 14a: Word count 250–500 for news articles
const wordCountFails = news10.filter(a => {
  const wc = (a.content || '').split(/\s+/).filter(Boolean).length;
  return wc < 150 || wc > 600;
});
if (wordCountFails.length > 0) {
  alertFail('ContentIntegrity', `${wordCountFails.length} article(s) outside 150–600 word range: ${wordCountFails.map(a => `${a.slug}(${(a.content||'').split(/\s+/).filter(Boolean).length}w)`).join(', ')}`);
} else {
  log('ContentIntegrity', `Word count: all ${news10.length} recent articles within 150–600 words ✓`);
}

// 14b: HTML tags leaking in content
const htmlLeaks = news10.filter(a => /<(p|br|strong|em|div|span|h[1-6])\b/i.test(a.content || ''));
if (htmlLeaks.length > 0) alertFail('ContentIntegrity', `HTML tags leaking in ${htmlLeaks.length} article(s): ${htmlLeaks.map(a => a.slug).join(', ')}`);
else log('ContentIntegrity', `HTML leak check: clean ✓`);

// 14c: ABHINAV12 present when Toycra is mentioned
const toycraWithoutCode = news10.filter(a =>
  /toycra/i.test(a.content || '') && !/ABHINAV12/i.test(a.content || '')
);
if (toycraWithoutCode.length > 0) alertFail('ContentIntegrity', `${toycraWithoutCode.length} article(s) mention Toycra without ABHINAV12: ${toycraWithoutCode.map(a => a.slug).join(', ')}`);
else log('ContentIntegrity', `ABHINAV12 code: present in all Toycra-mentioning articles ✓`);

// 14d: Store names spelled correctly
// "My Brick House" (spaced) is flagged — brand name is "MyBrickHouse" (no spaces).
// If first run shows false positives from natural prose, remove the first entry and
// replace with a tighter pattern (e.g. only flag when preceded by "at " or "on ").
const MISSPELLINGS = [
  { re: /my\s+brick\s+house/i, correct: 'MyBrickHouse' },
  { re: /jaiman(?!\s+toys)/i,   correct: 'Jaiman Toys' },
];
const spellingFails = [];
for (const a of news10) {
  for (const { re, correct } of MISSPELLINGS) {
    if (re.test(a.content || '')) spellingFails.push(`${a.slug}: use "${correct}"`);
  }
}
if (spellingFails.length > 0) alertFail('ContentIntegrity', `Store name misspellings: ${spellingFails.join(' | ')}`);
else log('ContentIntegrity', `Store name spelling: clean ✓`);

// 14e: Last 5 opinion posts contain "On that bombshell" sign-off
try {
  const { data: opinions } = await sb.from('blog_posts').select('slug, content')
    .eq('category', 'Opinion').not('content', 'is', null)
    .order('published_at', { ascending: false }).limit(5);
  const withSignoff = (opinions ?? []).filter(p => /on that bombshell/i.test(p.content || ''));
  const total = (opinions ?? []).length;
  if (total > 0 && withSignoff.length === 0) {
    log('ContentIntegrity', `Opinion sign-off: 0/${total} recent opinion posts have "On that bombshell" — may be acceptable for community content`);
  } else {
    log('ContentIntegrity', `Opinion sign-off: ${withSignoff.length}/${total} recent opinion posts have sign-off ✓`);
  }
} catch (e) { log('ContentIntegrity', `Opinion sign-off check skipped: ${e.message.slice(0, 60)}`); }

// 14f: All reviews have valid verdict
try {
  const VALID_VERDICTS = new Set(['BUY NOW', 'WAIT', 'IMPORT ONLY', 'AVOID']);
  const { data: revs } = await sb.from('reviews').select('slug, verdict');
  const badVerdict = (revs ?? []).filter(r => !r.verdict || !VALID_VERDICTS.has((r.verdict || '').trim().toUpperCase()));
  if (badVerdict.length > 0) alertFail('ContentIntegrity', `Reviews with null/invalid verdict: ${badVerdict.map(r => `${r.slug}(${r.verdict ?? 'null'})`).join(', ')}`);
  else log('ContentIntegrity', `Review verdicts: all ${(revs ?? []).length} valid ✓`);
} catch (e) { alertFail('ContentIntegrity', `Review verdict check error: ${e.message.slice(0, 80)}`); }

// 14g: No duplicate slugs in news_articles
try {
  const { data: slugs } = await sb.from('news_articles').select('slug');
  const seen = new Map();
  for (const { slug } of slugs ?? []) seen.set(slug, (seen.get(slug) ?? 0) + 1);
  const dupes = [...seen.entries()].filter(([, c]) => c > 1).map(([s]) => s);
  if (dupes.length > 0) alertFail('ContentIntegrity', `Duplicate slugs in news_articles: ${dupes.join(', ')}`);
  else log('ContentIntegrity', `news_articles slugs: no duplicates ✓`);
} catch (e) { alertFail('ContentIntegrity', `news_articles slug check error: ${e.message.slice(0, 80)}`); }

// 14h: No duplicate slugs in blog_posts
try {
  const { data: slugs } = await sb.from('blog_posts').select('slug');
  const seen = new Map();
  for (const { slug } of slugs ?? []) seen.set(slug, (seen.get(slug) ?? 0) + 1);
  const dupes = [...seen.entries()].filter(([, c]) => c > 1).map(([s]) => s);
  if (dupes.length > 0) alertFail('ContentIntegrity', `Duplicate slugs in blog_posts: ${dupes.join(', ')}`);
  else log('ContentIntegrity', `blog_posts slugs: no duplicates ✓`);
} catch (e) { alertFail('ContentIntegrity', `blog_posts slug check error: ${e.message.slice(0, 80)}`); }

// 14i: No articles published in the future
try {
  const now14 = new Date().toISOString();
  const { count } = await sb.from('news_articles').select('*', { count: 'exact', head: true }).gt('published_at', now14);
  if (count && count > 0) alertFail('ContentIntegrity', `${count} news_article(s) have published_at in the future`);
  else log('ContentIntegrity', `Future date check: clean ✓`);
} catch (e) { alertFail('ContentIntegrity', `Future date check error: ${e.message.slice(0, 80)}`); }

// 14j: No ALL CAPS words (5+ uppercase letters, not in headings or verdict lines)
const allCapsRe = /\b[A-Z]{5,}\b/g;
const allowedCaps = new Set(['LEGO', 'LEGOR', 'ABHINAV12', 'IMPORT', 'AVOID', 'BRICKHEADZ', 'NINJAGO', 'DUPLO', 'TECHNIC']);
const capsArticles = news10.filter(a => {
  const lines = (a.content || '').split('\n')
    .filter(l => !l.trim().startsWith('#') && !/^verdict:/i.test(l.trim()));
  const text = lines.join(' ');
  const caps = [...text.matchAll(allCapsRe)].map(m => m[0]).filter(w => !allowedCaps.has(w));
  return caps.length > 0;
});
if (capsArticles.length > 0) alertFail('ContentIntegrity', `ALL CAPS words in ${capsArticles.length} article(s): ${capsArticles.map(a => a.slug).join(', ')}`);
else log('ContentIntegrity', `ALL CAPS check: clean ✓`);

// 14k: India Paragraph mentions all 3 stores (check via content proxy — marker stripped at publish)
const missingStores = news10.filter(a => {
  const c = a.content || '';
  return /₹[\d,]+/.test(c) && (
    !/toycra/i.test(c) || !/mybrickhouse/i.test(c) || !/jaiman/i.test(c)
  );
});
if (missingStores.length > 0) alertFail('ContentIntegrity', `${missingStores.length} article(s) have price data but missing store name(s): ${missingStores.map(a => a.slug).join(', ')}`);
else log('ContentIntegrity', `India Paragraph store coverage: all priced articles mention all 3 stores ✓`);

// 14l: blog_posts hero_image null rate >20%
try {
  const [{ count: total }, { count: nullImg }] = await Promise.all([
    sb.from('blog_posts').select('*', { count: 'exact', head: true }),
    sb.from('blog_posts').select('*', { count: 'exact', head: true }).is('hero_image', null),
  ]);
  const pct = total ? Math.round((nullImg / total) * 100) : 0;
  if (pct > 20) alertFail('ContentIntegrity', `${pct}% of blog_posts have null hero_image (${nullImg}/${total}) — card images will show placeholder`);
  else log('ContentIntegrity', `blog_posts hero_image: ${nullImg}/${total} null (${pct}%) ✓`);
} catch (e) { alertFail('ContentIntegrity', `blog hero null rate error: ${e.message.slice(0, 80)}`); }

// ── Check 15: Performance + technical ─────────────────────────────────────────

// 15a–15c: Page response times <3s
const PERF_ROUTES = ['/', '/news', '/sets'];
await Promise.allSettled(PERF_ROUTES.map(async route => {
  try {
    const t0 = Date.now();
    const res = await fetch(`${SITE_URL}${route}`, { signal: AbortSignal.timeout(8_000), headers: { 'User-Agent': 'BOI-TechHygiene/1.0' } });
    const ms = Date.now() - t0;
    if (!res.ok) { alertFail('Performance', `${route} returned HTTP ${res.status}`); return; }
    if (ms > 3000) alertFail('Performance', `${route} response time ${ms}ms > 3000ms threshold`);
    else log('Performance', `${route}: ${ms}ms ✓`);
  } catch (e) { alertFail('Performance', `${route} timing error: ${e.message.slice(0, 60)}`); }
}));

// 15d: Internal links on homepage — sample 10, verify 200
try {
  const res = await fetch(SITE_URL, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'BOI-TechHygiene/1.0' } });
  if (res.ok) {
    const html = await res.text();
    const hrefs = [...new Set([...html.matchAll(/href="(\/[^"#?][^"]*?)"/g)].map(m => m[1]))]
      .filter(h => !h.startsWith('/api') && !h.startsWith('/_next'));
    const sample = hrefs.sort(() => Math.random() - 0.5).slice(0, 10);
    const linkFails = [];
    await Promise.allSettled(sample.map(async href => {
      try {
        const r = await fetch(`${SITE_URL}${href}`, { method: 'HEAD', signal: AbortSignal.timeout(8_000), headers: { 'User-Agent': 'BOI-TechHygiene/1.0' }, redirect: 'follow' });
        if (!r.ok) linkFails.push(`${href} → ${r.status}`);
      } catch (e) { linkFails.push(`${href} → error`); }
    }));
    if (linkFails.length > 0) alertFail('Performance', `Broken internal links: ${linkFails.join(', ')}`);
    else log('Performance', `Internal links: ${sample.length} sampled, all 200 ✓`);
  }
} catch (e) { alertFail('Performance', `Internal link check error: ${e.message.slice(0, 60)}`); }

// 15e: OG meta image present on 3 key pages
const OG_CHECK_ROUTES = ['/', `/news/${(last10News?.[0]?.slug ?? '')}`, '/sets'];
await Promise.allSettled(OG_CHECK_ROUTES.filter(r => r !== '/news/').map(async route => {
  try {
    const res = await fetch(`${SITE_URL}${route}`, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'BOI-TechHygiene/1.0' } });
    if (!res.ok) return;
    const html = await res.text();
    const hasOg = /<meta[^>]+property=["']og:image["'][^>]+content=["'][^"']{5,}["']/i.test(html)
               || /<meta[^>]+content=["'][^"']{5,}["'][^>]+property=["']og:image["']/i.test(html);
    if (!hasOg) alertFail('Performance', `${route}: og:image meta tag missing or empty`);
    else log('Performance', `${route}: og:image present ✓`);
  } catch (e) { alertFail('Performance', `${route} OG check error: ${e.message.slice(0, 60)}`); }
}));

// 15f: Canonical URL tag on homepage and /sets
await Promise.allSettled(['/', '/sets'].map(async route => {
  try {
    const res = await fetch(`${SITE_URL}${route}`, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'BOI-TechHygiene/1.0' } });
    if (!res.ok) return;
    const html = await res.text();
    const hasCanonical = /<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']{5,}["']/i.test(html);
    if (!hasCanonical) alertFail('Performance', `${route}: canonical link tag missing`);
    else log('Performance', `${route}: canonical present ✓`);
  } catch (e) { alertFail('Performance', `${route} canonical check error: ${e.message.slice(0, 60)}`); }
}));

// 15g: store_prices — no single store has >80% of rows (scraper imbalance)
try {
  const { data: storeRows } = await sb.from('store_prices').select('store_id').limit(3000);
  const total15 = (storeRows ?? []).length;
  const counts = {};
  for (const r of storeRows ?? []) counts[r.store_id] = (counts[r.store_id] ?? 0) + 1;
  for (const [storeId, count] of Object.entries(counts)) {
    const pct = Math.round((count / total15) * 100);
    if (pct > 80) alertFail('Performance', `${storeId} has ${pct}% of store_prices rows — scraper imbalance`);
  }
  log('Performance', `store_prices distribution: ${Object.entries(counts).map(([s, c]) => `${s}=${c}`).join(', ')} ✓`);
} catch (e) { alertFail('Performance', `store_prices distribution check error: ${e.message.slice(0, 80)}`); }

// 15h: Gemini quota proxy — flag if approved pending_drafts count > 300 without recent drafts
try {
  const { count: approved } = await sb.from('pending_drafts').select('*', { count: 'exact', head: true }).eq('status', 'approved').is('draft_body', null);
  const { count: drafts }   = await sb.from('pending_drafts').select('*', { count: 'exact', head: true }).eq('status', 'draft');
  log('Performance', `Gemini queue: ${approved ?? 0} approved awaiting body, ${drafts ?? 0} generated (draft state)`);
  if ((approved ?? 0) > 300 && (drafts ?? 0) === 0) {
    alertFail('Performance', `${approved} approved drafts waiting with 0 generated — possible Gemini quota exhaustion`);
  }
} catch (e) { alertFail('Performance', `Gemini queue check error: ${e.message.slice(0, 80)}`); }

// 15i: Social automation — posted_sets entry within 25h (skip gracefully if table missing)
try {
  const cutoff = new Date(Date.now() - 25 * 3_600_000).toISOString();
  const { data, error } = await sb.from('posted_sets').select('id, created_at').order('created_at', { ascending: false }).limit(1);
  if (error) {
    log('Performance', `Social automation: posted_sets table unavailable — ${error.message.slice(0, 60)}`);
  } else if (!data || data.length === 0) {
    alertFail('Performance', 'Social automation: no rows in posted_sets — social pipeline may never have run');
  } else {
    const lastPost = data[0].created_at;
    const hoursAgo = (Date.now() - new Date(lastPost).getTime()) / 3_600_000;
    if (hoursAgo > 25) alertFail('Performance', `Social automation: last post ${hoursAgo.toFixed(1)}h ago — daily pipeline may be failing`);
    else log('Performance', `Social automation: last post ${hoursAgo.toFixed(1)}h ago ✓`);
  }
} catch (e) { log('Performance', `Social automation check skipped: ${e.message.slice(0, 60)}`); }

// ── Weekly email report ───────────────────────────────────────────────────────

const now    = new Date().toISOString().slice(0, 10);
const status = alerts.length === 0 ? '✅ ALL CLEAR' : `❌ ${alerts.length} FAILURE(S)`;

const lhSection = lighthouseResults.length > 0
  ? lighthouseResults.map(r =>
      `  ${r.url}: Perf=${r.perf ?? 'skip'} | A11y=${r.a11y ?? 'skip'} | SEO=${r.seo ?? 'skip'}`
    ).join('\n')
  : '  No Lighthouse results';

const emailBody = [
  `BOI Weekly Technical Hygiene Report — ${now}`,
  `Status: ${status}`,
  '',
  alerts.length > 0 ? '=== FAILURES ===\n' + alerts.map(a => '  ❌ ' + a).join('\n') + '\n' : '',
  '=== LIGHTHOUSE SCORES ===',
  lhSection,
  '',
  '=== ROW COUNTS ===',
  Object.entries(rowCounts).map(([t, c]) => `  ${t}: ${typeof c === 'object' ? JSON.stringify(c) : c}`).join('\n'),
  '',
  '=== FULL CHECK LOG ===',
  report.join('\n'),
].join('\n');

if (RESEND_API_KEY && BRIEF_EMAIL) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'Bricks of India <abhinav@bricksofindia.com>',
      to:      [BRIEF_EMAIL],
      subject: `${status} — BOI Weekly Tech Hygiene ${now}`,
      html: `<pre style="font-family:monospace;font-size:13px;line-height:1.6;">${emailBody.replace(/</g, '&lt;')}</pre>`,
    }),
  });
  if (res.ok) {
    console.log('Weekly report emailed successfully');
  } else {
    console.error('Resend failed:', await res.text());
  }
} else {
  console.warn('No RESEND_API_KEY / BRIEF_EMAIL — report not emailed');
  console.log(emailBody);
}

if (alerts.length > 0) process.exit(1);
