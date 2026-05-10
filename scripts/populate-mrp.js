// scripts/populate-mrp.js
// Populates lego_mrp_inr on sets table using Brickset API retail prices.
// Fetches all sets by year (2020–2027) from Brickset API, converts LEGOCom.US.retailPrice → INR (×90, round to nearest ₹100).
// Safe to re-run — only writes to rows where lego_mrp_inr IS NULL.
// Usage: node scripts/populate-mrp.js [--dry-run]

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Load .env.local
const envRaw = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envRaw.split('\n')) {
  const eq = line.indexOf('=');
  if (eq === -1 || line.trim().startsWith('#')) continue;
  env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}

const BRICKSET_KEY = env.BRICKSET_API_KEY;
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

if (!BRICKSET_KEY) { console.error('BRICKSET_API_KEY missing from .env.local'); process.exit(1); }

const DRY_RUN    = process.argv.includes('--dry-run');
const START_YEAR = 2020;
const END_YEAR   = 2027;
const PAGE_SIZE  = 500;
const CALL_DELAY = 1000; // ms between Brickset API calls

// LEGO India MRP ≈ USD × 90, rounded to nearest ₹100.
// Empirically verified against lego.com/en-in pricing; rate-independent.
// sync-rebrickable.js used × 1.35 × live_rate which was calibrated for USD/INR ~74 and overshoots at current rates.
const USD_TO_INR = 90;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function usdToInr(usd) {
  return Math.round(usd * USD_TO_INR / 100) * 100;
}

async function fetchBricksetYear(year) {
  const prices = {}; // set_number → inr_price
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
      if (usd && usd > 0) prices[set.number] = usdToInr(usd);
    }

    const fetched = (page - 1) * PAGE_SIZE + (json.sets?.length ?? 0);
    console.log(`  ${year} p${page}: ${json.sets?.length ?? 0} sets | ${Object.keys(prices).length} priced so far / ${total} total`);
    if (fetched >= total) break;
    page++;
    await sleep(CALL_DELAY);
  }

  return prices;
}

async function loadDbSets() {
  const PAGE = 1000;
  let offset = 0;
  const all = [];
  while (true) {
    const { data, error } = await sb
      .from('sets')
      .select('id, set_number, name, year')
      .gte('year', START_YEAR)
      .is('lego_mrp_inr', null)
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

async function run() {
  console.log(`populate-mrp.js  dry-run=${DRY_RUN}  scope=year>=${START_YEAR}`);

  // Phase 1 — fetch all Brickset prices by year
  const bricksetPrices = {};
  for (let year = START_YEAR; year <= END_YEAR; year++) {
    console.log(`\nFetching Brickset year ${year}...`);
    const yp = await fetchBricksetYear(year);
    Object.assign(bricksetPrices, yp);
    await sleep(CALL_DELAY);
  }
  console.log(`\nBrickset map: ${Object.keys(bricksetPrices).length} sets with USD retail price`);

  // Phase 2 — load DB sets needing MRP
  console.log(`\nLoading DB sets (year>=${START_YEAR}, lego_mrp_inr IS NULL)...`);
  const dbSets = await loadDbSets();
  console.log(`DB sets to fill: ${dbSets.length}`);

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
    return;
  }

  // Phase 4 — update in parallel batches of 50 (upsert can't be used — PostgREST INSERT leg hits NOT NULL on set_number)
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
  console.log(`\nDone. ${written} rows updated.`);

  // Final audit-gate check
  const { count: scoped } = await sb.from('sets').select('*', { count: 'exact', head: true }).gte('year', START_YEAR);
  const { count: priced } = await sb.from('sets').select('*', { count: 'exact', head: true }).gte('year', START_YEAR).not('lego_mrp_inr', 'is', null);
  const pct = scoped ? Math.round(priced / scoped * 100) : 0;
  console.log(`\nAudit gate: ${priced}/${scoped} (${pct}%) 2020+ sets have lego_mrp_inr — ${pct >= 45 ? 'PASS ✓' : 'FAIL ✗ (need 45%)'}`);
}

run().catch(e => { console.error(e); process.exit(1); });
