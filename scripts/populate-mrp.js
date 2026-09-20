// scripts/populate-mrp.js
// Populates lego_mrp_inr on sets table using Brickset API retail prices.
// Fetches all sets by year (2020–2027) from Brickset API, converts LEGOCom.US.retailPrice → INR (×90, round to nearest ₹100).
// Safe to re-run — only writes to rows where lego_mrp_inr IS NULL.
// Usage: node scripts/populate-mrp.js [--dry-run]
//
// PRE-2020 LISTED SETS (added 2026-08-16): the year>=2020 bulk sweep below
// stays as-is for efficiency (sweeping Brickset's full ~75-year history
// year-by-year just to catch a handful of old sets would be wasteful), but
// it used to mean any pre-2020 set was PERMANENTLY excluded from ever
// getting lego_mrp_inr, even if actively listed today (confirmed live:
// 6 pre-2020 evergreen sets -- keychains, years 2007-2019 -- sitting in
// store_prices with real Brickset US prices available, structurally
// unreachable). Fixed with a small targeted Phase 1.5: individually look
// up (not bulk-sweep) any set that is BOTH currently listed in
// store_prices AND outside the year>=START_YEAR sweep range. Bounded by
// how many old sets are actually listed (26 as of this investigation,
// oldest 1983), not by LEGO's full history.

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Load .env.local, falling back to process.env (CI: secrets come from
// GitHub Actions env, no .env.local file exists there). Fixed 2026-08-16
// -- the old version did fs.readFileSync('.env.local') with no try/catch
// and read EXCLUSIVELY from that file, ignoring process.env entirely; this
// script had never been wired into a scheduled workflow before (confirmed
// via `grep -rl populate-mrp .github/workflows/` -- zero matches), so the
// crash-in-CI bug was never actually exercised until now. Same pattern as
// scripts/audit-mrp.mjs's loadEnv().
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

// BOM guard (CLAUDE.md "Known Netlify Gotchas" -- GitHub Secrets copied from
// BOM-encoded source files include a leading U+FEFF byte that breaks
// Bearer-auth headers; SUPABASE_SERVICE_ROLE_KEY is explicitly named as an
// affected key, and this is the first time it's used unattended in CI).
function stripBom(s) { return (s ?? '').replace(/^﻿/, '').trim(); }

const BRICKSET_KEY = stripBom(env.BRICKSET_API_KEY);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, stripBom(env.SUPABASE_SERVICE_ROLE_KEY));

if (!BRICKSET_KEY) { console.error('BRICKSET_API_KEY not set (.env.local or process.env)'); process.exit(1); }
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (.env.local or process.env)');
  process.exit(1);
}

const DRY_RUN    = process.argv.includes('--dry-run');
const START_YEAR = 2020;
const END_YEAR   = 2027;
const PAGE_SIZE  = 500;
const CALL_DELAY = 1000; // ms between Brickset API calls

const USD_TO_INR_FALLBACK = 90;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchUsdInrRate() {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const d = await r.json();
    const rate = d?.rates?.INR;
    if (rate && rate > 80 && rate < 120) { console.log(`Live USD/INR: ${rate}`); return rate; }
  } catch (e) { /* fall through */ }
  console.log(`USD/INR fetch failed — using fallback ${USD_TO_INR_FALLBACK}`);
  return USD_TO_INR_FALLBACK;
}

function usdToInr(usd, rate) {
  // LEGO India MRP ≈ USD × live INR rate, rounded to nearest ₹100
  return Math.round(usd * rate / 100) * 100;
}

async function fetchBricksetYear(year, rate) {
  const prices    = {}; // set_number → inr_price
  const exitDates = {}; // set_number → 'YYYY-MM-DD'
  let page = 1;
  let total = null;

  while (true) {
    const params = encodeURIComponent(JSON.stringify({
      year: String(year),
      pageSize: PAGE_SIZE,
      pageNumber: page,
    }));
    const url = `https://brickset.com/api/v3.asmx/getSets?apiKey=${BRICKSET_KEY}&userHash=&params=${params}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Brickset HTTP ${res.status} (year=${year} page=${page})`);
    const json = await res.json();
    if (json.status !== 'success') throw new Error(`Brickset API error: ${json.message}`);

    if (total === null) total = json.matches;

    for (const set of (json.sets || [])) {
      const usd = set.LEGOCom?.US?.retailPrice;
      if (usd && usd > 0) prices[set.number] = usdToInr(usd, rate);
      if (set.exitDate) exitDates[set.number] = set.exitDate.slice(0, 10);
    }

    const fetched = (page - 1) * PAGE_SIZE + (json.sets?.length ?? 0);
    console.log(`  ${year} p${page}: ${json.sets?.length ?? 0} sets | ${Object.keys(prices).length} priced, ${Object.keys(exitDates).length} with exitDate so far / ${total} total`);
    if (fetched >= total) break;
    page++;
    await sleep(CALL_DELAY);
  }

  return { prices, exitDates };
}

// DATA-01: store_prices.set_id is the plain set_number string, not a UUID
// FK to sets.id. PostgREST caps any single request at 1000 rows regardless
// of .range() overrides -- paginate.
async function fetchAllPaginated(table, select, filterFn) {
  const PAGE = 1000;
  let offset = 0;
  const all = [];
  while (true) {
    let q = sb.from(table).select(select).range(offset, offset + PAGE - 1);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

async function loadDbSetsInYearRange() {
  return fetchAllPaginated('sets', 'id, set_number, name, year', (q) =>
    q.gte('year', START_YEAR).is('lego_mrp_inr', null)
  );
}

// Individual Brickset lookup for ONE set (setNumber param needs the "-1"
// variant suffix -- confirmed live 2026-08-16, a bare set_number returns
// zero matches even for sets Brickset definitely has).
async function fetchBricksetSingleSet(setNumber, rate) {
  const params = encodeURIComponent(JSON.stringify({ setNumber: `${setNumber}-1` }));
  const url = `https://brickset.com/api/v3.asmx/getSets?apiKey=${BRICKSET_KEY}&userHash=&params=${params}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  if (json.status !== 'success' || !json.sets?.length) return null;
  const set = json.sets[0];
  const usd = set.LEGOCom?.US?.retailPrice;
  return {
    price: usd && usd > 0 ? usdToInr(usd, rate) : null,
    exitDate: set.exitDate ? set.exitDate.slice(0, 10) : null,
  };
}

// Phase 1.5 -- targeted lookup for sets that are BOTH currently listed
// (store_prices, Toycra/MyBrickHouse) AND older than START_YEAR, so they
// don't sit permanently excluded from the year-scoped bulk sweep above.
async function fillPreYearListedSets(bricksetPrices, bricksetExitDates, rate) {
  const storePriceRows = await fetchAllPaginated('store_prices', 'set_id');
  const listedSetNumbers = Array.from(new Set(storePriceRows.map((r) => r.set_id)));

  const oldListedNeedingLookup = [];
  const CHUNK = 200;
  for (let i = 0; i < listedSetNumbers.length; i += CHUNK) {
    const chunk = listedSetNumbers.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from('sets')
      .select('id, set_number, name, year, lego_mrp_inr')
      .in('set_number', chunk)
      .lt('year', START_YEAR)
      .is('lego_mrp_inr', null);
    if (error) throw error;
    oldListedNeedingLookup.push(...(data ?? []));
  }

  console.log(`\nPhase 1.5 -- ${oldListedNeedingLookup.length} listed set(s) older than ${START_YEAR} still missing lego_mrp_inr, checking Brickset individually...`);
  for (const s of oldListedNeedingLookup) {
    const result = await fetchBricksetSingleSet(s.set_number, rate);
    if (result?.price) {
      bricksetPrices[s.set_number] = result.price;
      console.log(`  ${s.set_number} (${s.year}) ${s.name.slice(0, 40)}: found ₹${result.price} via individual lookup`);
    }
    if (result?.exitDate) bricksetExitDates[s.set_number] = result.exitDate;
    await sleep(CALL_DELAY);
  }
  return oldListedNeedingLookup;
}

async function run() {
  console.log(`populate-mrp.js  dry-run=${DRY_RUN}  scope=year>=${START_YEAR}`);

  const rate = await fetchUsdInrRate();

  // Phase 1 — fetch all Brickset prices and exit dates by year
  const bricksetPrices    = {};
  const bricksetExitDates = {};
  for (let year = START_YEAR; year <= END_YEAR; year++) {
    console.log(`\nFetching Brickset year ${year}...`);
    const { prices, exitDates } = await fetchBricksetYear(year, rate);
    Object.assign(bricksetPrices, prices);
    Object.assign(bricksetExitDates, exitDates);
    await sleep(CALL_DELAY);
  }
  console.log(`\nBrickset map (bulk sweep): ${Object.keys(bricksetPrices).length} sets with USD retail price`);
  console.log(`Brickset map (bulk sweep): ${Object.keys(bricksetExitDates).length} sets with exitDate`);

  // Phase 1.5 — targeted lookup for pre-START_YEAR sets that are currently
  // listed (see file header comment)
  const oldListedSets = await fillPreYearListedSets(bricksetPrices, bricksetExitDates, rate);
  console.log(`Brickset map (after Phase 1.5): ${Object.keys(bricksetPrices).length} sets with USD retail price`);

  // Phase 2 — load DB sets needing MRP: the year-scoped sweep's targets,
  // plus the pre-START_YEAR listed sets Phase 1.5 just checked (whether or
  // not it found a price for them, so Phase 3's unmatched count stays
  // accurate for both groups)
  console.log(`\nLoading DB sets (year>=${START_YEAR}, lego_mrp_inr IS NULL)...`);
  const dbSets = [...(await loadDbSetsInYearRange()), ...oldListedSets];
  console.log(`DB sets to fill: ${dbSets.length} (${dbSets.length - oldListedSets.length} in year range + ${oldListedSets.length} pre-${START_YEAR} listed)`);

  // Phase 3 — match
  const updates = [];
  let unmatched = 0;
  for (const s of dbSets) {
    const price = bricksetPrices[s.set_number];
    if (price) updates.push({ id: s.id, lego_mrp_inr: price });
    else unmatched++;
  }
  console.log(`Matched: ${updates.length} | Unmatched: ${unmatched}`);

  if (DRY_RUN) {
    console.log('\nDRY RUN — no writes. Sample:');
    updates.slice(0, 15).forEach(u => {
      const s = dbSets.find(x => x.id === u.id);
      console.log(`  ${s.set_number.padEnd(12)} ${String(s.year).padEnd(6)} ${s.name.slice(0, 40).padEnd(42)} ₹${u.lego_mrp_inr}`);
    });
    const rdSample = Object.entries(bricksetExitDates).slice(0, 5);
    console.log('\nSample retirement dates:');
    rdSample.forEach(([n, d]) => console.log(`  ${n.padEnd(12)} ${d}`));
    return;
  }

  // Phase 4 — update lego_mrp_inr in parallel batches of 50
  const CONCURRENCY = 50;
  let written = 0;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    const chunk = updates.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async u => {
      const { error } = await sb.from('sets').update({ lego_mrp_inr: u.lego_mrp_inr }).eq('id', u.id);
      if (error) console.error(`\n  Update error ${u.id}: ${error.message}`);
      else written++;
    }));
    process.stdout.write(`\r  Written: ${written}/${updates.length}`);
  }
  console.log(`\nDone. ${written} MRP rows updated.`);

  // Phase 5 — write retirement_date for all Brickset sets that have an exitDate
  // Applies to ALL matched sets regardless of MRP null status (separate from Phase 4 filter)
  const exitEntries = Object.entries(bricksetExitDates);
  console.log(`\nPhase 5 — writing retirement_date for ${exitEntries.length} sets with Brickset exitDate...`);
  let rdWritten = 0, rdErrors = 0;
  for (let i = 0; i < exitEntries.length; i += CONCURRENCY) {
    const chunk = exitEntries.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async ([setNum, exitDate]) => {
      const { error } = await sb.from('sets')
        .update({ retirement_date: exitDate })
        .eq('set_number', setNum);
      if (error) { rdErrors++; }
      else rdWritten++;
    }));
    process.stdout.write(`\r  retirement_date written: ${rdWritten}/${exitEntries.length}`);
  }
  console.log(`\nDone. ${rdWritten} retirement_date rows updated${rdErrors ? `, ${rdErrors} errors` : ''}.`);

  // Final self-report, matching catalogue-audit.ts's corrected universe
  // (fixed 2026-08-16 -- this used to report against year>=START_YEAR of
  // the FULL sets catalogue, the same wrong-universe check catalogue-
  // audit.ts had; see that file's own comment for the full investigation).
  // Informational only, not a pass/fail gate -- catalogue-audit.ts is the
  // one real source of truth for this metric.
  const listedNow = await fetchAllPaginated('store_prices', 'set_id');
  const listedSetNumbersNow = Array.from(new Set(listedNow.map((r) => r.set_id)));
  let coveredNow = 0;
  const CHUNK2 = 200;
  for (let i = 0; i < listedSetNumbersNow.length; i += CHUNK2) {
    const chunk = listedSetNumbersNow.slice(i, i + CHUNK2);
    const { data } = await sb.from('sets').select('lego_mrp_inr').in('set_number', chunk);
    coveredNow += (data ?? []).filter((s) => s.lego_mrp_inr != null).length;
  }
  const listedPct = listedSetNumbersNow.length ? Math.round((coveredNow / listedSetNumbersNow.length) * 100) : 100;
  console.log(`\nListed-set coverage (real metric): ${coveredNow}/${listedSetNumbersNow.length} (${listedPct}%) -- ${coveredNow === listedSetNumbersNow.length ? 'ALL LISTED SETS COVERED ✓' : `${listedSetNumbersNow.length - coveredNow} listed set(s) still missing`}`);

  const { count: rdCount } = await sb.from('sets').select('*', { count: 'exact', head: true }).not('retirement_date', 'is', null);
  console.log(`Retirement dates populated: ${rdCount} sets`);
}

run().catch(e => { console.error(e); process.exit(1); });
