'use strict';
/**
 * RADAR-01 fetcher — multi-tier RSS/API/scrape/reddit/youtube ingestion.
 *
 * Reads config/sources.json, fetches each source, normalises items, writes
 * to raw_signals with dedup_status='pending'. Dedup is RADAR-02's job.
 *
 * Usage:
 *   node scripts/radar/fetch-rss.js --limit 5 --dry-run
 *   node scripts/radar/fetch-rss.js --source "Brickset"
 *   node scripts/radar/fetch-rss.js --limit 10
 */

require('dotenv').config({ path: '.env.local' });

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const RSSParser = require('rss-parser');
const cheerio   = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

// ── Constants ─────────────────────────────────────────────────────────────────
const UA           = 'BricksOfIndia-RadarBot/1.0 (+https://bricksofindia.com)';
const SOURCES_PATH = path.join(__dirname, '../../config/sources.json');

// ── Env validation ────────────────────────────────────────────────────────────
const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REBRICKABLE_KEY      = process.env.REBRICKABLE_API_KEY;

if (!SUPABASE_URL)         throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
if (!SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
// REBRICKABLE_KEY absence handled per-source (log + skip, don't crash)

// ── CLI parsing ───────────────────────────────────────────────────────────────
const argv          = process.argv.slice(2);
const DRY_RUN       = argv.includes('--dry-run');
const LIMIT         = (() => {
  const i = argv.indexOf('--limit');
  return i !== -1 ? parseInt(argv[i + 1], 10) : Infinity;
})();
const SOURCE_FILTER = (() => {
  const i = argv.indexOf('--source');
  return i !== -1 ? argv[i + 1] : null;
})();

// ── Clients ───────────────────────────────────────────────────────────────────
const supabase  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// rss-parser: set UA + extract yt:videoId from YouTube Atom feeds.
// xml2js left at defaults (strict mode). New Elementary and Brickset are
// disabled in config (enabled:false) pending PARSER-01 (parser swap to
// feedparser or @extractus/feed-extractor for malformed-feed tolerance).
const rssParser = new RSSParser({
  headers      : { 'User-Agent': UA },
  customFields : { item: ['yt:videoId'] },
  timeout      : 15000,
});

// ── Normalisation helpers ─────────────────────────────────────────────────────
function sha256(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function hashUrl(rawUrl) {
  try {
    const u = new URL(rawUrl.toLowerCase());
    // Strip trailing slash from non-root paths
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    // Sort query params alphabetically by key
    const sorted = [...u.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
    u.search = '';
    sorted.forEach(([k, v]) => u.searchParams.append(k, v));
    return sha256(u.toString());
  } catch {
    return sha256(rawUrl.toLowerCase().replace(/\/$/, ''));
  }
}

function hashTitle(title) {
  return sha256(title.trim().toLowerCase().replace(/\s+/g, ' '));
}

function buildSignal({ sourceName, sourceTier, sourceType, externalId,
                        url, title, body, publishedAt, rawPayload }) {
  return {
    source_name    : sourceName,
    source_tier    : sourceTier,
    source_type    : sourceType,
    external_id    : externalId || null,
    url,
    url_hash       : hashUrl(url),
    title,
    title_hash     : hashTitle(title),
    body           : body || null,
    published_at   : publishedAt ? new Date(publishedAt).toISOString() : null,
    raw_payload    : rawPayload,
    dedup_status   : 'pending',
    dedup_group_id : null,
  };
}

// ── Write (no-op in dry-run) ──────────────────────────────────────────────────
async function writeSignals(signals) {
  if (signals.length === 0) return;
  const { error } = await supabase.from('raw_signals').insert(signals);
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
}

// ── Dry-run item logger ───────────────────────────────────────────────────────
function logSignal(signal) {
  const pub = signal.published_at
    ? signal.published_at.slice(0, 10)
    : 'no-date';
  const extId = signal.external_id ? ` ext=${signal.external_id}` : '';
  console.log(
    `  → title="${signal.title.slice(0, 65)}"` +
    ` | ${pub}${extId}` +
    ` | url_hash:${signal.url_hash.slice(0, 8)}` +
    ` | body=${signal.body ? signal.body.length + 'ch' : 'null'}`
  );
}

// ── Handlers ──────────────────────────────────────────────────────────────────

// Tier 1 RSS + Tier 2 Brickset: full body kept
async function handleRss(source, tier) {
  const res  = await fetch(source.url, {
    headers: { 'User-Agent': UA },
    signal : AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${source.url}`);
  const xml  = await res.text();
  const feed = await rssParser.parseString(xml);
  const items   = feed.items.slice(0, LIMIT);
  const signals = items.map(item => buildSignal({
    sourceName  : source.name,
    sourceTier  : tier,
    sourceType  : 'rss',
    externalId  : item.guid || item.id || null,
    url         : item.link || item.url || '',
    title       : (item.title || '').trim(),
    body        : item.contentSnippet || item.content || item['content:encoded'] || null,
    publishedAt : item.pubDate || item.isoDate || null,
    rawPayload  : item,
  }));
  return { fetched: items.length, signals };
}

// Tier 2 Rebrickable API
async function handleRebrickable(source) {
  if (!REBRICKABLE_KEY) throw new Error('REBRICKABLE_API_KEY not set');
  const res  = await fetch(source.url, {
    headers: { 'User-Agent': UA, 'Authorization': `key ${REBRICKABLE_KEY}` },
  });
  if (!res.ok) throw new Error(`Rebrickable API HTTP ${res.status}`);
  const data    = await res.json();
  const items   = (data.results || []).slice(0, LIMIT);
  const signals = items.map(set => buildSignal({
    sourceName  : source.name,
    sourceTier  : 2,
    sourceType  : 'api',
    externalId  : set.set_num || null,
    url         : set.set_url || `https://rebrickable.com/sets/${set.set_num}/`,
    title       : (set.name || set.set_num || '').trim(),
    body        : null,
    publishedAt : set.last_modified_dt || null,
    rawPayload  : set,
  }));
  return { fetched: items.length, signals };
}

// Tier 2 LEGO New Sets — best-effort scrape.
// NOTE: lego.com is a Next.js SPA; bare fetch() gets the SSR shell only.
// Product listings are rendered client-side. Expect fetched=0 in most runs.
// This is a known limitation, not a bug.
async function handleLEGONewSets(source) {
  const res  = await fetch(source.url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`LEGO New Sets HTTP ${res.status}`);
  const html = await res.text();
  const $    = cheerio.load(html);

  const seen  = new Set();
  const items = [];

  $('a[href]').each((_, el) => {
    if (items.length >= LIMIT) return false;
    const href = $(el).attr('href') || '';
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!href || !text || text.length < 8) return;
    let abs;
    try { abs = href.startsWith('http') ? href : `https://www.lego.com${href}`; }
    catch { return; }
    // LEGO product pages contain /products/ or set number patterns
    if (!abs.includes('/products/') && !abs.match(/\/\d{4,6}-/)) return;
    if (seen.has(abs)) return;
    seen.add(abs);
    items.push({ title: text, url: abs });
  });

  if (items.length === 0) {
    console.log(`  [${source.name}] Warning: 0 product links found — likely SPA-rendered content (expected)`);
  }

  const signals = items.map(item => buildSignal({
    sourceName  : source.name,
    sourceTier  : 2,
    sourceType  : 'scrape',
    externalId  : null,
    url         : item.url,
    title       : item.title,
    body        : null,
    publishedAt : null,
    rawPayload  : item,
  }));
  return { fetched: items.length, signals };
}

// Tier 3 r/lego JSON
async function handleReddit(source) {
  const res = await fetch(source.url, { headers: { 'User-Agent': UA } });
  if (res.status === 403) {
    console.log(`  [${source.name}] HTTP 403 — Reddit blocking automated requests, skipping`);
    return { fetched: 0, signals: [], skipped: true };
  }
  if (!res.ok) throw new Error(`Reddit HTTP ${res.status}`);
  const data = await res.json();

  const excludeFlairs = new Set(source.filters?.exclude_flairs || []);
  const minScore      = source.filters?.min_upvotes || 0;

  const qualifying = (data?.data?.children || []).filter(c => {
    const d = c?.data;
    if (!d) return false;
    if ((d.score || 0) < minScore) return false;
    if (d.link_flair_text && excludeFlairs.has(d.link_flair_text)) return false;
    return true;
  }).slice(0, LIMIT);

  const signals = qualifying.map(c => {
    const d = c.data;
    return buildSignal({
      sourceName  : source.name,
      sourceTier  : 3,
      sourceType  : 'reddit',
      externalId  : d.id || null,
      url         : d.url || `https://www.reddit.com${d.permalink}`,
      title       : (d.title || '').trim(),
      body        : d.selftext || null,
      publishedAt : d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
      rawPayload  : d,
    });
  });
  return { fetched: qualifying.length, signals };
}

// Tier 4 YouTube channel RSS (Atom feeds via rss-parser)
async function handleYouTube(source) {
  const res  = await fetch(source.url, {
    headers: { 'User-Agent': UA },
    signal : AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${source.url}`);
  const xml  = await res.text();
  const feed = await rssParser.parseString(xml);
  const items   = feed.items.slice(0, LIMIT);
  const signals = items.map(item => {
    const videoId = item['yt:videoId'] || extractYouTubeVideoId(item.link || '');
    return buildSignal({
      sourceName  : source.name,
      sourceTier  : 4,
      sourceType  : 'youtube',
      externalId  : videoId || null,
      url         : item.link || '',
      title       : (item.title || '').trim(),
      body        : null,                      // body stripped — Tier 4 YouTube: title+url+date only
      publishedAt : item.pubDate || item.isoDate || null,
      rawPayload  : item,
    });
  });
  return { fetched: items.length, signals };
}

function extractYouTubeVideoId(url) {
  try { return new URL(url).searchParams.get('v') || null; }
  catch { return null; }
}

// Tier 5 RSS (Brick Fanatics) — parse RSS, hard-strip body regardless of content
async function handleTier5Rss(source) {
  const res  = await fetch(source.url, {
    headers: { 'User-Agent': UA },
    signal : AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${source.url}`);
  const xml  = await res.text();
  const feed = await rssParser.parseString(xml);
  const items   = feed.items.slice(0, LIMIT);
  const signals = items.map(item => buildSignal({
    sourceName  : source.name,
    sourceTier  : 5,
    sourceType  : 'rss',
    externalId  : item.guid || item.id || null,
    url         : item.link || '',
    title       : (item.title || '').trim(),
    body        : null,                        // Hard-stripped: Tier 5 constraint. RSS body available but discarded.
    publishedAt : item.pubDate || item.isoDate || null,
    rawPayload  : item,
  }));
  return { fetched: items.length, signals };
}

// Tier 5 scrape (Blocks Magazine, LEGO Ideas Blog, Eurobricks)
// Headline + URL only. Same-host links with meaningful text.
async function handleTier5Scrape(source) {
  const res  = await fetch(source.url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Scrape HTTP ${res.status}`);
  const html = await res.text();
  const $    = cheerio.load(html);
  const base = new URL(source.url);

  const seen  = new Set();
  const items = [];

  $('a[href]').each((_, el) => {
    if (items.length >= LIMIT) return false;
    const href = $(el).attr('href') || '';
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!text || text.length < 12) return;
    let abs;
    try { abs = new URL(href, base).toString(); }
    catch { return; }
    try { if (new URL(abs).hostname !== base.hostname) return; }
    catch { return; }
    if (seen.has(abs)) return;
    seen.add(abs);
    items.push({ title: text, url: abs });
  });

  if (items.length === 0) {
    console.log(`  [${source.name}] Warning: 0 article links found on page`);
  }

  const signals = items.map(item => buildSignal({
    sourceName  : source.name,
    sourceTier  : 5,
    sourceType  : 'scrape',
    externalId  : null,
    url         : item.url,
    title       : item.title,
    body        : null,                        // Hard-stripped: Tier 5 constraint.
    publishedAt : null,
    rawPayload  : item,
  }));
  return { fetched: items.length, signals };
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
async function processSource(source, tier) {
  const stats = { fetched: 0, normalized: 0, written: 0, skipped: 0, errors: 0 };
  let signals = [];

  try {
    let result;
    if      (tier === 1)                            result = await handleRss(source, 1);
    else if (tier === 2 && source.method === 'rss') result = await handleRss(source, 2);
    else if (tier === 2 && source.method === 'api') result = await handleRebrickable(source);
    else if (tier === 2 && source.method === 'scrape') result = await handleLEGONewSets(source);
    else if (tier === 3)                            result = await handleReddit(source);
    else if (tier === 4)                            result = await handleYouTube(source);
    else if (tier === 5 && source.method === 'rss') result = await handleTier5Rss(source);
    else if (tier === 5)                            result = await handleTier5Scrape(source);
    else throw new Error(`Unhandled: tier=${tier} method=${source.method}`);

    stats.fetched = result.fetched;
    if (result.skipped) stats.skipped = result.fetched || 1;
    signals = result.signals || [];
    stats.normalized = signals.length;

  } catch (err) {
    stats.errors = 1;
    console.log(`  [${source.name}] ERROR: ${err.message}`);
  }

  // Write or dry-run log
  if (signals.length > 0) {
    if (DRY_RUN) {
      signals.forEach(logSignal);
    } else {
      try {
        await writeSignals(signals);
        stats.written = signals.length;
      } catch (err) {
        stats.errors += 1;
        console.log(`  [${source.name}] WRITE ERROR: ${err.message}`);
      }
    }
  }

  const typeLabel =
    tier === 3 ? 'reddit' :
    tier === 4 ? 'youtube' :
    source.method || 'rss';

  console.log(
    `[${source.name}] tier=${tier} type=${typeLabel}` +
    ` fetched=${stats.fetched} normalized=${stats.normalized}` +
    ` written=${stats.written} skipped=${stats.skipped} errors=${stats.errors}`
  );
  return stats;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const t0          = Date.now();
  const sourcesData = JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf8'));

  const allSources = [
    ...sourcesData.tier_1_editorial.map(s  => ({ ...s, tier: 1 })),
    ...sourcesData.tier_2_official.map(s   => ({ ...s, tier: 2 })),
    ...sourcesData.tier_3_community.map(s  => ({ ...s, tier: 3 })),
    ...sourcesData.tier_4_youtube.map(s    => ({ ...s, tier: 4 })),
    ...sourcesData.tier_5_topic_only.map(s => ({ ...s, tier: 5 })),
  ];

  const toProcess = SOURCE_FILTER
    ? allSources.filter(s => s.name === SOURCE_FILTER)
    : allSources;

  if (SOURCE_FILTER && toProcess.length === 0) {
    console.error(`No source with name: "${SOURCE_FILTER}"`);
    process.exit(1);
  }

  const mode = DRY_RUN ? ' [DRY-RUN]' : '';
  const lim  = LIMIT === Infinity ? 'unlimited' : LIMIT;
  console.log(`━━ RADAR-01 fetcher${mode} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Sources: ${toProcess.length} | Limit per source: ${lim}`);
  console.log('');

  const totals = { sources: 0, fetched: 0, written: 0, skipped: 0, errors: 0 };

  for (const source of toProcess) {
    // Skip sources explicitly disabled in config (enabled === false)
    if (source.enabled === false) {
      console.log(`[${source.name}] tier=${source.tier} SKIPPED (disabled in config)`);
      continue;
    }
    const s  = await processSource(source, source.tier);
    totals.sources += 1;
    totals.fetched += s.fetched;
    totals.written += s.written;
    totals.skipped += s.skipped;
    totals.errors  += s.errors;
  }

  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('');
  console.log(
    `RUN SUMMARY: sources=${totals.sources}` +
    ` total_fetched=${totals.fetched}` +
    ` total_written=${totals.written}` +
    ` total_skipped=${totals.skipped}` +
    ` total_errors=${totals.errors}` +
    ` duration=${dur}s`
  );
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
