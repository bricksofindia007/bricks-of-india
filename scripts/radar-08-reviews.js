'use strict';
/**
 * RADAR-08 — Review candidate generator
 *
 * Identifies in-stock sets that have no existing review and no pending
 * review draft, then writes up to 10 approved draft rows to pending_drafts.
 *
 * Priority: mybrickhouse first, toycra second, jaiman third.
 * Tiebreak within same store: higher price_inr first.
 *
 * Usage:
 *   node --env-file=.env.local scripts/radar-08-reviews.js --dry-run
 *   node --env-file=.env.local scripts/radar-08-reviews.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const CAP     = 10;
const PAGE    = 1000;

const STORE_PRIORITY = { mybrickhouse: 1, toycra: 2, jaiman: 3 };

const MIN_PRICE_INR = 1000;
// Accessories with a scraper-matched set number are not reviewable content
const ACCESSORY_RE  = /\b(pen|keychain|key chain|magnet|bag charm|pin)\b/i;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Indian number formatter — no toLocaleString('en-IN') (Netlify minimal ICU)
function fmtInr(n) {
  const s = Math.round(n).toString();
  const last3 = s.slice(-3);
  const rest  = s.slice(0, -3);
  if (!rest) return last3;
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

async function paginate(query) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await query(offset);
    if (error) throw error;
    for (const r of data ?? []) rows.push(r);
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

(async () => {
  console.log(`━━ RADAR-08 review candidates${DRY_RUN ? ' [DRY-RUN]' : ''} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  const t0 = Date.now();

  // 1. All in-stock store_prices with a price
  const stockRows = await paginate(offset =>
    sb.from('store_prices')
      .select('set_id, store_id, price_inr, product_url')
      .eq('in_stock', true)
      .not('price_inr', 'is', null)
      .range(offset, offset + PAGE - 1)
  );
  console.log(`In-stock rows:         ${stockRows.length}`);

  // 2. sets lookup — need name and UUID for review dedup
  const setNumbers = [...new Set(stockRows.map(r => r.set_id))];
  const setsMap = {};
  for (let i = 0; i < setNumbers.length; i += PAGE) {
    const chunk = setNumbers.slice(i, i + PAGE);
    const { data, error } = await sb
      .from('sets')
      .select('id, set_number, name')
      .in('set_number', chunk)
      .not('name', 'is', null);
    if (error) throw error;
    for (const s of data ?? []) setsMap[s.set_number] = s;
  }
  console.log(`Matched sets:          ${Object.keys(setsMap).length}`);

  // 3. Set UUIDs already reviewed
  const reviewedUuids = new Set();
  const reviewRows = await paginate(offset =>
    sb.from('reviews').select('set_id').range(offset, offset + PAGE - 1)
  );
  for (const r of reviewRows) reviewedUuids.add(r.set_id);
  console.log(`Reviewed set UUIDs:    ${reviewedUuids.size}`);

  // 4. All existing source_urls in pending_drafts (post-dedup check)
  const existingUrls = new Set();
  const draftRows = await paginate(offset =>
    sb.from('pending_drafts').select('source_url').range(offset, offset + PAGE - 1)
  );
  for (const r of draftRows) existingUrls.add(r.source_url);
  console.log(`Pending draft URLs:    ${existingUrls.size}`);

  // 5. Build best-store row per set_number
  const bestBySet = {};
  for (const row of stockRows) {
    const setNum  = row.set_id;
    const setInfo = setsMap[setNum];
    if (!setInfo) continue;

    const pri   = STORE_PRIORITY[row.store_id] ?? 99;
    const price = row.price_inr ?? 0;
    const cur   = bestBySet[setNum];
    if (!cur || pri < cur.pri || (pri === cur.pri && price > cur.price)) {
      bestBySet[setNum] = { setNum, setInfo, store_id: row.store_id, price, product_url: row.product_url, pri };
    }
  }

  // 6. Filter: price floor, no accessories, no review, no existing pending draft
  const candidates = Object.values(bestBySet).filter(c => {
    if (c.price < MIN_PRICE_INR) return false;
    if (ACCESSORY_RE.test(c.setInfo.name)) return false;
    if (reviewedUuids.has(c.setInfo.id)) return false;
    const url = `https://brickset.com/sets/${c.setNum}/`;
    if (existingUrls.has(url)) return false;
    return true;
  });
  console.log(`Candidates after filters: ${candidates.length}`);

  // 7. Sort: store priority asc, then price desc
  candidates.sort((a, b) =>
    a.pri !== b.pri ? a.pri - b.pri : b.price - a.price
  );

  const selected = candidates.slice(0, CAP);

  console.log(`\nSelected ${selected.length} sets:\n`);
  const drafts = selected.map((c, i) => {
    const title      = `LEGO ${c.setInfo.name} (${c.setNum}) — Worth ₹${fmtInr(c.price)} in India?`;
    const sourceUrl  = `https://brickset.com/sets/${c.setNum}/`;
    const sourceTitle = `LEGO ${c.setInfo.name} (${c.setNum}) — Brickset`;
    console.log(`  ${String(i + 1).padStart(2)}. [${c.store_id}] ${title}`);
    return {
      source_url          : sourceUrl,
      source_title        : sourceTitle,
      source_excerpt      : null,
      source_published_at : null,
      draft_title         : title,
      draft_format        : 'review',
      status              : 'approved',
    };
  });

  if (!DRY_RUN && drafts.length > 0) {
    const { error } = await sb.from('pending_drafts').insert(drafts);
    if (error) throw error;
    console.log(`\nWrote ${drafts.length} rows to pending_drafts (status=approved).`);
  } else if (DRY_RUN) {
    console.log(`\n[DRY-RUN] Would write ${drafts.length} rows.`);
  } else {
    console.log('\nNo candidates — nothing written.');
  }

  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nRADAR-08 SUMMARY: in_stock=${stockRows.length} matched_sets=${Object.keys(setsMap).length} reviewed=${reviewedUuids.size} candidates=${candidates.length} selected=${selected.length} duration=${dur}s${DRY_RUN ? ' [DRY-RUN]' : ''}`);
})().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
