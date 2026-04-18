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

// ── Store config ─────────────────────────────────────────────────────────────
// Toycra has a dedicated LEGO collection — use it to avoid paging through
// thousands of non-LEGO toys. MyBrickHouse and Jaiman are LEGO-heavy,
// so the general products.json is fine.
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
    domain: 'mybrickhouse.com',
    path:   '/products.json',
  },
  {
    id:     'jaiman',
    name:   'Jaiman Toys',
    domain: 'jaimantoys.com',
    path:   '/products.json',
  },
];

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
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
 * Extract a LEGO set number (4–6 digits) from product title + handle.
 * Tries title numbers first (more reliable), then handle.
 * Returns null if nothing plausible found.
 */
function extractSetNumber(title, handle) {
  // Match standalone 4-6 digit sequences
  const RE = /(?<!\d)(\d{4,6})(?!\d)/g;
  const fromTitle  = [...title.matchAll(RE)].map((m) => m[1]);
  const fromHandle = [...handle.matchAll(RE)].map((m) => m[1]);
  const candidates = [...new Set([...fromTitle, ...fromHandle])];
  // Prefer numbers that look like set numbers (not prices like 9999)
  return candidates[0] ?? null;
}

/** Parse a Shopify product into our internal format. Returns null to skip. */
function parseProduct(product, storeId, domain) {
  const titleLower  = product.title.toLowerCase();
  const handleLower = product.handle.toLowerCase();

  // Skip products that don't appear to be LEGO sets
  if (!titleLower.includes('lego') && !handleLower.includes('lego')) return null;

  const setNumber = extractSetNumber(product.title, product.handle);
  if (!setNumber) return null;

  const variant    = product.variants?.[0];
  if (!variant) return null;

  const priceInr   = variant.price ? Math.round(parseFloat(variant.price)) : null;
  const inStock    = variant.available ?? false;
  const productUrl = `https://${domain}/products/${product.handle}`;

  return { setNumber, storeId, priceInr, inStock, productUrl };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = new Date().toISOString();
  console.log(`\nBricks of India Shopify Scraper — ${startedAt}\n`);

  // Verify tables exist
  const { error: tableCheck } = await supabase.from('store_prices').select('id').limit(1);
  if (tableCheck?.code === 'PGRST205') {
    console.error('ERROR: store_prices table not found.');
    console.error('Run the SQL migration first:');
    console.error('  → Supabase Dashboard → SQL Editor → paste scripts/migrations/001_store_prices.sql');
    process.exit(1);
  }

  // Load known set numbers from Supabase for matching
  console.log('Loading set inventory from Supabase...');
  const { data: setsData, error: setsError } = await supabase
    .from('sets')
    .select('set_number');

  if (setsError) {
    console.error('Failed to load sets:', setsError.message);
    process.exit(1);
  }

  const knownSets = new Set(setsData.map((s) => s.set_number));
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
      summary.push({ store: store.name, fetched: 0, parsed: 0, matched: 0, error: err.message });
      continue;
    }

    // Parse and filter LEGO products
    const parsed = allProducts.map((p) => parseProduct(p, store.id, store.domain)).filter(Boolean);
    console.log(`  Parsed ${parsed.length} LEGO products`);

    // Match against known inventory
    const matched = parsed.filter((p) => knownSets.has(p.setNumber));
    console.log(`  Matched ${matched.length} to Supabase inventory`);

    if (matched.length === 0) {
      summary.push({ store: store.name, fetched: allProducts.length, parsed: parsed.length, matched: 0 });
      continue;
    }

    // Upsert into store_prices (one row per set/store, update on conflict)
    const storePricesRows = matched.map((p) => ({
      set_id:      p.setNumber,
      store_id:    p.storeId,
      price_inr:   p.priceInr,
      in_stock:    p.inStock,
      product_url: p.productUrl,
      scraped_at:  now,
    }));

    // Batch upserts (Supabase handles up to ~500 rows per request)
    const BATCH = 400;
    for (let i = 0; i < storePricesRows.length; i += BATCH) {
      const batch = storePricesRows.slice(i, i + BATCH);
      const { error: upsertErr } = await supabase
        .from('store_prices')
        .upsert(batch, { onConflict: 'set_id,store_id' });
      if (upsertErr) console.error(`  Upsert error (batch ${i}): ${upsertErr.message}`);
    }
    console.log(`  Upserted ${storePricesRows.length} rows to store_prices`);

    // Append to price_history (only rows with a real price)
    const historyRows = matched
      .filter((p) => p.priceInr !== null)
      .map((p) => ({
        set_id:      p.setNumber,
        store_id:    p.storeId,
        price_inr:   p.priceInr,
        recorded_at: now,
      }));

    if (historyRows.length > 0) {
      for (let i = 0; i < historyRows.length; i += BATCH) {
        const batch = historyRows.slice(i, i + BATCH);
        const { error: histErr } = await supabase.from('price_history').insert(batch);
        if (histErr) console.error(`  History insert error (batch ${i}): ${histErr.message}`);
      }
      console.log(`  Recorded ${historyRows.length} price history rows`);
    }

    summary.push({
      store:   store.name,
      fetched: allProducts.length,
      parsed:  parsed.length,
      matched: matched.length,
    });
    console.log('');
  }

  // Summary
  console.log('═══════════════════════════════');
  console.log('  SCRAPE COMPLETE');
  console.log('═══════════════════════════════');
  for (const s of summary) {
    const status = s.error ? `ERROR: ${s.error}` : `${s.fetched} fetched → ${s.parsed} LEGO → ${s.matched} matched`;
    console.log(`  ${s.store}: ${status}`);
  }
  const totalMatched = summary.reduce((n, s) => n + (s.matched ?? 0), 0);
  console.log(`\n  Total matched: ${totalMatched}`);
  console.log(`  Started:  ${startedAt}`);
  console.log(`  Finished: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════\n');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
