#!/usr/bin/env node
/**
 * Bricks of India — Shopify Price Scraper
 *
 * Fetches /products.json from each store, parses LEGO set numbers,
 * matches against Supabase inventory, then upserts store_prices and
 * appends to price_history.
 *
 * No HTML parsing. No Playwright. Pure Shopify JSON API.
 *
 * Usage:
 *   node scripts/scrape-now.mjs          # uses .env.local
 *   NEXT_PUBLIC_SUPABASE_URL=... node scripts/scrape-now.mjs  # CI
 *
 * Requires store_prices + price_history tables. Run the SQL migration first:
 *   scripts/migrations/001_store_prices.sql
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── Load .env.local when running locally ────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = join(__dirname, '../.env.local');
  const raw = readFileSync(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !process.env[key]) process.env[key] = val;
  }
} catch {
  // Running in CI — env vars come from GitHub Secrets
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Set via workflow_dispatch input `dry_run: true` — reads only, no Supabase writes.
const DRY_RUN = process.env.DRY_RUN === 'true';

const RESEND_KEY  = (process.env.RESEND_API_KEY || '').replace(/^﻿/, '').trim();
const ALERT_EMAIL = process.env.BRIEF_EMAIL || 'abhinav@bricksofindia.com';

// ── Store config ─────────────────────────────────────────────────────────────
// Toycra has a dedicated LEGO collection — avoids paging through thousands
// of non-LEGO toys. MyBrickHouse is LEGO-heavy so general path works.
const STORES = [
  {
    id:     'toycra',
    name:   'Toycra',
    domain: 'www.toycra.com',
    path:   '/collections/lego/products.json',
  },
  {
    id:     'mybrickhouse',
    name:   'MyBrickHouse',
    domain: 'lego.mybrickhouse.com',
    path:   '/products.json',
  },
];

// Module-level name lookup: lowercased set name → set_number. Populated in main().
// Used by parseProduct() MBH fallback when title/handle contains no set number.
const knownSetsByName = new Map();

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Exponential-backoff retry: 2 s, 4 s, 8 s */
async function withRetry(fn, retries = 3, baseMs = 2000) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      const delay = baseMs * 2 ** attempt;
      console.warn(`    Retry ${attempt + 1}/${retries} in ${delay / 1000}s: ${err.message}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/** Fetch all products from a Shopify store via paginated /products.json */
async function fetchAllProducts(domain, path) {
  const products = [];
  let page = 1;

  while (true) {
    const url = `https://${domain}${path}?limit=250&page=${page}`;
    console.log(`    Page ${page}: ${url}`);

    const data = await withRetry(async () => {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'BricksOfIndia/1.0 (+https://bricksofindia.com)', Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      return res.json();
    });

    const batch = data.products ?? [];
    if (batch.length === 0) break;
    products.push(...batch);
    if (batch.length < 250) break;
    page++;
    await new Promise((r) => setTimeout(r, 400)); // be polite
  }

  return products;
}

/**
 * Extract a LEGO set number (4–6 digits) from product handle then title.
 *
 * Handles are more structured than titles and checked first.
 * Supported title formats:
 *   "LEGO Icons 10497 Galaxy Explorer"
 *   "LEGO 10497 - Galaxy Explorer"
 *   "Galaxy Explorer (10497)"
 *   "10497 Galaxy Explorer"
 *   "LEGO® 10497 Galaxy Explorer"
 *
 * Returns null if no plausible set number found.
 */
function extractSetNumber(title, handle) {
  // Match standalone 4-6 digit sequences (not preceded/followed by another digit)
  const RE = /(?<!\d)(\d{4,6})(?!\d)/g;

  // Check handle FIRST — more structured and less likely to contain noise numbers
  const fromHandle = [...(handle ?? '').matchAll(RE)].map((m) => m[1]);
  const fromTitle  = [...(title  ?? '').matchAll(RE)].map((m) => m[1]);

  // Merge handle-first, deduplicated, return first candidate
  const candidates = [...new Set([...fromHandle, ...fromTitle])];
  return candidates[0] ?? null;
}

/** Parse a Shopify product into our internal format. Returns null to skip. */
function parseProduct(product, storeId, domain) {
  const titleLower  = (product.title  ?? '').toLowerCase();
  const handleLower = (product.handle ?? '').toLowerCase();

  // Skip products that don't appear to be LEGO sets.
  // mybrickhouse is a LEGO-only domain — their titles/handles often omit "lego"
  // (e.g. "Icons Natural History Museum Set 10326"). Skip the string check for
  // that store; the knownSets filter downstream is the real guard.
  if (storeId !== 'mybrickhouse' && !titleLower.includes('lego') && !handleLower.includes('lego')) return null;

  let setNumber = extractSetNumber(product.title, product.handle);
  if (!setNumber && storeId === 'mybrickhouse') {
    // Fallback: match against set name when title/handle omit the set number
    const cleaned = (product.title ?? '').toLowerCase().replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim().replace(/^the\s+/, '');
    setNumber = knownSetsByName.get(cleaned) ?? null;
  }
  if (!setNumber) return null;

  if (!product.variants?.length) return null;

  // Use cheapest in-stock variant; fall back to cheapest overall
  const inStockVariants = product.variants.filter((v) => v.available);
  const variant = inStockVariants.length
    ? inStockVariants.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0]
    : product.variants.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];

  const priceInr = variant.price ? Math.round(parseFloat(variant.price)) : null;
  const inStock  = inStockVariants.length > 0;
  const productUrl = `https://${domain}/products/${product.handle}`;

  return { setNumber, storeId, priceInr, inStock, productUrl };
}

// ── Scraper alert ────────────────────────────────────────────────────────────

async function sendScraperAlert(storeName, storeId, timestamp) {
  // Fetch last known row count from store_prices for context
  let lastCount = null;
  try {
    const { count } = await supabase
      .from('store_prices')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', storeId);
    lastCount = count;
  } catch { /* non-fatal */ }

  if (!RESEND_KEY) {
    console.warn(`  [alert] RESEND_API_KEY not set — skipping email alert for ${storeName}`);
    return;
  }
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(RESEND_KEY);
    await resend.emails.send({
      from:    'Bricks of India <abhinav@bricksofindia.com>',
      to:      ALERT_EMAIL,
      subject: `⚠️ BOI Scraper Alert — ${storeName} returned 0 rows`,
      text:    [
        `Store:             ${storeName}`,
        `Timestamp:         ${timestamp}`,
        `Matched rows:      0`,
        `Last known count:  ${lastCount ?? 'unknown'} rows in store_prices`,
        '',
        'This may indicate a scraper failure, website structure change, or store downtime.',
        '',
        'Check run logs:',
        'https://github.com/bricksofindia007/bricks-of-india/actions/workflows/scrape-prices.yml',
      ].join('\n'),
    });
    console.warn(`  [alert] Email sent — ${storeName} returned 0 rows`);
  } catch (err) {
    console.error(`  [alert] Email failed: ${err.message}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`\nBricks of India Shopify Scraper — ${startedAt}${DRY_RUN ? '  [DRY RUN — reads only, no Supabase writes]' : ''}\n`);

  // Verify tables exist
  const { error: tableCheck } = await supabase.from('store_prices').select('id').limit(1);
  if (tableCheck?.code === 'PGRST205') {
    console.error('ERROR: store_prices table not found.');
    console.error('Run the SQL migration first:');
    console.error('  → Supabase Dashboard → SQL Editor → paste scripts/migrations/001_store_prices.sql');
    process.exit(1);
  }

  // Load known set numbers from Supabase for matching (paginate to bypass 1000-row PostgREST cap)
  console.log('Loading set inventory from Supabase...');
  const knownSets = new Set();
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data: page, error: pageError } = await supabase
      .from('sets')
      .select('set_number, name')
      .range(offset, offset + PAGE - 1);
    if (pageError) {
      console.error('Failed to load sets:', pageError.message);
      process.exit(1);
    }
    for (const s of page ?? []) {
      knownSets.add(s.set_number);
      if (s.name) knownSetsByName.set(
        s.name.toLowerCase().replace(/[™®©\s]+/g, ' ').trim(),
        s.set_number,
      );
    }
    if ((page ?? []).length < PAGE) break;
  }
  console.log(`Loaded ${knownSets.size} known sets from Supabase.\n`);

  const now = new Date().toISOString();
  const summary = [];

  for (const store of STORES) {
    console.log(`── ${store.name} (${store.domain}) ──`);

    let allProducts;
    try {
      allProducts = await fetchAllProducts(store.domain, store.path);
      console.log(`  Fetched ${allProducts.length} products total`);
    } catch (err) {
      console.error(`  FAILED to fetch: ${err.message}`);
      summary.push({ store: store.name, fetched: 0, parsed: 0, matched: 0, upserted: 0, error: err.message });
      continue;
    }

    // Parse and filter LEGO products
    const parsed = allProducts.map((p) => parseProduct(p, store.id, store.domain)).filter(Boolean);
    console.log(`  Parsed ${parsed.length} LEGO products`);

    // Match against known inventory
    const allMatched = parsed.filter((p) => knownSets.has(p.setNumber));
    const unmatched  = parsed.filter((p) => !knownSets.has(p.setNumber));
    console.log(`  Matched ${allMatched.length} to Supabase inventory`);

    // Warn about unmatched LEGO products (set number not in our DB)
    if (unmatched.length > 0) {
      console.warn(`  WARN: ${unmatched.length} LEGO products have no DB match (new sets? older sets?)`);
      for (const p of unmatched.slice(0, 5)) {
        console.warn(`    [${p.setNumber}] ${p.storeId}`);
      }
    }

    if (allMatched.length === 0) {
      console.warn(`  WARN: 0 rows matched for ${store.name} — sending alert`);
      if (!DRY_RUN) await sendScraperAlert(store.name, store.id, now);
      summary.push({ store: store.name, fetched: allProducts.length, parsed: parsed.length, matched: 0, upserted: 0 });
      continue;
    }
    console.log(`  Row count: ${allMatched.length} matched rows for ${store.name}`);

    // ── DEDUPLICATE by set_id ───────────────────────────────────────────────
    // A store may list the same LEGO set multiple times (different pack sizes,
    // box-damage editions, etc.). PostgreSQL's ON CONFLICT DO UPDATE throws
    // "command cannot affect row a second time" if a single INSERT batch
    // contains duplicate conflict keys — aborting the entire batch.
    //
    // Fix: keep one row per set_id, preferring the lowest available price.
    const deduped = new Map();
    for (const p of allMatched) {
      const existing = deduped.get(p.setNumber);
      if (!existing) {
        deduped.set(p.setNumber, p);
      } else {
        // Prefer in-stock over out-of-stock; then prefer lower price
        const existingBetter =
          (existing.inStock && !p.inStock) ||
          (existing.inStock === p.inStock &&
            existing.priceInr !== null &&
            (p.priceInr === null || existing.priceInr <= p.priceInr));
        if (!existingBetter) deduped.set(p.setNumber, p);
      }
    }
    const matched = [...deduped.values()];
    const dupesRemoved = allMatched.length - matched.length;
    if (dupesRemoved > 0) {
      console.log(`  Deduped: removed ${dupesRemoved} duplicate set_id(s), ${matched.length} unique rows to upsert`);
    }

    // ── Upsert into store_prices ────────────────────────────────────────────
    const storePricesRows = matched.map((p) => ({
      set_id:      p.setNumber,
      store_id:    p.storeId,
      price_inr:   p.priceInr,
      in_stock:    p.inStock,
      product_url: p.productUrl,
      scraped_at:  now,
    }));

    const BATCH = 400;
    let upsertedCount = 0;
    let upsertErrors  = 0;
    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would upsert ${storePricesRows.length} rows to store_prices:`);
      for (const r of storePricesRows.slice(0, 5))
        console.log(`    set=${r.set_id} store=${r.store_id} price=₹${r.price_inr} in_stock=${r.in_stock}`);
      if (storePricesRows.length > 5) console.log(`    ... +${storePricesRows.length - 5} more`);
      upsertedCount = storePricesRows.length;
    } else {
      for (let i = 0; i < storePricesRows.length; i += BATCH) {
        const batch = storePricesRows.slice(i, i + BATCH);
        const { error: upsertErr } = await supabase
          .from('store_prices')
          .upsert(batch, { onConflict: 'set_id,store_id' });
        if (upsertErr) {
          console.error(`  ERROR upsert batch ${i}–${i + batch.length}: ${upsertErr.message} (code=${upsertErr.code})`);
          upsertErrors++;
        } else {
          upsertedCount += batch.length;
        }
      }
      if (upsertErrors > 0) {
        console.error(`  ${upsertErrors} batch(es) failed — store_prices may be incomplete for ${store.name}`);
      } else {
        console.log(`  Upserted ${upsertedCount} rows to store_prices`);
      }
    }

    // ── Append to price_history ─────────────────────────────────────────────
    // All matched+deduped products with a real price get a history row.
    // This is append-only — used for deal calculations and trend analysis.
    const historyRows = matched
      .filter((p) => p.priceInr !== null)
      .map((p) => ({
        set_id:      p.setNumber,
        store_id:    p.storeId,
        price_inr:   p.priceInr,
        recorded_at: now,
      }));

    if (historyRows.length > 0) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would insert ${historyRows.length} rows to price_history`);
      } else {
        for (let i = 0; i < historyRows.length; i += BATCH) {
          const batch = historyRows.slice(i, i + BATCH);
          const { error: histErr } = await supabase.from('price_history').insert(batch);
          if (histErr) console.error(`  History insert error batch ${i}: ${histErr.message}`);
        }
        console.log(`  Recorded ${historyRows.length} price history rows`);
      }
    }

    summary.push({
      store:     store.name,
      fetched:   allProducts.length,
      parsed:    parsed.length,
      matched:   allMatched.length,
      dupes:     dupesRemoved,
      upserted:  upsertedCount,
      unmatched: unmatched.length,
    });
    console.log('');
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════');
  console.log(DRY_RUN ? '  DRY RUN COMPLETE — no data written' : '  SCRAPE COMPLETE');
  console.log('═══════════════════════════════');
  for (const s of summary) {
    if (s.error) {
      console.log(`  ${s.store}: ERROR — ${s.error}`);
    } else {
      console.log(`  ${s.store}: ${s.fetched} fetched → ${s.parsed} LEGO → ${s.matched} matched (${s.dupes ?? 0} dupes removed) → ${s.upserted} upserted`);
    }
  }
  const totalUpserted = summary.reduce((n, s) => n + (s.upserted ?? 0), 0);
  console.log(`\n  Total upserted: ${totalUpserted}`);
  console.log(`  Started:  ${startedAt}`);
  console.log(`  Finished: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════\n');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
