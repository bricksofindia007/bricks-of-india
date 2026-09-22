/**
 * Daily price snapshot — reads store_prices and writes one row per
 * (set, store) into price_snapshots for today's UTC date.
 *
 * Run:      node scripts/snapshot-prices.js
 * Schedule: GitHub Actions 03:00 UTC daily (.github/workflows/snapshot-prices.yml)
 *
 * Source columns (store_prices): set_id, store_id, price_inr, in_stock, scraped_at
 * Target columns (price_snapshots): set_num, store, price_inr, in_stock, snapshot_date
 *
 * Idempotent: ON CONFLICT (set_num, store, snapshot_date) DO UPDATE.
 * Re-running on the same UTC day updates existing rows rather than inserting duplicates.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// ── Env validation ─────────────────────────────────────────────────────────────

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('[snapshot-prices] ERROR: NEXT_PUBLIC_SUPABASE_URL is not set');
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error(
    '[snapshot-prices] ERROR: SUPABASE_SERVICE_ROLE_KEY is not set\n' +
    'Get it from: Supabase dashboard → Settings → API → service_role secret key',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Pagination helper ────────────────────────────────────────────────────────
// PostgREST caps any single request at 1000 rows regardless of the client's
// own request — see CLAUDE.md's "PostgREST 1000-row cap" gotcha. store_prices
// crossed 1000 real rows some time after this script was first written
// (2026-05-02), and the un-paginated query below silently capped every daily
// snapshot at exactly 1000 rows ever since — confirmed live 2026-09-22:
// store_prices had 1882 real rows, price_snapshots for 2026-09-21 had
// exactly 1000 (issue #171). Paginate in a loop, same pattern as
// scrape-now.mjs's knownSets load, until a page returns fewer than PAGE rows.
const PAGE = 1000;
async function paginate(query) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await query(offset);
    if (error) return { data: null, error };
    for (const r of data ?? []) rows.push(r);
    if ((data ?? []).length < PAGE) break;
  }
  return { data: rows, error: null };
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function run() {
  const startTime    = Date.now();
  const snapshotDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  console.log(`[snapshot-prices] Starting daily snapshot for ${snapshotDate}`);

  // 1. Query source prices — non-null price_inr only, latest scraped_at first,
  //    paginated past PostgREST's 1000-row cap (see note above).
  //    store_prices columns: set_id (string), store_id (string), price_inr, in_stock, scraped_at.
  // Secondary sort key (id) makes the ordering fully deterministic across
  // page boundaries -- scraped_at alone can tie (many rows share the exact
  // same timestamp within one scrape batch), and an unstable sort would
  // risk skipping or duplicating rows between .range() pages.
  const { data: sourcePrices, error: sourceErr } = await paginate((offset) =>
    supabase
      .from('store_prices')
      .select('id, set_id, store_id, price_inr, in_stock, scraped_at')
      .not('price_inr', 'is', null)
      .order('scraped_at', { ascending: false })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1),
  );

  if (sourceErr) {
    console.error(`[snapshot-prices] ERROR: source query failed — ${sourceErr.message}`);
    process.exit(1);
  }

  if (!sourcePrices || sourcePrices.length === 0) {
    console.error('[snapshot-prices] ERROR: no source price data, refusing to write zero snapshots.');
    process.exit(1);
  }

  console.log(`[snapshot-prices] considered ${sourcePrices.length} rows from store_prices`);

  // 2. Deduplicate: keep the latest-scraped row per (set_id, store_id).
  //    sourcePrices is ORDER BY scraped_at DESC so first occurrence = latest.
  const seen    = new Set();
  const deduped = [];
  for (const row of sourcePrices) {
    const key = `${row.set_id}::${row.store_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(row);
    }
  }
  const skipped = sourcePrices.length - deduped.length;
  console.log(
    `[snapshot-prices] ${deduped.length} unique (set, store) pairs — ` +
    `${skipped} older duplicate rows skipped`,
  );

  // 3. Check whether today's snapshots already exist (distinguishes inserts from updates in logs).
  const { count: beforeCount, error: countErr } = await supabase
    .from('price_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('snapshot_date', snapshotDate);

  if (countErr) {
    console.warn(`[snapshot-prices] WARN: could not check existing snapshot count — ${countErr.message}`);
  }
  const isRerun = (beforeCount ?? 0) > 0;
  if (isRerun) {
    console.log(
      `[snapshot-prices] Re-run detected — ${beforeCount} rows already exist for ` +
      `${snapshotDate}. Upserts will UPDATE existing rows.`,
    );
  }

  // 4. Upsert row by row. Single failures are logged and skipped; run continues.
  //    Aggregate failure rate is checked at the end.
  let succeeded = 0;
  let rowFailed = 0;

  for (const row of deduped) {
    const { error: upsertErr } = await supabase
      .from('price_snapshots')
      .upsert(
        {
          set_num:       row.set_id,
          store:         row.store_id,
          price_inr:     Math.round(row.price_inr),
          in_stock:      row.in_stock,
          snapshot_date: snapshotDate,
          captured_at:   new Date().toISOString(),
        },
        { onConflict: 'set_num,store,snapshot_date' },
      );

    if (upsertErr) {
      console.error(
        `[snapshot-prices] Row failed (${row.set_id}, ${row.store_id}): ${upsertErr.message}`,
      );
      rowFailed++;
    } else {
      succeeded++;
    }
  }

  // 5. Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const label   = isRerun ? 'updated' : 'written';
  console.log(
    `[snapshot-prices] Complete — ${succeeded} rows ${label}, ` +
    `${rowFailed} rows failed, ${skipped} older-duplicate rows skipped (${elapsed}s)`,
  );

  // 6. Failure-rate gate: >5% row failures → exit 1
  if (rowFailed > 0) {
    const failPct = (rowFailed / deduped.length) * 100;
    if (failPct > 5) {
      console.error(
        `[snapshot-prices] ERROR: ${failPct.toFixed(1)}% row failure rate exceeds 5% threshold — exiting 1`,
      );
      process.exit(1);
    }
    console.warn(
      `[snapshot-prices] WARN: ${rowFailed} row(s) failed but below 5% threshold — run counted as successful`,
    );
  }

  console.log(`[snapshot-prices] 🏁 Done. ${new Date().toISOString()}`);
}

run().catch((err) => {
  console.error('[snapshot-prices] Unhandled error:', err);
  process.exit(1);
});
