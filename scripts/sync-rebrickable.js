/**
 * Syncs LEGO sets from Rebrickable API into Supabase.
 * Run: node scripts/sync-rebrickable.js
 *
 * Fetches the full Rebrickable catalogue (no year filter, no page cap).
 * After sync, derives lego_mrp_inr for sets where usd_msrp is populated.
 *
 * Expected row count after a full sync: 15,000–30,000.
 * Assertion fails loudly if < 5,000 rows are present after sync.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// ── Env validation ────────────────────────────────────────────────────────────

const REBRICKABLE_API_KEY = process.env.REBRICKABLE_API_KEY;
const SUPABASE_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!REBRICKABLE_API_KEY) {
  console.error('ERROR: REBRICKABLE_API_KEY is not set');
  process.exit(1);
}
if (!SUPABASE_URL) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL is not set');
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error(
    'ERROR: SUPABASE_SERVICE_ROLE_KEY is not set\n' +
    'Get it from: Supabase dashboard → Settings → API → service_role secret key',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const BASE_URL = 'https://rebrickable.com/api/v3/lego';

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fetch with exponential backoff on 429. */
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    if (res.status === 429) {
      const delay = 2000 * Math.pow(2, attempt); // 2 s, 4 s, 8 s
      console.warn(`[RB] 429 rate limit — retry in ${delay}ms (attempt ${attempt + 1}/${retries})`);
      await sleep(delay);
      continue;
    }
    return res;
  }
  throw new Error(`Still getting 429 after ${retries} retries: ${url}`);
}

// ── Theme name cache ──────────────────────────────────────────────────────────

const themeCache = {};

async function getThemeName(themeId) {
  if (themeCache[themeId] !== undefined) return themeCache[themeId];
  try {
    const res = await fetchWithRetry(
      `${BASE_URL}/themes/${themeId}/`,
      { headers: { Authorization: `key ${REBRICKABLE_API_KEY}` } },
    );
    if (!res.ok) {
      themeCache[themeId] = 'Unknown';
      return 'Unknown';
    }
    const data = await res.json();
    themeCache[themeId] = data.name ?? 'Unknown';
  } catch (err) {
    console.warn(`[RB] Theme ${themeId} lookup failed: ${err.message}`);
    themeCache[themeId] = 'Unknown';
  }
  return themeCache[themeId];
}

// ── Set upsert ────────────────────────────────────────────────────────────────

async function upsertSet(set, themeName) {
  const { error } = await supabase.from('sets').upsert(
    {
      set_number:    set.set_num.replace(/-\d+$/, ''),
      name:          set.name,
      theme:         themeName,
      year:          set.year,
      pieces:        set.num_parts,
      image_url:     set.set_img_url,
      rebrickable_id: set.set_num,
      updated_at:    new Date().toISOString(),
    },
    { onConflict: 'set_number' },
  );
  if (error) {
    console.error(`  ✗ Upsert failed for ${set.set_num}: ${error.message}`);
    return false;
  }
  return true;
}

// ── USD/INR exchange rate ─────────────────────────────────────────────────────

const FALLBACK_RATE = 83.0;

async function fetchUsdInrRate() {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=INR');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rate = data.rates?.INR;
    if (!rate) throw new Error('INR rate missing from response');
    console.log(`[FX]  USD/INR: ${rate} (source: frankfurter.app, date: ${data.date})`);
    return rate;
  } catch (err) {
    console.warn(`[FX]  Rate fetch failed: ${err.message}`);
    console.warn(`[FX]  Using fallback rate: ${FALLBACK_RATE}`);
    return FALLBACK_RATE;
  }
}

// ── INR derivation ────────────────────────────────────────────────────────────

async function deriveIndiaPrices(usdInrRate) {
  console.log('\n[DERIVE] Deriving lego_mrp_inr from usd_msrp (formula: usd_msrp × 1.35 × rate)...');
  const { data: rows, error } = await supabase
    .from('sets')
    .select('id, set_number, usd_msrp')
    .not('usd_msrp', 'is', null);

  if (error) {
    // Column likely doesn't exist yet — schema migration required first.
    console.warn(`[DERIVE] Skipped — query error: ${error.message}`);
    console.warn('[DERIVE] To enable INR derivation: add usd_msrp NUMERIC column to sets table,');
    console.warn('[DERIVE] then populate it from Brickset or another MSRP source.');
    return;
  }

  if (!rows || rows.length === 0) {
    console.log('[DERIVE] 0 rows have usd_msrp populated — nothing to derive.');
    console.log('[DERIVE] To populate: add usd_msrp column and ingest from Brickset.');
    return;
  }

  let derived = 0;
  let failed = 0;
  for (const row of rows) {
    const mrp_inr = Math.round(row.usd_msrp * 1.35 * usdInrRate);
    const { error: updErr } = await supabase
      .from('sets')
      .update({ lego_mrp_inr: mrp_inr })
      .eq('id', row.id);
    if (updErr) {
      console.error(`  ✗ Update failed for ${row.set_number}: ${updErr.message}`);
      failed++;
    } else {
      derived++;
    }
  }

  console.log(`[DERIVE] ${derived} rows derived, ${failed} failed. Rate used: ${usdInrRate}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const startTime = Date.now();
  console.log('🧱 Syncing LEGO sets from Rebrickable (full catalogue — no year filter, no page cap)');
  console.log(`   Started: ${new Date().toISOString()}\n`);

  let synced = 0;
  let failed = 0;
  let pageNum = 1;
  let nextUrl = `${BASE_URL}/sets/?page_size=100&ordering=-year`;

  while (nextUrl) {
    let data;
    try {
      const res = await fetchWithRetry(nextUrl, {
        headers: { Authorization: `key ${REBRICKABLE_API_KEY}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      console.error(`[RB] Page ${pageNum} fetch failed: ${err.message} — stopping pagination`);
      break;
    }

    const results = data?.results ?? [];
    if (results.length === 0) break;

    // Process sets on this page
    for (const set of results) {
      const themeName = await getThemeName(set.theme_id);
      const ok = await upsertSet(set, themeName);
      if (ok) synced++;
      else failed++;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(
      `  Page ${pageNum}: ${results.length} sets — running total: ${synced} synced, ${failed} failed (${elapsed}s elapsed)`,
    );

    nextUrl = data.next ?? null;
    pageNum++;

    if (nextUrl) await sleep(1100); // Respect Rebrickable ~1 req/s free-tier limit
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[SYNC] Complete — ${synced} upserted, ${failed} failed in ${elapsed}s`);
  if (failed > 0) console.error(`[SYNC] ⚠️  ${failed} sets failed — check errors above`);

  // ── Post-write assertion ──────────────────────────────────────────────────

  const { count: totalRows, error: countErr } = await supabase
    .from('sets')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    console.error(`[ASSERT] Could not count rows: ${countErr.message}`);
    process.exit(1);
  }

  console.log(`[ASSERT] sets table row count: ${totalRows}`);
  if (totalRows < 5000) {
    console.error(`[ASSERT] FAIL — expected ≥ 5,000 rows after full sync, got ${totalRows}`);
    console.error('[ASSERT] Possible causes: Rebrickable API key expired, sync aborted early, or partial fetch.');
    process.exit(1);
  }
  console.log('[ASSERT] PASS — row count ≥ 5,000 ✓');

  // ── INR derivation ────────────────────────────────────────────────────────

  const usdInrRate = await fetchUsdInrRate();
  await deriveIndiaPrices(usdInrRate);

  console.log(`\n🏁 All done. ${new Date().toISOString()}`);
}

run().catch((err) => {
  console.error('Sync script crashed:', err);
  process.exit(1);
});
