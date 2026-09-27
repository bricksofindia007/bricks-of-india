// Pure JS model of public.set_price_summary (FP5.1 part 2 definition,
// migration 20260927153249). Used ONLY by the FP5 scraper-contract dry run to
// compute deal / hot-deal / tie counts for hypothetical price rows WITHOUT
// writing them anywhere. Must reproduce the live view exactly on live data
// (asserted by the dry run before it is trusted).

const STALE_MS = 12 * 3600_000;

/**
 * @param {Array<{set_id,store_id,price_inr,compare_at,in_stock,scraped_at}>} storePrices
 * @param {Map<string,{mrp:number|null, v:boolean}>} sets  set_number -> catalogue MRP + verified flag
 * @param {Array<{id, display_enabled, mrp_anchor_rank, anchor_policy}>} stores
 * @param {Date} now
 */
export function modelSummary(storePrices, sets, stores, now) {
  const st = new Map(stores.map((s) => [s.id, s]));
  const cur = storePrices.filter((r) => r.price_inr != null && st.get(r.store_id)?.display_enabled
    && now - new Date(r.scraped_at) < STALE_MS);
  const bySet = new Map();
  for (const r of cur) (bySet.get(r.set_id) ?? bySet.set(r.set_id, []).get(r.set_id)).push(r);

  const out = new Map();
  const allSets = new Set([...bySet.keys(), ...[...sets.entries()].filter(([, s]) => s.v && s.mrp != null).map(([n]) => n)]);
  for (const setId of allSets) {
    const s = sets.get(setId);
    if (!s) continue; // anchored comes from `sets`
    const rows = bySet.get(setId) ?? [];
    const anchorRow = rows.filter((r) => st.get(r.store_id).mrp_anchor_rank != null)
      .sort((a, b) => st.get(a.store_id).mrp_anchor_rank - st.get(b.store_id).mrp_anchor_rank)[0];
    let anchor = null, source = null;
    if (anchorRow) {
      const pol = st.get(anchorRow.store_id).anchor_policy;
      const ca = anchorRow.compare_at, p = anchorRow.price_inr;
      if (pol === 'compare_at_capped_by_catalogue' && ca != null && ca > p && s.v && s.mrp != null && ca > s.mrp) { anchor = s.mrp; source = 'catalogue'; }
      else if (ca != null && ca > p) { anchor = ca; source = anchorRow.store_id; }
      else { anchor = p; source = anchorRow.store_id; }
    } else if (s.v && s.mrp != null) { anchor = s.mrp; source = 'catalogue'; }
    const live = rows.filter((r) => r.in_stock);
    const best = live.length ? Math.min(...live.map((r) => r.price_inr)) : null;
    const bestStores = best == null ? null : [...new Set(live.filter((r) => r.price_inr === best).map((r) => r.store_id))].sort();
    if (anchor == null && best == null) continue;
    const discount = anchor > 0 && best != null ? Math.round((1 - best / anchor) * 1000) / 10 : null;
    const tier = anchor > 0 && best != null ? (best <= anchor * 0.8 ? 'hot' : best <= anchor * 0.9 ? 'deal' : null) : null;
    out.set(setId, { set_id: setId, anchor_mrp_inr: anchor, anchor_source: source, best_price_inr: best, best_store_ids: bestStores, in_stock_store_count: new Set(live.map((r) => r.store_id)).size, discount_pct: discount, deal_tier: tier });
  }
  return out;
}

export function summaryCounts(model) {
  let hot = 0, deal = 0, tie = 0, rows = 0;
  for (const r of model.values()) {
    rows++;
    if (r.deal_tier === 'hot') hot++;
    if (r.deal_tier === 'deal') deal++;
    if (r.best_store_ids && r.best_store_ids.length > 1) tie++;
  }
  return { rows, hot, deal, deals: hot + deal, tie };
}
