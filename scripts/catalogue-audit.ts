/**
 * Catalogue Health Audit — DB checks (row counts, price/image coverage,
 * scraper staleness). Live-endpoint checks stay inline in the workflow.
 *
 * Run: npx tsx scripts/catalogue-audit.ts
 * Wired into: .github/workflows/catalogue-audit.yml (weekly, Mon 03:30 UTC).
 */
import { appendFileSync } from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '../src/lib/get-secret';

dotenv.config({ path: '.env.local' });

function setOutput(name: string, value: string) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

// Default before anything that could throw or exit early — a crash (missing
// env vars, dropped Supabase connection, etc.) must never leave mrp_only
// looking like a confirmed true. The workflow's dedup step treats this as
// "safe to skip a fresh issue"; "we don't know what failed" must default to
// "no", not silently inherit whatever the last successful run happened to set.
setOutput('mrp_only', 'false');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = getSecret('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('::error::NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type Failure = { key: string; message: string };

// PostgREST caps any single request at 1000 rows regardless of .limit()/
// .range() overrides (confirmed repo-wide convention, e.g. scrape-now.mjs's
// knownSets loop) — paginate in a loop for any table that can exceed that.
async function fetchAllPaginated<T>(
  table: string,
  select: string,
  filterFn?: (q: ReturnType<typeof sb.from>) => ReturnType<typeof sb.from>
): Promise<T[]> {
  const PAGE = 1000;
  let all: T[] = [];
  let offset = 0;
  for (;;) {
    let q = sb.from(table).select(select).range(offset, offset + PAGE - 1) as any;
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    all = all.concat(data as T[]);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

async function audit() {
  const failures: Failure[] = [];

  // 1. Total row count (threshold 8,000 — ~26k Rebrickable entries dedup to ~10k unique set_numbers)
  const { count: totalRows } = await sb.from('sets').select('*', { count: 'exact', head: true });
  console.log('sets total rows:', totalRows);
  if (!totalRows || totalRows < 8000) failures.push({ key: 'row_count', message: 'sets row count ' + totalRows + ' < 8,000' });

  // 2. MRP coverage — must be checked against LISTED sets only, never the
  // full `sets` catalogue. Fixed 2026-08-16 after a real investigation
  // found the old check (year>=2020-scoped, ~8,656 sets, 45% threshold)
  // was comparing lego_mrp_inr against a population almost entirely
  // disconnected from what BOI actually lists/sells — most of those 8,656
  // sets were never scraped, priced, or carried by Toycra/MyBrickHouse at
  // all. Real listed-set coverage was already 94-96% the whole time this
  // check was reporting "failure" (16 of 19 weekly runs since April).
  //
  // Universe: every distinct set_number with ANY row in store_prices
  // (Toycra and/or MyBrickHouse) — active or not, since a set that's
  // temporarily out of stock should still carry a tracked MRP, not lose
  // it from the audit's scope. Rule is 100% coverage, no percentage
  // threshold — every listed set either has lego_mrp_inr or it's a real,
  // named, actionable gap. DATA-01: store_prices.set_id is the plain
  // set_number string, not a UUID FK to sets.id — join on set_number.
  const storePriceRows = await fetchAllPaginated<{ set_id: string }>('store_prices', 'set_id');
  const listedSetNumbers = Array.from(new Set(storePriceRows.map((r) => r.set_id)));
  console.log('distinct listed set_numbers (Toycra/MyBrickHouse, any status):', listedSetNumbers.length);

  // (g) 1 Oct 2026: the check is what the PAGE shows, not the legacy column. A listed set's page
  // shows an MRP from the store anchor (set_price_summary.anchor_mrp_inr) or a verified catalogue
  // MRP. Gifts with purchase have no retail price by design (is_gwp) and are not counted.
  // Only sets a store lists now count (in stock, or seen in the last 7 days).
  const recent = new Set((await fetchAllPaginated<{ set_id: string; in_stock: boolean; scraped_at: string }>('store_prices', 'set_id, in_stock, scraped_at'))
    .filter((r) => r.in_stock || Date.now() - Date.parse(r.scraped_at) < 7 * 86400000).map((r) => r.set_id));
  const anchors = new Map((await fetchAllPaginated<{ set_id: string; anchor_mrp_inr: number | null }>('set_price_summary', 'set_id, anchor_mrp_inr'))
    .map((r) => [r.set_id, r.anchor_mrp_inr]));
  const missingMrpSets: { set_number: string; name: string }[] = [];
  const CHUNK = 200;
  const current = listedSetNumbers.filter((n) => recent.has(n));
  for (let i = 0; i < current.length; i += CHUNK) {
    const chunk = current.slice(i, i + CHUNK);
    const { data, error } = await sb.from('sets').select('set_number, name, lego_mrp_inr, mrp_verified, is_gwp').in('set_number', chunk);
    if (error) throw error;
    const found = new Set((data ?? []).map((s) => s.set_number));
    for (const s of data ?? []) {
      if (s.is_gwp) continue;
      const pageShowsMrp = anchors.get(s.set_number) != null || (s.lego_mrp_inr != null && s.mrp_verified);
      if (!pageShowsMrp) missingMrpSets.push({ set_number: s.set_number, name: s.name });
    }
    for (const sn of chunk) {
      if (!found.has(sn)) missingMrpSets.push({ set_number: sn, name: '(not found in sets table)' });
    }
  }

  const mrpCoveredCount = current.length - missingMrpSets.length;
  const pricePct = current.length ? Math.round((mrpCoveredCount / current.length) * 100) : 100;
  console.log(`currently listed sets whose page shows an MRP (store anchor or verified; GWPs excluded): ${mrpCoveredCount}/${current.length} (${pricePct}%)`);
  if (missingMrpSets.length > 0) {
    const sample = missingMrpSets.slice(0, 20).map((s) => `${s.set_number} (${s.name})`).join(', ');
    const more = missingMrpSets.length > 20 ? ` and ${missingMrpSets.length - 20} more` : '';
    failures.push({ key: 'mrp_coverage', message: `${missingMrpSets.length} of ${current.length} currently listed set pages show no MRP: ${sample}${more}` });
  }

  // (g) Theme shown as "Unknown" (or blank) on an indexable set page.
  const { data: badTheme } = await sb.from('sets').select('set_number, name')
    .or('theme.is.null,theme.eq.,theme.eq.Unknown').neq('index_tier', 'tier3').eq('noindex_override', false).limit(50);
  console.log(`indexable set pages with a blank/"Unknown" theme: ${(badTheme ?? []).length}`);
  if ((badTheme ?? []).length) failures.push({ key: 'unknown_theme', message: `${badTheme!.length} indexable set pages show theme "Unknown": ${badTheme!.slice(0, 10).map((s) => s.set_number + ' (' + s.name + ')').join(', ')}` });

  // (g) A store row linked to another set's product page (the product URL names a different 5-6 digit set number).
  const linkRows = await fetchAllPaginated<{ set_id: string; store_id: string; product_url: string | null }>('store_prices', 'set_id, store_id, product_url');
  const wrongLinks = linkRows.filter((r) => {
    const h = (r.product_url ?? '').split('/products/')[1] ?? '';
    const nums: string[] = h.match(/(?<!\d)\d{5,6}(?!\d)/g) ?? [];
    return nums.length > 0 && !nums.includes(r.set_id);
  });
  console.log(`store rows linking to a different set's product: ${wrongLinks.length}`);
  if (wrongLinks.length) failures.push({ key: 'wrong_store_link', message: `${wrongLinks.length} store rows link to another set's product: ${wrongLinks.slice(0, 10).map((r) => r.store_id + ' ' + r.set_id).join(', ')}` });

  // 3. Rows with image_url
  const { count: imageRows } = await sb.from('sets').select('*', { count: 'exact', head: true }).not('image_url', 'is', null);
  const imgPct = totalRows ? Math.round(((imageRows ?? 0) / totalRows) * 100) : 0;
  console.log('sets with image_url:', imageRows, '(' + imgPct + '%)');
  if (imgPct < 80) failures.push({ key: 'image_coverage', message: 'only ' + imgPct + '% of sets have image_url (threshold: 80%)' });

  // 4. Scraper staleness: each store in store_prices
  const { data: prices } = await sb.from('store_prices').select('store_id, scraped_at').order('scraped_at', { ascending: false });
  const byStore: Record<string, string> = {};
  for (const p of prices ?? []) {
    if (!byStore[p.store_id]) byStore[p.store_id] = p.scraped_at;
  }
  for (const [store, latest] of Object.entries(byStore)) {
    const days = (Date.now() - new Date(latest).getTime()) / 86400000;
    console.log('store_prices', store, 'last scraped:', latest, '(' + days.toFixed(1) + 'd ago)');
    if (days > 8) failures.push({ key: 'scraper_stale', message: 'scraper stale: ' + store + ' last ran ' + days.toFixed(1) + 'd ago (threshold: 8d)' });
  }

  if (failures.length > 0) {
    const mrpOnly = failures.every((f) => f.key === 'mrp_coverage');
    setOutput('mrp_only', String(mrpOnly));
    console.error('FAILURES:', failures.map((f) => f.message).join('; '));
    process.exit(1);
  }
  console.log('All DB checks passed.');
}

audit().catch((e) => {
  console.error(e);
  process.exit(1);
});
