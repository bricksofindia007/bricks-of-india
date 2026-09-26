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
import { STORES, withRetry, fetchAllProducts, extractSetNumber, parseProduct, isMoreCanonical } from './lib/retailer-fetch.mjs';
import { getSecret } from '../src/lib/get-secret';

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
const SERVICE_KEY  = getSecret('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Set via workflow_dispatch input `dry_run: true` — reads only, no Supabase writes.
const DRY_RUN = process.env.DRY_RUN === 'true';

const RESEND_KEY  = (getSecret('RESEND_API_KEY') || '').trim();
const ALERT_EMAIL = process.env.BRIEF_EMAIL || 'abhinav@bricksofindia.com';

// STORES, withRetry, fetchAllProducts, extractSetNumber, parseProduct now live
// in ./lib/retailer-fetch.mjs (extracted 2026-07-30 for reuse by the reviews
// source pipeline) — imported above, behavior unchanged.

// Module-level name lookup: lowercased set name → set_number. Populated in main().
// Used by parseProduct() MBH fallback when title/handle contains no set number.
const knownSetsByName = new Map();

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
    const parsed = allProducts.map((p) => parseProduct(p, store.id, store.domain, knownSetsByName, knownSets)).filter(Boolean);
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
    // Canonical listing (Wave 1 PR-0, 2026-09-26; replaces "prefer in-stock,
    // then lowest price"): SKU match, then set number in title/URL, then name
    // map; ties to the oldest listing. Never by price or stock -- picking the
    // cheaper of two listings is price-based filtering (pricing rule R1).
    const deduped = new Map();
    for (const p of allMatched) {
      const existing = deduped.get(p.setNumber);
      if (!existing || isMoreCanonical(p, existing)) deduped.set(p.setNumber, p);
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
      // Listing's displayed MRP / strike-through (Shopify compare_at_price).
      // store_prices only -- deliberately NOT appended to price_history, so
      // capturing it adds no growth there (Wave 1 PR-0).
      compare_at_price_inr: p.compareAtInr,
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

    // ── Reconcile stale in_stock rows (#140) ────────────────────────────────
    // This scraper only ever upserts what's in the current feed fetch --
    // nothing previously flipped in_stock=false for a row that stops
    // appearing (product genuinely out of stock / delisted). Those rows
    // accumulate as phantom in_stock=true forever. N-strikes: a row not
    // touched by an upsert in ~3 missed 6h scrape cycles (18h) is treated
    // as genuinely gone. 20h cutoff (vs. the exact 18h) absorbs normal
    // schedule jitter so one transient site hiccup doesn't flip a real
    // in-stock item false on a single missed run.
    const staleCutoff = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
    const { data: staleRows, error: staleSelErr } = await supabase
      .from('store_prices')
      .select('set_id')
      .eq('store_id', store.id)
      .eq('in_stock', true)
      .lt('scraped_at', staleCutoff);
    if (staleSelErr) {
      console.error(`  Reconciliation select error: ${staleSelErr.message}`);
    } else if ((staleRows ?? []).length > 0) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would reconcile ${staleRows.length} stale in_stock=true row(s) -> false (not seen in >20h): ${staleRows.slice(0, 5).map((r) => r.set_id).join(', ')}${staleRows.length > 5 ? ', ...' : ''}`);
      } else {
        const { error: reconErr } = await supabase
          .from('store_prices')
          .update({ in_stock: false })
          .eq('store_id', store.id)
          .eq('in_stock', true)
          .lt('scraped_at', staleCutoff);
        if (reconErr) console.error(`  Reconciliation update error: ${reconErr.message}`);
        else console.log(`  Reconciled ${staleRows.length} stale in_stock=true row(s) -> false (not seen in >20h)`);
      }
    } else {
      console.log(`  Reconciliation: no stale in_stock rows for ${store.name}`);
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
