#!/usr/bin/env node
/**
 * MRP direct-scrape audit (2026-07-08).
 *
 * Root cause confirmed: sets.lego_mrp_inr is populated by populate-mrp.js as
 * Brickset LEGOCom.US.retailPrice (USD) x live USD/INR rate, rounded to
 * nearest 100 -- a currency-converted US price, NOT the actual India MRP
 * retailers display (which runs higher once GST/import duty/distributor
 * margin are priced in). Confirmed live: 75397 stores lego_mrp_inr=45000
 * ($499.99 x ~90 / 100 rounded), but Toycra's own MRP-labeled field is 51999.
 *
 * This script scrapes the actual retailer-labeled "MRP" field from Toycra's
 * Shopify /products.json feed: variant.compare_at_price, when present and
 * > variant.price, IS the retailer's own crossed-out reference/MRP price
 * (verified live, both via API and by loading the actual product page:
 * Toycra 75397 shows "MRP: Original price Rs. 51,999.00 / Current price
 * Rs. 41,599.00" on-page, exactly matching price=41599/compare_at_price=51999
 * from the JSON feed). When compare_at_price is null/not greater than price
 * (no active discount), variant.price IS the plain listed price, i.e. MRP.
 *
 * MyBrickHouse does NOT expose an equivalent MRP field. Its Shopify backend
 * also carries a compare_at_price, but its storefront theme never renders
 * any strikethrough/MRP comparison on the product page -- confirmed live by
 * loading two product pages with different compare_at_price/price gaps
 * (42197: 899 vs 999; 42204: 6399 vs 6999), both showing only the single
 * flat price with zero "MRP"/"was"/discount UI anywhere. Since MyBrickHouse
 * never labels any number as MRP to a shopper, its compare_at_price cannot
 * be treated as "the number the store calls MRP" -- it isn't called
 * anything. MyBrickHouse's plain `price` is reported separately as
 * informational "storefront price" context only, never as a claimed MRP,
 * and is NOT used to flag MBH/Toycra "disagreements" (an earlier version of
 * this script did that and produced 247 false "disagreements" that were
 * really just Toycra's real MRP vs MyBrickHouse's invisible backend field --
 * not a genuine store-vs-store MRP conflict).
 *
 * This is NOT the same field as store_prices (which tracks current/deal
 * price only) -- store_prices is untouched by this script.
 *
 * Report-only. No sets table writes. Two outputs:
 *   audit/mrp-direct-scrape-diff-<date>.csv    -- Toycra-labeled-MRP vs lego_mrp_inr
 *   audit/mrp-direct-scrape-context-<date>.csv -- MyBrickHouse storefront price,
 *                                                  informational only, for sets
 *                                                  with no Toycra MRP available
 *
 * Usage: node scripts/audit-mrp-direct-scrape-2026-07-08.mjs
 */

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
      const eq = line.indexOf('=');
      if (eq === -1 || line.trim().startsWith('#')) continue;
      const k = line.slice(0, eq).trim();
      if (!env[k]) env[k] = line.slice(eq + 1).trim();
    }
  } catch { /* CI: secrets come from process.env */ }
  return env;
}

const env = loadEnv();
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const STORES = [
  { id: 'toycra', name: 'Toycra', domain: 'www.toycra.com', path: '/collections/lego/products.json' },
  { id: 'mybrickhouse', name: 'MyBrickHouse', domain: 'lego.mybrickhouse.com', path: '/products.json' },
];

async function withRetry(fn, retries = 3, baseMs = 2000) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try { return await fn(); }
    catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, baseMs * 2 ** attempt));
    }
  }
}

async function fetchAllProducts(domain, path) {
  const products = [];
  let page = 1;
  while (true) {
    const url = `https://${domain}${path}?limit=250&page=${page}`;
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
    await new Promise(r => setTimeout(r, 400));
  }
  return products;
}

// variant.sku is the authoritative set number on both stores (100% populated,
// confirmed live) -- prefer it over regex-matching title/handle text, which
// produced false matches on year numbers embedded in titles (e.g. "Advent
// Calendar 2025", "FIFA World Cup 2026" both regex-matched to unrelated real
// set_numbers 2025/2026 in the sets table -- a vintage "Boat" set in the
// 2025 case). sku is plain numeric on MyBrickHouse, "Lego"-prefixed on
// Toycra (e.g. "Lego60506") -- strip any leading letters first.
function extractSetNumber(sku, title, handle) {
  const skuDigits = (sku ?? '').replace(/^[a-z]+/i, '').trim();
  if (/^\d{4,6}$/.test(skuDigits)) return skuDigits;

  const RE = /(?<!\d)(\d{4,6})(?!\d)/g;
  const fromHandle = [...(handle ?? '').matchAll(RE)].map(m => m[1]);
  const fromTitle  = [...(title  ?? '').matchAll(RE)].map(m => m[1]);
  const candidates = [...new Set([...fromHandle, ...fromTitle])];
  return candidates[0] ?? null;
}

// Mirrors scrape-now.mjs variant selection (cheapest in-stock, else cheapest
// overall) so the MRP we extract corresponds to the same variant scrape-now
// already treats as "the" price for this product.
function pickVariant(product) {
  if (!product.variants?.length) return null;
  const inStock = product.variants.filter(v => v.available);
  return (inStock.length ? inStock : product.variants)
    .slice()
    .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
}

function deriveMrp(variant) {
  const price = parseFloat(variant.price);
  const compareAt = variant.compare_at_price ? parseFloat(variant.compare_at_price) : null;
  if (compareAt && compareAt > price) return Math.round(compareAt);
  return Math.round(price);
}

async function scrapeStoreMrps(store, knownSetsByName) {
  console.log(`\nFetching ${store.name} (${store.domain}${store.path})...`);
  const products = await fetchAllProducts(store.domain, store.path);
  console.log(`  ${products.length} products fetched`);

  const mrpBySet = new Map(); // set_number -> { mrp, title, url }
  for (const p of products) {
    const titleLower = (p.title ?? '').toLowerCase();
    const handleLower = (p.handle ?? '').toLowerCase();
    if (store.id !== 'mybrickhouse' && !titleLower.includes('lego') && !handleLower.includes('lego')) continue;

    const variant = pickVariant(p);
    if (!variant) continue;

    let setNumber = extractSetNumber(variant.sku, p.title, p.handle);
    if (!setNumber && store.id === 'mybrickhouse') {
      const cleaned = (p.title ?? '').toLowerCase().replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim().replace(/^the\s+/, '');
      setNumber = knownSetsByName.get(cleaned) ?? null;
    }
    if (!setNumber) continue;

    const mrp = deriveMrp(variant);
    const url = `https://${store.domain}/products/${p.handle}`;
    // If a set appears twice (rare, e.g. two listings), keep the first match
    // rather than silently overwriting -- log so it can be checked by eye.
    if (mrpBySet.has(setNumber)) {
      console.log(`  [dup] ${store.name} has >1 listing matching ${setNumber} -- keeping first (${mrpBySet.get(setNumber).url})`);
      continue;
    }
    mrpBySet.set(setNumber, { mrp, title: p.title, url });
  }
  console.log(`  ${mrpBySet.size} sets matched to a set_number`);
  return mrpBySet;
}

async function loadAllSets() {
  const PAGE = 1000;
  let offset = 0;
  const all = [];
  while (true) {
    const { data, error } = await sb
      .from('sets')
      .select('id, set_number, name, lego_mrp_inr')
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

async function main() {
  console.log('MRP direct-scrape audit -- report only, no writes');

  const sets = await loadAllSets();
  console.log(`\nLoaded ${sets.length} total rows from sets table`);
  const knownSetsByName = new Map();
  for (const s of sets) {
    if (s.name) knownSetsByName.set(s.name.toLowerCase().replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim(), s.set_number);
  }

  const storeMrps = {};
  for (const store of STORES) {
    storeMrps[store.id] = await scrapeStoreMrps(store, knownSetsByName);
  }

  const diffRows = [];
  const contextOnlyRows = []; // MBH storefront price, no Toycra MRP available
  const noDataSets = [];

  for (const s of sets) {
    const mbh = storeMrps.mybrickhouse.get(s.set_number);
    const toycra = storeMrps.toycra.get(s.set_number);
    const currentMrp = s.lego_mrp_inr == null ? null : Number(s.lego_mrp_inr);

    if (!mbh && !toycra) { noDataSets.push(s); continue; }

    if (toycra) {
      const delta = currentMrp == null ? null : toycra.mrp - currentMrp;
      diffRows.push({
        set_number: s.set_number, name: s.name,
        current_lego_mrp_inr: currentMrp, retailer_mrp: toycra.mrp,
        delta, source: 'Toycra (labeled MRP)', url: toycra.url,
        mbh_storefront_price: mbh?.mrp ?? '',
      });
      continue;
    }

    // Toycra has no listing for this set -- MyBrickHouse price is reported
    // as context only, never as a claimed MRP (see file header).
    contextOnlyRows.push({
      set_number: s.set_number, name: s.name, current_lego_mrp_inr: currentMrp,
      mbh_storefront_price: mbh.mrp, mbh_url: mbh.url,
    });
  }

  const date = new Date().toISOString().slice(0, 10);
  fs.mkdirSync('audit', { recursive: true });

  const diffPath = `audit/mrp-direct-scrape-diff-${date}.csv`;
  const diffLines = ['set_number,name,current_lego_mrp_inr,retailer_mrp,delta,source,url,mbh_storefront_price_context'];
  for (const r of diffRows.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))) {
    diffLines.push(`${r.set_number},"${(r.name ?? '').replaceAll('"', '""')}",${r.current_lego_mrp_inr ?? ''},${r.retailer_mrp},${r.delta ?? ''},${r.source},${r.url},${r.mbh_storefront_price}`);
  }
  fs.writeFileSync(diffPath, diffLines.join('\n'));

  const contextPath = `audit/mrp-direct-scrape-context-${date}.csv`;
  const contextLines = ['set_number,name,current_lego_mrp_inr,mbh_storefront_price_NOT_A_CONFIRMED_MRP,mbh_url'];
  for (const r of contextOnlyRows) {
    contextLines.push(`${r.set_number},"${(r.name ?? '').replaceAll('"', '""')}",${r.current_lego_mrp_inr ?? ''},${r.mbh_storefront_price},${r.mbh_url}`);
  }
  fs.writeFileSync(contextPath, contextLines.join('\n'));

  const nullCurrentButFound = diffRows.filter(r => r.current_lego_mrp_inr == null).length;
  const mismatchCount = diffRows.filter(r => r.delta != null && r.delta !== 0).length;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Total sets in DB:                          ${sets.length}`);
  console.log(`Matched on Toycra (confirmed labeled MRP): ${diffRows.length}`);
  console.log(`  of which lego_mrp_inr != Toycra MRP:      ${mismatchCount}`);
  console.log(`  of which lego_mrp_inr was NULL:           ${nullCurrentButFound}`);
  console.log(`MyBrickHouse-only (context, not a confirmed MRP): ${contextOnlyRows.length}`);
  console.log(`No store match at all:                     ${noDataSets.length}`);
  console.log(`\nReports written:`);
  console.log(`  ${diffPath}`);
  console.log(`  ${contextPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
