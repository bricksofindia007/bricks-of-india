// Count-only dry run of the MRP estimate job. Reads only. Prints counts only: no set numbers, names, prices or
// connection details. No writes, and no service key is used.
// Env: BRICKSET_API_KEY and CI_READONLY_DB_URL (read-only database role). A rate comes from the live fetch only
// (no stored row yet): a rate that fails the band check or cannot be fetched means a live run would write nothing.
// Scope: the year 2020 onward, as the job's main sweep. The job's pre-2020 listed-set step is not counted here.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveRate } = require('./lib/usd-rate.cjs');

const KEY = (process.env.BRICKSET_API_KEY ?? '').replace(/^﻿/, '');
const DB = process.env.CI_READONLY_DB_URL ?? '';
if (!KEY || !DB) {
  console.error('BRICKSET_API_KEY or CI_READONLY_DB_URL is not set');
  process.exit(2);
}
const START_YEAR = 2020;
const END_YEAR = 2027;
const PAGE_SIZE = 500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function bricksetUsdBySet() {
  const usd = new Map();
  for (let year = START_YEAR; year <= END_YEAR; year++) {
    let page = 1;
    let fetched = 0;
    let total = null;
    while (true) {
      const params = encodeURIComponent(JSON.stringify({ year: String(year), pageSize: PAGE_SIZE, pageNumber: page }));
      const r = await fetch(`https://brickset.com/api/v3.asmx/getSets?apiKey=${KEY}&userHash=&params=${params}`);
      if (!r.ok) throw new Error(`Brickset HTTP ${r.status}`);
      const json = await r.json();
      if (json.status !== 'success') throw new Error('Brickset API error');
      if (total === null) total = Number(json.matches) || 0;
      const sets = json.sets || [];
      for (const set of sets) {
        const price = set.LEGOCom?.US?.retailPrice;
        if (price && price > 0) usd.set(set.number, price);
      }
      fetched += sets.length;
      // Same stop rule as the job: the total Brickset reports, or an empty page.
      if (sets.length === 0 || fetched >= total) break;
      page++;
      await sleep(1000);
    }
    await sleep(1000);
  }
  return usd;
}

function dbSetNumbersMissingMrp() {
  try {
    const out = execFileSync('psql', [DB, '-At', '-v', 'ON_ERROR_STOP=1', '-c',
      'select set_number from public.sets where lego_mrp_inr is null and year >= 2020'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } catch {
    throw new Error('database read failed (details not printed)');
  }
}

async function liveRate() {
  let fetched = null;
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const d = await r.json();
    if (typeof d?.rates?.INR === 'number') fetched = d.rates.INR;
  } catch { /* no fetched value */ }
  return resolveRate({ fetched, stored: null, today: new Date().toISOString().slice(0, 10) });
}

const rate = await liveRate();
const missing = dbSetNumbersMissingMrp();
const usd = await bricksetUsdBySet();
const withUsd = missing.filter((n) => usd.has(n)).length;
console.log(`count-only dry run (no writes)`);
console.log(`rate: ${rate.source}`);
console.log(`sets without a launch price (year 2020 onward): ${missing.length}`);
console.log(`of those, with a US price on Brickset: ${withUsd}`);
console.log(`of those, without a US price: ${missing.length - withUsd}`);
console.log(rate.rate == null
  ? `a live run would write 0 rows: ${rate.alert}`
  : `a live run would write ${withUsd} rows at the live rate`);
