// scripts/audit-mrp.mjs
// MRP integrity audit (2026-07-02 health audit item #1).
//
// Context: lego_mrp_inr is populated by populate-mrp.js as Brickset US retail
// price × USD/INR, rounded to ₹100 — an ESTIMATE, not the official LEGO India
// MRP. Actual India MRPs run ~10–25% above US-converted (import duty + GST),
// so the estimate systematically undercuts reality and makes partner stores
// look like they price above MRP (seen live on 77254: est ₹2,500 vs both
// stores at ₹2,999 — the real India MRP for that set is almost certainly
// ₹2,999).
//
// This script does NOT rewrite data. It reports, in confidence order:
//   TIER A (near-certain wrong): every ACTIVE tracked store sells above the
//          stored MRP — retailers don't uniformly price above a real MRP.
//          Suggested fix: min active store price (that IS the shelf MRP in
//          most Indian LEGO retail, both stores sell at MRP outside sales).
//   TIER B (suspicious): stored MRP deviates >20% below the cheapest active
//          store price on sets with only one active store.
//   TIER C (cosmetic): MRP not ending in ₹99/₹999 pattern typical of LEGO
//          India price points (informational only).
//
// Output: audit/mrp-audit-<date>.csv + console summary.
// Usage:  node scripts/audit-mrp.mjs            (report only)
//         node scripts/audit-mrp.mjs --fix-a    (apply TIER A suggested fixes)
//
// --fix-a updates lego_mrp_inr to the min active store price for TIER A rows
// only, and only where BOTH active stores agree on price (strongest signal).

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
const FIX_A = process.argv.includes('--fix-a');

const PAGE = 1000;

async function fetchAll(table, select, filter) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select(select).range(from, from + PAGE - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

const sets = await fetchAll('sets', 'id,set_number,name,lego_mrp_inr', q => q.not('lego_mrp_inr', 'is', null));
const prices = await fetchAll('store_prices', 'set_id,store_id,price_inr,in_stock,scraped_at');
// DATA-01: store_prices.set_id is the plain set_number string, not a UUID FK to sets.id — join on set_number.

const bySet = new Map();
for (const p of prices) {
  if (p.price_inr == null) continue;
  if (!bySet.has(p.set_id)) bySet.set(p.set_id, []);
  bySet.get(p.set_id).push(p);
}

const tierA = [], tierB = [], tierC = [];

for (const s of sets) {
  const mrp = Number(s.lego_mrp_inr);
  const active = (bySet.get(s.set_number) ?? []).filter(p => p.in_stock !== false);
  if (active.length > 0) {
    const min = Math.min(...active.map(p => Number(p.price_inr)));
    const allAbove = active.every(p => Number(p.price_inr) > mrp);
    if (allAbove) {
      tierA.push({ ...s, mrp, storeMin: min, stores: active.length, suggested: min });
      continue;
    }
    if (active.length === 1 && mrp < min * 0.8) {
      tierB.push({ ...s, mrp, storeMin: min, stores: 1 });
      continue;
    }
  }
  const mod = mrp % 1000;
  if (mod !== 999 && mod % 100 !== 99) tierC.push({ ...s, mrp });
}

fs.mkdirSync('audit', { recursive: true });
const date = new Date().toISOString().slice(0, 10);
const csvPath = `audit/mrp-audit-${date}.csv`;
const lines = ['tier,set_number,name,stored_mrp,min_active_store_price,active_stores,suggested_mrp'];
for (const r of tierA) lines.push(`A,${r.set_number},"${r.name.replaceAll('"', '""')}",${r.mrp},${r.storeMin},${r.stores},${r.suggested}`);
for (const r of tierB) lines.push(`B,${r.set_number},"${r.name.replaceAll('"', '""')}",${r.mrp},${r.storeMin},${r.stores},`);
for (const r of tierC) lines.push(`C,${r.set_number},"${r.name.replaceAll('"', '""')}",${r.mrp},,,`);
fs.writeFileSync(csvPath, lines.join('\n'));

console.log(`MRP audit — ${sets.length} sets with stored MRP`);
console.log(`  TIER A (all active stores above stored MRP — near-certain wrong): ${tierA.length}`);
console.log(`  TIER B (single store, MRP >20% below store price — suspicious):   ${tierB.length}`);
console.log(`  TIER C (atypical price point — cosmetic):                          ${tierC.length}`);
console.log(`  Report: ${csvPath}`);

if (FIX_A) {
  const fixable = tierA.filter(r => {
    const active = (bySet.get(r.set_number) ?? []).filter(p => p.in_stock !== false);
    const uniq = new Set(active.map(p => Number(p.price_inr)));
    return active.length >= 2 && uniq.size === 1; // both stores agree — strongest signal
  });
  console.log(`\n--fix-a: ${fixable.length} of ${tierA.length} TIER A rows have >=2 agreeing stores; updating those only.`);
  let ok = 0;
  for (const r of fixable) {
    const { error } = await sb.from('sets').update({ lego_mrp_inr: r.suggested }).eq('id', r.id);
    if (error) console.error(`  FAIL ${r.set_number}: ${error.message}`);
    else ok++;
  }
  console.log(`--fix-a: ${ok}/${fixable.length} updated. Remaining TIER A rows need eyes — see CSV.`);
}
