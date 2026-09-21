/**
 * One-time backfill — connects frozen reviews (source_retailer IS NULL,
 * never RETIRED) to real current MyBrickHouse/Toycra store_prices data,
 * where a matching in-stock listing exists. After this backfill, these
 * rows are picked up automatically by the existing weekly
 * reviews-source-refresh.mjs job — no new pipeline needed.
 *
 * Mirrors resolveEligibleListing()'s retailer-selection logic (scripts/
 * lib/reviews-source.mjs): prefer the cheaper in-stock store; 'both' if
 * both stores carry it in stock.
 *
 * Content: these reviews' endings never had the deterministic retailer
 * block (they predate the 2026-07-30 pipeline). This inserts it --
 * replacing the existing "Verdict: X..." line with a
 * "Priced at ₹X on {retailer}, confirmed in stock as of {date}.\nVerdict: X."
 * pair, and replacing (or inserting, if absent -- most of these have no
 * disclaimer paragraph at all) the "Standard disclaimer: ..." line --
 * so the result matches FULL_BLOCK_RE in src/lib/publish-draft.ts and
 * next week's reviews-source-refresh.mjs can resplice it normally.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-review-source-retailer.mjs --dry-run
 *   npx tsx --env-file=.env.local scripts/backfill-review-source-retailer.mjs
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { resolveDisclaimerVariant, disclaimerTextFor, STORE_DISPLAY_NAME } from '../src/lib/review-disclaimer.ts';

const DRY_RUN = process.argv.includes('--dry-run');
const PAGE = 1000;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function fmtInr(n) {
  const s = Math.round(n).toString();
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  if (!rest) return last3;
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const FULL_BLOCK_RE = /Priced at ₹[\d,]+ on [^,]+, confirmed in stock as of [^.]+\.\nVerdict: [^.]+\.\n\nStandard disclaimer:[^\n]+/;

async function paginate(table, cols) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb.from(table).select(cols).range(offset, offset + PAGE - 1);
    if (error) throw error;
    for (const r of data ?? []) rows.push(r);
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

(async () => {
  console.log(`━━ backfill-review-source-retailer${DRY_RUN ? ' [DRY-RUN]' : ''} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  const reviews = await paginate('reviews', 'id, slug, content, verdict, set_id, source_retailer');
  const frozen = reviews.filter(r => r.source_retailer === null && r.verdict !== 'RETIRED');
  console.log(`Frozen, non-retired reviews: ${frozen.length}`);

  const sets = await paginate('sets', 'id, set_number');
  const setById = new Map(sets.map(s => [s.id, s]));

  const storePrices = await paginate('store_prices', 'set_id, in_stock, price_inr, store_id, scraped_at');
  const inStockBySetNumber = new Map();
  for (const sp of storePrices) {
    if (!sp.in_stock || sp.price_inr == null) continue;
    const arr = inStockBySetNumber.get(sp.set_id) || [];
    arr.push(sp);
    inStockBySetNumber.set(sp.set_id, arr);
  }

  let backfilled = 0, skippedNoListing = 0, skippedError = 0;
  const now = new Date().toISOString();
  const preBackfillSnapshot = [];

  for (const review of frozen) {
    const set = setById.get(review.set_id);
    if (!set) { skippedNoListing++; continue; }
    const listings = inStockBySetNumber.get(set.set_number);
    if (!listings || listings.length === 0) { skippedNoListing++; continue; }

    // Pick cheaper store if both carry it in stock — mirrors resolveEligibleListing.
    const byStore = {};
    for (const l of listings) {
      if (!byStore[l.store_id] || l.price_inr < byStore[l.store_id].price_inr) byStore[l.store_id] = l;
    }
    const storeIds = Object.keys(byStore);
    const featuredId = storeIds.length === 1
      ? storeIds[0]
      : storeIds.reduce((a, b) => (byStore[a].price_inr <= byStore[b].price_inr ? a : b));
    const sourceRetailer = storeIds.length > 1 ? 'both' : featuredId;
    const sourcePriceInr = byStore[featuredId].price_inr;

    let disclaimerVariant;
    try {
      disclaimerVariant = resolveDisclaimerVariant(review.verdict, sourceRetailer);
    } catch (err) {
      console.error(`  [SKIP] ${review.slug}: ${err.message}`);
      skippedError++;
      continue;
    }
    const retailerDisplay = STORE_DISPLAY_NAME[sourceRetailer] ?? sourceRetailer;
    const priceLine = `Priced at ₹${fmtInr(sourcePriceInr)} on ${retailerDisplay}, confirmed in stock as of ${fmtDate(now)}.`;
    const verdictLine = `Verdict: ${review.verdict}.`;
    const disclaimerLine = disclaimerTextFor(disclaimerVariant);

    let newContent = review.content.replace(/^Verdict:.*$/m, `${priceLine}\n${verdictLine}`);
    if (/^Standard disclaimer:.*$/m.test(newContent)) {
      newContent = newContent.replace(/^Standard disclaimer:.*$/m, disclaimerLine);
    } else {
      // No disclaimer paragraph existed — insert one right after the
      // verdict line so the result matches FULL_BLOCK_RE (price line ->
      // verdict line -> blank -> disclaimer), same shape as reviews
      // that already went through the retailer pipeline.
      newContent = newContent.replace(verdictLine, `${verdictLine}\n\n${disclaimerLine}`);
    }

    if (!FULL_BLOCK_RE.test(newContent)) {
      console.error(`  [SKIP] ${review.slug}: post-edit content does not match FULL_BLOCK_RE -- refusing to guess`);
      skippedError++;
      continue;
    }

    console.log(`  [BACKFILL] ${review.slug} -> ${sourceRetailer} @ ₹${fmtInr(sourcePriceInr)} (verdict unchanged: ${review.verdict})`);
    if (DRY_RUN) { backfilled++; continue; }

    preBackfillSnapshot.push({ id: review.id, slug: review.slug, content: review.content, verdict: review.verdict, source_retailer: null });

    const { error } = await sb.from('reviews').update({
      content: newContent,
      source_retailer: sourceRetailer,
      source_price_inr: sourcePriceInr,
      source_stock_status: 'in_stock',
      source_checked_at: now,
      verdict_disclaimer_variant: disclaimerVariant,
    }).eq('id', review.id);
    if (error) {
      console.error(`  [supabase-write] update error for ${review.slug}:`, error.message);
      skippedError++;
    } else {
      backfilled++;
    }
  }

  if (!DRY_RUN && preBackfillSnapshot.length > 0) {
    const backupPath = `docs/archive/reviews_pre_backfill_backup_${now.slice(0, 10)}.json`;
    fs.writeFileSync(backupPath, JSON.stringify(preBackfillSnapshot, null, 2));
    console.log(`\nPre-backfill content backed up to ${backupPath} (${preBackfillSnapshot.length} rows)`);
  }

  console.log(`\nSUMMARY: backfilled=${backfilled}, skipped (no listing)=${skippedNoListing}, skipped (error)=${skippedError}`);
  console.log(DRY_RUN ? 'DRY RUN COMPLETE -- no writes performed.' : 'WRITES COMPLETE.');
})().catch(err => { console.error('FATAL:', err); process.exit(1); });
