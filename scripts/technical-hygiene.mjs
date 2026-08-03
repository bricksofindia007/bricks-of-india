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
import { genuinelyAvailableAtToycra } from '../src/lib/toycra-availability.ts';

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
        // Bug fixed 2026-06-30: Node's native fetch requires an absolute
        // URL — passing a relative path like '/fallback-hero.png' throws
        // "Failed to parse URL from /fallback-hero.png" immediately, which
        // the catch block below silently counted as a broken hero image.
        // The image itself was never actually broken (browsers resolve
        // relative URLs against the page's own origin automatically); this
        // was purely the audit script failing to construct a fetchable URL.
        // Resolve relative paths against SITE_URL, same as every other
        // route check in this file, before fetching.
        const heroUrl = row.hero_image.startsWith('/')
          ? `${SITE_URL}${row.hero_image}`
          : row.hero_image;
        // HEAD -> GET + Range fixed 2026-06-30: 2 external hero_image URLs
        // (jaysbrickblog.com) returned HTTP 415 from this check's HEAD
        // request specifically when run on the GitHub Actions runner --
        // confirmed NOT reproducible via curl, an isolated Node fetch, or a
        // 51-request concurrent burst, all run from outside the runner.
        // Root cause not fully pinned down (most likely the runner's
        // network path hitting a different CDN/WAF edge rule than local
        // traffic, since Node version was ruled out -- this workflow's
        // setup-node step requests Node 20, not 24). Rather than keep
        // chasing an external server's exact behavior, switched to GET with
        // Range: bytes=0-0 -- downloads at most 1 byte, confirms
        // reachability, sidesteps whatever specifically dislikes a bare
        // HEAD from this runner. A server that honors the Range header
        // returns 206 Partial Content (res.ok is still true for 206); a
        // server that ignores it returns a normal 200 with the full body,
        // which is also fine since we only check status, not body length.
        const res = await fetch(heroUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'BOI-TechHygiene/1.0', Range: 'bytes=0-0' },
          signal: AbortSignal.timeout(8_000),
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
const stores = ['mybrickhouse', 'toycra'];
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
// Uses City theme (Technic is not stocked by Toycra/MBH — acceptable, not a regression)
//
// Bug fixed 2026-06-30 (MEDIUM-48): this previously sampled the first 20
// `sets` rows for theme='City' with NO ordering, then checked whether ANY
// of those 20 specific IDs had a store_prices row. Postgres makes no
// ordering guarantee without ORDER BY, so the sample was effectively
// random row-storage order each run -- confirmed live: one unordered
// LIMIT 20 returned a batch dominated by old/bundle/non-buildable SKUs
// (a 2013 advent calendar, a "City Playmat", several "Super Pack 4 in 1"
// bundles, a 2003-era polybag) with only 4 of those 20 specific IDs
// having any price -- not because City has a real coverage gap, but
// because that specific unlucky sample mostly missed the sets that
// actually carry prices. Verified the real picture by querying coverage
// directly instead of sampling: City has prices for 28/261 sets (10.7%)
// -- more than double the catalogue-wide average of 4.38% (1,091/24,909
// total sets have any price at all; store_prices only covers what
// Toycra/MyBrickHouse actually stock, a small slice of LEGO's full
// historical catalogue, so a low raw percentage is normal everywhere,
// not City-specific). City was never under-covered; the check's PASS/FAIL
// outcome was just luck-of-row-order on an unordered sample.
//
// Fix: query City set_numbers and store_prices set_ids as two plain
// queries, intersect in JS. Originally drafted as a PostgREST embedded
// join (`store_prices.select('set_id, sets!inner(theme)')`), but verified
// against information_schema.table_constraints first -- there is NO
// foreign key relationship between store_prices and sets (confirmed: zero
// rows returned for an FK lookup on store_prices). PostgREST's `!inner`
// embedded-resource syntax requires a declared FK to know how to join two
// tables; it cannot infer one from matching column values alone, so that
// version would have failed outright rather than working. This version
// makes no such assumption -- it fetches City set_numbers and all
// store_prices.set_id values as two independent, well-understood queries
// and checks for overlap in JS, which is correct regardless of whether a
// FK exists.
try {
  const { data: citySets } = await sb.from('sets').select('set_number').eq('theme', 'City');
  const cityNums = new Set((citySets ?? []).map(s => s.set_number));

  let allPricedIds = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb.from('store_prices').select('set_id').range(offset, offset + PAGE - 1);
    if (error) throw error;
    allPricedIds = allPricedIds.concat((data ?? []).map(r => r.set_id));
    if ((data ?? []).length < PAGE) break;
  }
  const cityPriceCount = allPricedIds.filter(id => cityNums.has(id)).length;

  if (!cityPriceCount) {
    alertFail('DataIntegrity', 'No store_prices rows for any City set — related set cards will show no prices');
  } else {
    log('DataIntegrity', `Related-set prices: ${cityPriceCount} store_prices rows across City sets ✓`);
  }
} catch (e) {
  alertFail('DataIntegrity', `Related-set price check failed: ${e.message.slice(0, 80)}`);
}

// 7b. store_prices has rows for at least 2 distinct stores (Jaiman removed 2026-05-31)
try {
  const { data: storeRows } = await sb.from('store_prices').select('store_id').limit(3000);
  const storeIds = new Set((storeRows ?? []).map(r => r.store_id));
  if (storeIds.size < 2) {
    alertFail('DataIntegrity', `Only ${storeIds.size} store(s) with data in store_prices — expected ≥ 2 (${[...storeIds].join(', ')})`);
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
    a => a.content?.includes('₹') && /\b(Toycra|MyBrickHouse)\b/i.test(a.content)
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
  const stores = ['toycra', 'mybrickhouse'];
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

// 8b. Stale store_prices — both stores must have data scraped within 25h
try {
  const stores = ['toycra', 'mybrickhouse'];
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
//
// Bug fixed 2026-06-30 (HIGH-48): this measured missing pieces across the
// ENTIRE sets table, including non-buildable merchandise themes (Plush
// Toys, Key Chain, Bags/Totes, Story Books, Gear, Stationery, Clocks, etc.)
// and multi-set bundle/pack/advent-calendar products, neither of which has
// a meaningful single piece count to report -- their absence is correct
// data, not a gap. Confirmed live before changing this: HIGH-48's own open
// question ("is the 27% concentrated in a specific theme, or spread
// evenly?") had a clean, verifiable answer -- real flagship building
// themes (Ninjago 1.3%, Technic 3.0%, Creator 3.0%, Icons 2.5%,
// Architecture 2.0%) were all in single digits the whole time; the 27.6%
// headline figure was almost entirely the non-buildable categories above.
// Excluding both brings the genuine gap to ~6% (verified directly against
// Supabase: 1,053/17,558), just over the existing 5% threshold for
// legitimate reasons (older/rare sets, regional exclusives, incomplete
// upstream Rebrickable/Brickset data) -- a real, small, worth-monitoring
// gap, not a 27% "catalogue may be degraded" false alarm.
//
// Implementation note: deliberately NOT using a server-side PostgREST
// `.not('theme', 'in', '(...)')` filter here, even though one was drafted
// and the equivalent raw SQL was verified correct against live data. The
// generated filter string requires precise quoting for theme names
// containing commas (e.g. "Bags, Totes, & Luggage") and the exact
// supabase-js request this produces could not be executed from the
// sandbox used to write this fix (no live credentials) to confirm it's
// not malformed -- and a known supabase-js bug exists for a related
// `.not(col, 'in', array)` array-argument form (om itting parentheses
// entirely). Rather than ship a query whose correctness is unverified by
// actual execution, this fetches only the columns needed (theme, name,
// pieces, year -- not select('*'), to keep the payload small even at
// ~25k rows) and does the exclusion filtering in plain JS, which can be
// reasoned about with certainty.
const NON_BUILDABLE_THEMES = new Set([
  'Role Play Toys and Costumes', 'Plush Toys', 'Bags, Totes, & Luggage',
  'Bag and Luggage Tags', 'Houseware', 'Video Games and Accessories',
  'Key Chain', 'Story Books', 'Gear', 'Stationery and Office Supplies',
  'Storage', 'Non-fiction Books', 'Ideas Books', 'Clocks and Watches',
]);
const BUNDLE_NAME_RE = /\b(bundle|pack|advent|gift set|collection|kit)\b/i;

function isBuildableSet(row) {
  if (NON_BUILDABLE_THEMES.has(row.theme)) return false;
  if (BUNDLE_NAME_RE.test(row.name || '')) return false;
  return true;
}

try {
  let allSets = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb.from('sets').select('theme, name, pieces, year').range(offset, offset + PAGE - 1);
    if (error) throw error;
    allSets = allSets.concat(data ?? []);
    if ((data ?? []).length < PAGE) break;
  }
  const buildable = allSets.filter(isBuildableSet);
  const total = buildable.length;
  const missingPieces = buildable.filter(s => s.pieces == null || s.pieces === 0).length;
  const missingYear   = buildable.filter(s => s.year == null).length;
  const pctPieces = total ? Math.round((missingPieces / total) * 100) : 0;
  const pctYear   = total ? Math.round((missingYear   / total) * 100) : 0;
  log('CatalogCoverage', `Buildable sets missing pieces: ${missingPieces}/${total} (${pctPieces}%) | missing year: ${missingYear}/${total} (${pctYear}%) [${allSets.length - total} non-buildable merch/bundle products excluded]`);
  if (pctPieces > 5) alertFail('CatalogCoverage', `${pctPieces}% of buildable sets missing pieces data — catalogue may be degraded`);
  if (pctYear   > 5) alertFail('CatalogCoverage', `${pctYear}% of buildable sets missing year data — catalogue may be degraded`);
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
  const stores8l = ['toycra', 'mybrickhouse'];
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
      // Same relative-path bug as the HeroImages check above — see that
      // fix's comment for the full explanation. Resolve against SITE_URL.
      // Also same HEAD->GET+Range fix — see that comment for why.
      const heroUrl = a.hero_image.startsWith('/') ? `${SITE_URL}${a.hero_image}` : a.hero_image;
      const r = await fetch(heroUrl, { method: 'GET', headers: { 'User-Agent': 'BOI-TechHygiene/1.0', Range: 'bytes=0-0' }, signal: AbortSignal.timeout(8_000) });
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
      // Same relative-path bug as the two HeroImages checks above — fixed
      // proactively here even though all 3 reviews currently have real
      // external URLs (passes by luck, not by correctness) — this would
      // misfire the moment any review row gets hero_image='/fallback-hero.png'.
      // Also same HEAD->GET+Range fix — see HeroImages check's comment.
      const heroUrl = r.hero_image.startsWith('/') ? `${SITE_URL}${r.hero_image}` : r.hero_image;
      const res = await fetch(heroUrl, { method: 'GET', headers: { 'User-Agent': 'BOI-TechHygiene/1.0', Range: 'bytes=0-0' }, signal: AbortSignal.timeout(8_000) });
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

// 10b. Homepage deals — store_prices has in_stock rows (catches scraper regression)
// Query mirrors fixed homepage: store_prices-first, not sets-first.
try {
  const { count: inStockCount } = await sb.from('store_prices')
    .select('*', { count: 'exact', head: true }).eq('in_stock', true);
  if (!inStockCount || inStockCount === 0) {
    alertFail('Homepage', 'No in_stock store_prices rows — homepage deal cards will be empty');
  } else {
    log('Homepage', `Deals price coverage: ${inStockCount} in_stock store_prices rows ✓`);
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
//
// Bug fixed 2026-06-30 (MEDIUM-50): this checked text.includes('OK'), but
// Brickset's v3 API (confirmed against their own documentation and forum:
// "checkKey... will return a 'Success' if your API key is valid") responds
// with JSON {"status":"success"} on a genuinely valid key — there is no
// "OK" substring in a healthy response, ever. This check was alerting on
// the documented success case, not on any real key/auth problem. The key
// itself was never invalid; the check was looking for the wrong string.
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
      if (/"status"\s*:\s*"success"/i.test(text)) log('ExtDependencies', `Brickset API: key valid ✓`);
      else alertFail('ExtDependencies', `Brickset API: key check returned "${text.slice(0, 60)}"`);
    }
  }
} catch (e) { alertFail('ExtDependencies', `Brickset API error: ${e.message.slice(0, 80)}`); }

// 12c: Shopify store endpoints return 200
const SHOPIFY_ENDPOINTS = [
  { name: 'Toycra',       url: 'https://www.toycra.com/collections/lego/products.json?limit=1' },
  { name: 'MyBrickHouse', url: 'https://lego.mybrickhouse.com/products.json?limit=1' },
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

// 12i: robots.txt — 23+ User-agent blocks, each with Allow+4 Disallows (GEO-AUDIT-FIX-01 Phase 1)
try {
  const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bricksofindia.com').replace(/\/$/, '');
  const r = await fetch(`${SITE}/robots.txt`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) { alertFail('ExtDependencies', `robots.txt returned HTTP ${r.status}`); }
  else {
    const txt = await r.text();
    const REQUIRED_AGENTS = [
      'GPTBot','ChatGPT-User','OAI-SearchBot','ClaudeBot','anthropic-ai','Claude-Web',
      'Google-Extended','GoogleOther','PerplexityBot','Perplexity-User','CCBot','Bytespider',
      'Applebot','Applebot-Extended','FacebookBot','Meta-ExternalAgent','Amazonbot',
      'AI2Bot','YouBot','DuckAssistBot','cohere-ai','Diffbot',
    ];
    const REQUIRED_DISALLOWS = ['/admin/', '/api/', '/pending/', '/*?*draft='];
    const missing = [];
    for (const agent of REQUIRED_AGENTS) {
      const agentIdx = txt.indexOf(`User-agent: ${agent}`);
      if (agentIdx === -1) { missing.push(`${agent}: block missing`); continue; }
      const block = txt.slice(agentIdx, txt.indexOf('\n\n', agentIdx) + 1 || txt.length);
      for (const dis of REQUIRED_DISALLOWS) {
        if (!block.includes(`Disallow: ${dis}`)) missing.push(`${agent}: missing Disallow ${dis}`);
      }
      if (!block.includes('Allow: /')) missing.push(`${agent}: missing Allow: /`);
    }
    const uaCount = (txt.match(/^User-agent:/gm) || []).length;
    if (missing.length > 0) {
      alertFail('ExtDependencies', `robots.txt integrity failures (${missing.length}): ${missing.slice(0, 3).join('; ')}${missing.length > 3 ? '…' : ''}`);
    } else if (uaCount < 23) {
      alertFail('ExtDependencies', `robots.txt has only ${uaCount} User-agent blocks, expected >= 23`);
    } else {
      log('ExtDependencies', `robots.txt: ${uaCount} User-agent blocks, all 22 agents with required Allow+Disallows ✓`);
    }
  }
} catch (e) { alertFail('ExtDependencies', `robots.txt integrity check error: ${e.message.slice(0, 60)}`); }

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

const { data: last10News } = await sb.from('news_articles').select('slug, title, content, category, published_at')
  .not('content', 'is', null).order('published_at', { ascending: false }).limit(10);
const news10 = last10News ?? [];

// 14a: Word count, per-category range.
//
// Bug fixed 2026-06-30: this query pulls the 10 most recent news_articles
// rows with no category filter, but applies a single news-shaped 150-600
// range to all of them. category='Review' rows (RADAR-08's intentional
// routing -- reviews publish into news_articles, not just the 3 hand-
// curated /reviews/ pages) are correctly, deliberately longer: the same
// per-format targets already enforced at generation time
// (src/lib/lint.ts WORD_COUNT_TARGETS) put review's real fail-boundary at
// 375-875 words, not 150-600. Confirmed live: both articles this check
// flagged (668w, 762w) are genuine category='Review' rows comfortably
// inside the real 375-875 range -- not a content defect, a check-script
// bug applying the wrong category's rule. Mirrors WORD_COUNT_TARGETS'
// fail-boundary values directly rather than reimplementing/guessing new
// numbers, so the two checks can't drift apart again.
const WORD_COUNT_RANGES = {
  news:    [225,  500],
  review:  [375,  875],
  opinion: [300,  625],
  guide:   [525, 1250],
};
const wordCountFails = news10.filter(a => {
  const wc = (a.content || '').split(/\s+/).filter(Boolean).length;
  const [min, max] = WORD_COUNT_RANGES[(a.category || '').toLowerCase()] ?? WORD_COUNT_RANGES.news;
  return wc < min || wc > max;
});
if (wordCountFails.length > 0) {
  alertFail('ContentIntegrity', `${wordCountFails.length} article(s) outside their category's word range: ${wordCountFails.map(a => {
    const [min, max] = WORD_COUNT_RANGES[(a.category || '').toLowerCase()] ?? WORD_COUNT_RANGES.news;
    return `${a.slug}(${(a.content||'').split(/\s+/).filter(Boolean).length}w, category=${a.category}, range=${min}-${max})`;
  }).join(', ')}`);
} else {
  log('ContentIntegrity', `Word count: all ${news10.length} recent articles within their category's word range ✓`);
}

// 14b: HTML tags leaking in content
const htmlLeaks = news10.filter(a => /<(p|br|strong|em|div|span|h[1-6])\b/i.test(a.content || ''));
if (htmlLeaks.length > 0) alertFail('ContentIntegrity', `HTML tags leaking in ${htmlLeaks.length} article(s): ${htmlLeaks.map(a => a.slug).join(', ')}`);
else log('ContentIntegrity', `HTML leak check: clean ✓`);

// 14c: ABHINAV12 present when the set is genuinely, currently purchasable
// at Toycra (HIGH-49)
//
// Policy locked 2026-06-30 (Abhinav, explicit): "my code abhinav12 should
// only be mentioned if and when the set is available on toycra. if it is
// not available only there is absolutely no point in mentioning that.
// also, sets which will be import also do not need that message either."
//
// Bug fixed same day, two layers: (1) this previously ran against news10
// (the 10-most-recent-articles sample shared with unrelated spot-checks),
// the wrong scope for a partner-obligation compliance check -- a real gap
// doesn't become acceptable once 10 newer articles publish. Now scans the
// full table. (2) The original rule ("any Toycra mention requires the
// code") was too blunt and would have been WRONG to auto-fix against --
// manually classified all 8 originally-flagged articles against Abhinav's
// rule above and found only 2 of 8 actually need the code added
// (bossks-houndstooth..., lego-titanic-10294... -- both state a real,
// present-tense ₹ price at Toycra right now). The other 6 correctly
// describe sets as not-yet-available ("Toycra... will be the primary
// sources to watch for availability"), never carried ("MyBrickHouse and
// Toycra do not carry custom creations of this scale"), or possibly
// import-only ("potentially available at Toycra... or it might be an
// import-only affair") -- adding the code to those would have been a
// content error, not a fix. This check now implements that same
// distinction: only flags when a ₹ price figure appears within the same
// sentence as a Toycra mention AND that sentence contains no hedging/
// future-availability/import language. Verified against all 8 original
// real article texts -- correctly reproduces the manual classification
// 8/8 (2 genuine gaps, 6 correctly not flagged) before shipping.
try {
  const { data: allToycraArticles } = await sb.from('news_articles')
    .select('slug, content').ilike('content', '%toycra%');
  const toycraWithoutCode = (allToycraArticles ?? []).filter(a =>
    !/ABHINAV12/i.test(a.content || '') && genuinelyAvailableAtToycra(a.content || '')
  );
  if (toycraWithoutCode.length > 0) {
    alertFail('ContentIntegrity', `${toycraWithoutCode.length} article(s) state a real Toycra price without ABHINAV12 (full-table scan): ${toycraWithoutCode.map(a => a.slug).join(', ')}`);
  } else {
    log('ContentIntegrity', `ABHINAV12 code: present on all genuinely-available-at-Toycra articles (full-table scan, ${(allToycraArticles ?? []).length} total Toycra mentions checked) ✓`);
  }
} catch (e) {
  alertFail('ContentIntegrity', `ABHINAV12 check failed: ${e.message.slice(0, 80)}`);
}

// 14c2: India Paragraph store coverage (MEDIUM-49) — moved here from 14k
// below and rescoped to full-table for the same reason as 14c above.
//
// Bug fixed 2026-06-30: previously required BOTH 'toycra' AND 'mybrickhouse'
// to appear whenever any ₹ figure was present in the content, on the
// news10 sample only. Two real problems: (1) the same recency-window gap
// as 14c -- a real single-store-only article wouldn't be caught after
// aging out of the sample; (2) confirmed live the rule itself was wrong --
// an article correctly stating "no official Indian store price, import-
// only" can still contain a ₹ figure (a calculated import-price estimate,
// not a real store price), which the old regex couldn't distinguish from
// an actual missing-store-name bug. Example confirmed live:
// lego-disney-main-street-usa-43302... explicitly says "no official store
// prices... import only" while still quoting an estimated ₹12,349 --
// correct, honest content, not a defect. Fixed: only flag when a ₹ figure
// appears WITHOUT any of (a) a real store name, (b) explicit import/
// no-official-price language acknowledging the absence.
try {
  const { data: allPricedArticles } = await sb.from('news_articles')
    .select('slug, content').filter('content', 'not.is', null);
  const NO_STORE_LANGUAGE_RE = /import.only|no official store price|no.+(official|indian).+price|not.+(officially|yet).+available.+india/i;
  const missingStores = (allPricedArticles ?? []).filter(a => {
    const c = a.content || '';
    if (!/₹[\d,]+/.test(c)) return false;          // no price at all -- not in scope
    if (/toycra/i.test(c) || /mybrickhouse/i.test(c)) return false;  // has at least one real store -- fine
    if (NO_STORE_LANGUAGE_RE.test(c)) return false; // explicitly acknowledges import-only/no-store -- fine, honest
    return true;  // has a ₹ figure, no store name, no acknowledgement -- genuine gap
  });
  if (missingStores.length > 0) {
    alertFail('ContentIntegrity', `${missingStores.length} article(s) have price data but no store name and no import/no-price acknowledgement (full-table scan): ${missingStores.map(a => a.slug).join(', ')}`);
  } else {
    log('ContentIntegrity', `India Paragraph store coverage: clean (full-table scan) ✓`);
  }
} catch (e) {
  alertFail('ContentIntegrity', `Store coverage check failed: ${e.message.slice(0, 80)}`);
}

// 14d: Store names spelled correctly
// "My Brick House" (spaced) is flagged — brand name is "MyBrickHouse" (no spaces).
// If first run shows false positives from natural prose, remove the first entry and
// replace with a tighter pattern (e.g. only flag when preceded by "at " or "on ").
const MISSPELLINGS = [
  { re: /my\s+brick\s+house/i, correct: 'MyBrickHouse' },
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

// 14k removed 2026-06-30: superseded by the full-table-scoped MEDIUM-49 fix
// at 14c2 above (right after 14c/HIGH-49) -- see that block's comment for
// the full rationale. Running both would double-report the same finding.

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

// 15g: store_prices distribution — log only (threshold removed: 2-store config means one
// store will always be dominant; MBH skew is acceptable after Jaiman removal 2026-05-31)
try {
  const { data: storeRows } = await sb.from('store_prices').select('store_id').limit(3000);
  const total15 = (storeRows ?? []).length;
  const counts = {};
  for (const r of storeRows ?? []) counts[r.store_id] = (counts[r.store_id] ?? 0) + 1;
  log('Performance', `store_prices distribution: ${Object.entries(counts).map(([s, c]) => `${s}=${c} (${Math.round((c/total15)*100)}%)`).join(', ')}`);
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
  const { data, error } = await sb.from('posted_sets').select('id, posted_at').order('posted_at', { ascending: false }).limit(1);
  if (error) {
    log('Performance', `Social automation: posted_sets table unavailable — ${error.message.slice(0, 60)}`);
  } else if (!data || data.length === 0) {
    alertFail('Performance', 'Social automation: no rows in posted_sets — social pipeline may never have run');
  } else {
    const lastPost = data[0].posted_at;
    const hoursAgo = (Date.now() - new Date(lastPost).getTime()) / 3_600_000;
    if (hoursAgo > 25) alertFail('Performance', `Social automation: last post ${hoursAgo.toFixed(1)}h ago — daily pipeline may be failing`);
    else log('Performance', `Social automation: last post ${hoursAgo.toFixed(1)}h ago ✓`);
  }
} catch (e) { log('Performance', `Social automation check skipped: ${e.message.slice(0, 60)}`); }

// ── Check 16: Reviewed sets missing store_prices ─────────────────────────────
// 16a. Every set in the reviews table must have at least one store_prices row.
//      A reviewed set with no prices means the compare sidebar is empty on the
//      review page — the most important commercial surface on the site.
try {
  const { data: allReviewedSets } = await sb.from('reviews').select('set_id, title');
  // Exclude reviews with no matched catalog set (added 2026-08-03 -- a
  // review with set_id=null, e.g. the price-uncertain Ninjago Destiny's
  // Bounty board game review, has no set to check store_prices for. Worse,
  // passing that null through to .in('id', [...]) poisons the WHOLE query:
  // supabase-js renders it as the literal string "null" in the request URL,
  // and Postgres then fails the entire batch with 22P02 "invalid input
  // syntax for type uuid" -- one unmatched review broke the check for all
  // 131, not just itself. Confirmed live: exactly 1/131 reviews.set_id is
  // null.
  const reviewedSets = allReviewedSets.filter(r => r.set_id != null);
  const { data: setRows } = await sb.from('sets')
    .select('id, set_number')
    .in('id', reviewedSets.map(r => r.set_id));
  const setNumberMap = Object.fromEntries(setRows.map(s => [s.id, s.set_number]));
  const setNumbers = Object.values(setNumberMap);
  const { data: priceRows } = await sb.from('store_prices')
    .select('set_id')
    .in('set_id', setNumbers);
  const pricedSetNumbers = new Set(priceRows.map(p => p.set_id));
  const missing = reviewedSets.filter(r => !pricedSetNumbers.has(setNumberMap[r.set_id]));
  if (missing.length > 0) {
    alertFail('ReviewedSetPrices', `${missing.length} reviewed set(s) have no store_prices: ${missing.map(r => r.title).join(', ')}`);
  } else {
    log('ReviewedSetPrices', `all ${reviewedSets.length} reviewed sets have store_prices ✓`);
  }
} catch (e) { alertFail('ReviewedSetPrices', `check failed: ${e.message.slice(0, 80)}`); }

// ── Check 17: Reviews verdict enum ───────────────────────────────────────────
// 17a. All verdict values must be in VALID_VERDICTS. A rogue value ('BUY'
//      instead of 'BUY NOW') breaks the BOI Says verdict display component.
try {
  const VALID_VERDICTS17 = new Set(['BUY NOW', 'WAIT', 'IMPORT ONLY', 'AVOID']);
  const { data: reviewVerdicts } = await sb.from('reviews').select('id, title, verdict');
  const bad = (reviewVerdicts ?? []).filter(r => !VALID_VERDICTS17.has(r.verdict));
  if (bad.length > 0) {
    alertFail('ReviewVerdict', `${bad.length} review(s) have invalid verdict: ${bad.map(r => `${r.title}=${r.verdict}`).join(', ')}`);
  } else {
    log('ReviewVerdict', `all ${(reviewVerdicts ?? []).length} review verdicts valid ✓`);
  }
} catch (e) { alertFail('ReviewVerdict', `check failed: ${e.message.slice(0, 80)}`); }

// ── Check 18: Reviewed sets missing MRP ──────────────────────────────────────
// 18a. Sets that have a published review must have lego_mrp_inr populated.
//      MRP drives the "X% below MRP" callout on the review sidebar — null
//      means that line silently disappears.
try {
  const { data: reviewedSets } = await sb.from('reviews').select('set_id, title');
  const { data: setRows } = await sb.from('sets')
    .select('id, set_number, lego_mrp_inr')
    .in('id', (reviewedSets ?? []).map(r => r.set_id));
  const missingMrp = (setRows ?? []).filter(s => !s.lego_mrp_inr);
  if (missingMrp.length > 0) {
    alertFail('ReviewedSetMRP', `${missingMrp.length} reviewed set(s) missing lego_mrp_inr: ${missingMrp.map(s => s.set_number).join(', ')}`);
  } else {
    log('ReviewedSetMRP', `all ${(setRows ?? []).length} reviewed sets have MRP ✓`);
  }
} catch (e) { alertFail('ReviewedSetMRP', `check failed: ${e.message.slice(0, 80)}`); }

// ── Check 19: Pending drafts — generation backlog health ─────────────────────
// 19a. The generator filters on draft_body, not draft_title — null draft_title
//      pre-generation is expected, not a defect (corrected 2026-06-27, see
//      HIGH-50). Real signal is backlog age: rows that have outlived one full
//      worst-case FIFO cycle at current throughput without being picked up.
try {
  const { data: backlog } = await sb.from('pending_drafts')
    .select('id, created_at')
    .eq('status', 'approved')
    .is('draft_body', null);

  const total = (backlog ?? []).length;
  const staleCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const stale = (backlog ?? []).filter(d => d.created_at < staleCutoff);

  log('GenerationBacklog', `${total} approved row(s) awaiting generation (informational, FIFO by created_at)`);

  if (stale.length > 0) {
    alertFail('GenerationBacklogStale', `${stale.length} approved row(s) have waited 30+ days for generation: ${stale.slice(0, 3).map(d => d.id.slice(0, 8)).join(', ')}`);
  } else {
    log('GenerationBacklogStale', `no rows older than 30 days awaiting generation ✓`);
  }
} catch (e) { alertFail('GenerationBacklog', `check failed: ${e.message.slice(0, 80)}`); }

// ── Check 20: Per-store price row count regression ────────────────────────────
// 20a. If any store drops below its known baseline, the scraper has regressed
//      or the store changed its feed structure. Baselines from Day 31 audit:
//      Toycra ≥500, MBH ≥800.
try {
  const STORE_BASELINES = { toycra: 500, mybrickhouse: 800 };
  for (const [storeId, baseline] of Object.entries(STORE_BASELINES)) {
    const { count } = await sb.from('store_prices')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId);
    if ((count ?? 0) < baseline) {
      alertFail('StorePriceCount', `${storeId} has ${count} rows — below baseline of ${baseline}. Scraper may have regressed.`);
    } else {
      log('StorePriceCount', `${storeId}: ${count} rows ≥ ${baseline} ✓`);
    }
  }
} catch (e) { alertFail('StorePriceCount', `check failed: ${e.message.slice(0, 80)}`); }

// ── Check 21: Tier-1 RSS source freshness ────────────────────────────────────
// 21a. Each Tier-1 source must have at least one raw_signal fetched in the
//      last 48h. A dead Tier-1 source means we're missing editorial signals
//      from the most important feeds.
try {
  const TIER1_SOURCES = ['The Brothers Brick', "Jay's Brick Blog", 'BrickNerd', 'New Elementary'];
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  for (const source of TIER1_SOURCES) {
    const { count } = await sb.from('raw_signals')
      .select('*', { count: 'exact', head: true })
      .eq('source_name', source)
      .gte('fetched_at', cutoff);
    if (!count || count === 0) {
      alertFail('Tier1Source', `${source} has no signals in last 48h — source may be dead or feed URL changed`);
    } else {
      log('Tier1Source', `${source}: ${count} signal(s) in last 48h ✓`);
    }
  }
} catch (e) { alertFail('Tier1Source', `check failed: ${e.message.slice(0, 80)}`); }

// ── Check 22: guides featured_image_url coverage ─────────────────────────────
// 22a. Guides with null featured_image_url render a branded fallback gradient
//      (shipped Day 31). This check tracks the null count so we know when
//      images are actually populated — currently expected to be 9/9 null.
try {
  const [{ count: totalGuides }, { count: nullImages }] = await Promise.all([
    sb.from('guides').select('*', { count: 'exact', head: true }),
    sb.from('guides').select('*', { count: 'exact', head: true }).is('featured_image_url', null),
  ]);
  if (nullImages === totalGuides) {
    log('GuideImages', `${nullImages}/${totalGuides} guides using fallback gradient (no real images yet — expected) ✓`);
  } else if (nullImages > 0) {
    log('GuideImages', `${nullImages}/${totalGuides} guides still using fallback gradient, ${totalGuides - nullImages} have real images ✓`);
  } else {
    log('GuideImages', `all ${totalGuides} guides have featured_image_url ✓`);
  }
} catch (e) { alertFail('GuideImages', `check failed: ${e.message.slice(0, 80)}`); }

// ── Check 23: publish-drafts review routing guard ─────────────────────────────
// 23a. No slug should exist in both reviews and news_articles. This would
//      indicate a routing collision — review-format drafts land in news_articles
//      (category=Review); the reviews table is manually curated only.
try {
  const { data: reviewSlugs } = await sb.from('reviews').select('slug');
  const { data: newsSlugs }   = await sb.from('news_articles').select('slug');
  const newsSlugSet = new Set((newsSlugs ?? []).map(n => n.slug));
  const collisions = (reviewSlugs ?? []).filter(r => newsSlugSet.has(r.slug));
  if (collisions.length > 0) {
    alertFail('ReviewRouting', `${collisions.length} slug(s) exist in both reviews and news_articles: ${collisions.map(r => r.slug).join(', ')}`);
  } else {
    log('ReviewRouting', `no slug collisions between reviews and news_articles ✓`);
  }
} catch (e) { alertFail('ReviewRouting', `check failed: ${e.message.slice(0, 80)}`); }

// ── Group 16: Security Posture ────────────────────────────────────────────────
// Added: GEO-AUDIT-FIX-01 Phase 0

// 16a: pending_drafts inaccessible to anon role (RLS enforcement)
try {
  const anonClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { count, error } = await anonClient.from('pending_drafts').select('id', { count: 'exact', head: true });
  if (error) {
    log('SecurityPosture', `pending_drafts anon access: blocked (${error.code}) ✓`);
  } else if (count === 0) {
    log('SecurityPosture', `pending_drafts anon access: 0 rows (RLS policy blocking) ✓`);
  } else {
    alertFail('SecurityPosture', `pending_drafts LEAKING to anon role — ${count} rows exposed. Fix RLS immediately.`);
  }
} catch (e) { alertFail('SecurityPosture', `pending_drafts RLS check error: ${e.message.slice(0, 80)}`); }

// 16b: v_published_articles_public view exists and anon can SELECT
try {
  const anonClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await anonClient.from('v_published_articles_public').select('id').limit(1);
  if (error) {
    alertFail('SecurityPosture', `v_published_articles_public missing or anon access denied: ${error.message.slice(0, 80)}`);
  } else {
    log('SecurityPosture', 'v_published_articles_public accessible to anon ✓');
  }
} catch (e) { alertFail('SecurityPosture', `view check error: ${e.message.slice(0, 80)}`); }

// 16c: /admin routes return X-Robots-Tag: noindex
try {
  const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bricksofindia.com').replace(/\/$/, '');
  const r = await fetch(`${SITE}/admin/pending`, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8000) });
  const xrobots = r.headers.get('x-robots-tag') ?? '';
  if (xrobots.toLowerCase().includes('noindex')) {
    log('SecurityPosture', `X-Robots-Tag on /admin: "${xrobots}" ✓`);
  } else {
    alertFail('SecurityPosture', `/admin X-Robots-Tag missing or does not contain noindex — got: "${xrobots}"`);
  }
} catch (e) { log('SecurityPosture', `X-Robots-Tag /admin check skipped: ${e.message.slice(0, 60)}`); }

// 16d: homepage has a CSP or CSP-Report-Only header
try {
  const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bricksofindia.com').replace(/\/$/, '');
  const r = await fetch(`${SITE}/`, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
  const csp = r.headers.get('content-security-policy') ?? r.headers.get('content-security-policy-report-only') ?? '';
  if (csp && csp.includes('script-src')) {
    log('SecurityPosture', `CSP header present and contains script-src ✓`);
  } else {
    alertFail('SecurityPosture', `No CSP or CSP-Report-Only header on homepage, or script-src missing — got: "${csp.slice(0, 60)}"`);
  }
} catch (e) { log('SecurityPosture', `CSP check skipped: ${e.message.slice(0, 60)}`); }

// 16f: sitemap contains no admin/api/pending/draft URLs
try {
  const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bricksofindia.com').replace(/\/$/, '');
  const r = await fetch(`${SITE}/sitemap.xml`, { signal: AbortSignal.timeout(8000) });
  const xml = await r.text();
  const leaks = (xml.match(/https?:\/\/[^<]+/g) ?? []).filter(u => /\/admin|\/api\/|\/pending|draft=/.test(u));
  if (leaks.length > 0) {
    alertFail('SecurityPosture', `sitemap.xml contains ${leaks.length} sensitive URL(s): ${leaks[0]}`);
  } else {
    log('SecurityPosture', `sitemap.xml: no admin/api/pending/draft URLs ✓`);
  }
} catch (e) { log('SecurityPosture', `sitemap check skipped: ${e.message.slice(0, 60)}`); }

// 16e: no mailto: on homepage (email harvesting prevention)
try {
  const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bricksofindia.com').replace(/\/$/, '');
  const r = await fetch(`${SITE}/`, { signal: AbortSignal.timeout(8000) });
  const html = await r.text();
  if (html.includes('mailto:')) {
    alertFail('SecurityPosture', 'homepage HTML contains mailto: — email address exposed to harvesters');
  } else {
    log('SecurityPosture', 'homepage: no mailto: found ✓');
  }
} catch (e) { log('SecurityPosture', `mailto check skipped: ${e.message.slice(0, 60)}`); }

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
