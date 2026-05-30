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
