#!/usr/bin/env node
/**
 * MRP fix apply (2026-07-09) -- Abhinav-approved, after review of
 * audit/mrp-direct-scrape-diff-2026-07-08.csv.
 *
 * Re-scrapes Toycra live (rather than trusting a CSV that may be minutes
 * stale) using the same sku-based matching + isDisallowedRebrickableSet-
 * style category logic as audit-mrp-direct-scrape-2026-07-08.mjs, then:
 *
 *   Phase 1 -- CMF exclusion: any set whose theme matches Collectible
 *     Minifigures/Series N Minifigures, OR whose set_number appears as a
 *     cmf_figures.series_set_number, gets mrp_verified=false,
 *     mrp_review_reason='cmf_box_ambiguity'. lego_mrp_inr is NOT touched --
 *     the single-figure-vs-sealed-box ambiguity means neither the old
 *     estimate nor the Toycra scrape can be trusted without a human per-
 *     series check. This runs FIRST so Phase 2 can exclude these sets from
 *     the price overwrite even where Toycra data exists for them.
 *
 *   Phase 2 -- confirmed-MRP write: for every non-CMF set with a Toycra
 *     listing whose lego_mrp_inr disagrees (or is null), write
 *     lego_mrp_inr = Toycra MRP, mrp_verified=true, mrp_review_reason=null.
 *
 *   Phase 3 -- suspect-by-default: every remaining set with a populated
 *     lego_mrp_inr that is NOT in Phase 1 or Phase 2 gets
 *     mrp_verified=false, mrp_review_reason='unverified_estimate'. Root
 *     cause is systemic (same populate-mrp.js method, no exceptions found),
 *     so absence of a Toycra listing means "unconfirmed", not "probably
 *     fine".
 *
 * Usage:
 *   node scripts/mrp-fix-apply-2026-07-09.mjs            (dry run, no writes)
 *   node scripts/mrp-fix-apply-2026-07-09.mjs --apply     (writes)
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
const APPLY = process.argv.includes('--apply');

async function fetchAllProducts(domain, path) {
  const products = [];
  let page = 1;
  while (true) {
    const url = `https://${domain}${path}?limit=250&page=${page}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BricksOfIndia/1.0 (+https://bricksofindia.com)', Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    const data = await res.json();
    const batch = data.products ?? [];
    if (batch.length === 0) break;
    products.push(...batch);
    if (batch.length < 250) break;
    page++;
    await new Promise(r => setTimeout(r, 400));
  }
  return products;
}

function extractSetNumber(sku, title, handle) {
  const skuDigits = (sku ?? '').replace(/^[a-z]+/i, '').trim();
  if (/^\d{4,6}$/.test(skuDigits)) return skuDigits;
  const RE = /(?<!\d)(\d{4,6})(?!\d)/g;
  const fromHandle = [...(handle ?? '').matchAll(RE)].map(m => m[1]);
  const fromTitle  = [...(title  ?? '').matchAll(RE)].map(m => m[1]);
  return [...new Set([...fromHandle, ...fromTitle])][0] ?? null;
}

function pickVariant(product) {
  if (!product.variants?.length) return null;
  const inStock = product.variants.filter(v => v.available);
  return (inStock.length ? inStock : product.variants).slice().sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
}

function deriveMrp(variant) {
  const price = parseFloat(variant.price);
  const compareAt = variant.compare_at_price ? parseFloat(variant.compare_at_price) : null;
  return Math.round(compareAt && compareAt > price ? compareAt : price);
}

async function loadAllSets() {
  const PAGE = 1000;
  let offset = 0;
  const all = [];
  while (true) {
    const { data, error } = await sb.from('sets').select('id, set_number, name, theme, lego_mrp_inr').range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

async function main() {
  console.log(`MRP fix apply -- ${APPLY ? 'APPLY (writing)' : 'DRY RUN'}`);

  const sets = await loadAllSets();
  console.log(`Loaded ${sets.length} sets rows`);

  // ── Phase 1 data: CMF-affected set_numbers ──────────────────────────────
  const { data: cmfSeries, error: cmfErr } = await sb.from('cmf_figures').select('series_set_number');
  if (cmfErr) throw cmfErr;
  const cmfSetNumbers = new Set((cmfSeries ?? []).map(r => r.series_set_number));
  for (const s of sets) {
    if (s.theme && /minifigure/i.test(s.theme)) cmfSetNumbers.add(s.set_number);
  }
  console.log(`CMF-affected set_numbers: ${cmfSetNumbers.size}`);

  // ── Toycra live scrape (sku-based matching) ─────────────────────────────
  console.log('\nFetching Toycra...');
  const products = await fetchAllProducts('www.toycra.com', '/collections/lego/products.json');
  const toycraMrp = new Map();
  for (const p of products) {
    const variant = pickVariant(p);
    if (!variant) continue;
    const setNumber = extractSetNumber(variant.sku, p.title, p.handle);
    if (!setNumber || toycraMrp.has(setNumber)) continue;
    toycraMrp.set(setNumber, deriveMrp(variant));
  }
  console.log(`Toycra: ${toycraMrp.size} sets matched`);

  // ── Categorize ───────────────────────────────────────────────────────────
  const phase1Cmf = [];      // exclusion flag only, no price touch
  const phase2Confirmed = []; // write real MRP
  const phase3Suspect = [];   // flag suspect, no price touch

  for (const s of sets) {
    if (cmfSetNumbers.has(s.set_number)) {
      phase1Cmf.push(s);
      continue;
    }
    const toycraPrice = toycraMrp.get(s.set_number);
    if (toycraPrice != null) {
      // Written (or re-confirmed, if already correct) either way -- Phase 2
      // always marks mrp_verified=true for anything with a live Toycra match.
      phase2Confirmed.push({ ...s, newMrp: toycraPrice });
      continue;
    }
    if (s.lego_mrp_inr != null) phase3Suspect.push(s);
  }

  console.log(`\nPhase 1 (CMF exclusion, no price change):        ${phase1Cmf.length}`);
  console.log(`Phase 2 (confirmed Toycra MRP write):             ${phase2Confirmed.length}`);
  console.log(`Phase 3 (suspect-by-default, no price change):    ${phase3Suspect.length}`);

  if (!APPLY) {
    console.log('\nDRY RUN -- sample of Phase 2 writes:');
    phase2Confirmed.slice(0, 10).forEach(r => console.log(`  ${r.set_number.padEnd(10)} ${(r.name ?? '').slice(0, 35).padEnd(37)} ${r.lego_mrp_inr ?? 'NULL'} -> ${r.newMrp}`));
    console.log('\nRe-run with --apply to write.');
    return;
  }

  const CONCURRENCY = 50;

  console.log('\nApplying Phase 1 (CMF exclusion flag)...');
  let p1ok = 0;
  for (let i = 0; i < phase1Cmf.length; i += CONCURRENCY) {
    const chunk = phase1Cmf.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async s => {
      const { error } = await sb.from('sets').update({ mrp_verified: false, mrp_review_reason: 'cmf_box_ambiguity' }).eq('id', s.id);
      if (error) console.error(`  ERR ${s.set_number}: ${error.message}`); else p1ok++;
    }));
  }
  console.log(`  ${p1ok}/${phase1Cmf.length} flagged cmf_box_ambiguity`);

  console.log('\nApplying Phase 2 (confirmed MRP write)...');
  let p2ok = 0;
  for (let i = 0; i < phase2Confirmed.length; i += CONCURRENCY) {
    const chunk = phase2Confirmed.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async r => {
      const { error } = await sb.from('sets').update({ lego_mrp_inr: r.newMrp, mrp_verified: true, mrp_review_reason: null }).eq('id', r.id);
      if (error) console.error(`  ERR ${r.set_number}: ${error.message}`); else p2ok++;
    }));
  }
  console.log(`  ${p2ok}/${phase2Confirmed.length} written with confirmed Toycra MRP`);

  console.log('\nApplying Phase 3 (suspect-by-default flag)...');
  let p3ok = 0;
  for (let i = 0; i < phase3Suspect.length; i += CONCURRENCY) {
    const chunk = phase3Suspect.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async s => {
      const { error } = await sb.from('sets').update({ mrp_verified: false, mrp_review_reason: 'unverified_estimate' }).eq('id', s.id);
      if (error) console.error(`  ERR ${s.set_number}: ${error.message}`); else p3ok++;
    }));
  }
  console.log(`  ${p3ok}/${phase3Suspect.length} flagged unverified_estimate`);

  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
