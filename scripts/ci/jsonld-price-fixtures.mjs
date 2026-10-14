// #220: synthetic /sets/ pages for the CI JSON-LD price check. Served by
// supabase-stub.mjs as public.set_page_data payloads; timestamps are computed
// per request so "fresh" stays fresh however long the CI job runs.
//
//   99001 -- the /sets/71043 case: a CHEAPER out-of-stock store plus one
//            in-stock store. lowPrice must be the in-stock price.
//   99002 -- two fresh in-stock stores. lowPrice = the cheaper one.
//   99003 -- nothing buyable (one sold out, one in stock but 30h old):
//            no lowPrice and no displayed best price.
//   99004 -- no store rows at all (an unpriced set; P10 revalidate audit:
//            the page must take the 72 h unpriced clock).
const hAgo = (h) => new Date(Date.now() - h * 3_600_000).toISOString();

export const FIXTURES = {
  '99001': { expectLow: 50399, rows: [
    { store_id: 'toycra', price_inr: 37799, in_stock: false, age: 1 },
    { store_id: 'mybrickhouse', price_inr: 50399, in_stock: true, age: 1 },
  ] },
  '99002': { expectLow: 4199, rows: [
    { store_id: 'toycra', price_inr: 4199, in_stock: true, age: 2 },
    { store_id: 'mybrickhouse', price_inr: 4499, in_stock: true, age: 3 },
  ] },
  '99003': { expectLow: null, rows: [
    { store_id: 'toycra', price_inr: 999, in_stock: false, age: 1 },
    { store_id: 'mybrickhouse', price_inr: 1299, in_stock: true, age: 30 },
  ] },
  '99004': { expectLow: null, rows: [] },
};

// The set page reads its offers separately on the 6 h clock (P10): the stub
// serves the same fixture rows for GET /rest/v1/store_prices and
// /rest/v1/set_price_summary filtered to a fixture set.
export function fixtureStorePrices(setNumber) {
  const d = setPageData(setNumber);
  return d ? d.store_prices : null;
}
export function fixtureSummary(setNumber) {
  const d = setPageData(setNumber);
  return d ? d.summary : null;
}

export function setPageData(setNumber) {
  const f = FIXTURES[setNumber];
  if (!f) return null;
  const store_prices = f.rows.map((r) => ({
    set_id: setNumber, store_id: r.store_id, price_inr: r.price_inr, in_stock: r.in_stock,
    product_url: `https://example.invalid/${r.store_id}/${setNumber}`, scraped_at: hAgo(r.age),
  }));
  // Mirrors public.set_price_summary: best = fresh (<= 12h) in-stock rows.
  const buyable = store_prices.filter((r, i) => r.in_stock && f.rows[i].age <= 12);
  const best = buyable.length ? Math.min(...buyable.map((r) => r.price_inr)) : null;
  const bestRows = buyable.filter((r) => r.price_inr === best);
  return {
    set: {
      id: `${setNumber}-1`, set_number: setNumber, rebrickable_id: `${setNumber}-1`,
      name: `CI Fixture Set ${setNumber}`, year: 2026, theme: 'Icons', subtheme: null,
      pieces: 1000, minifigs: null, image_url: null, description: null, age_range: '18+',
      lego_mrp_inr: 59999, mrp_verified: true, index_tier: 'tier3', noindex_override: true,
      created_at: '', updated_at: '', reviews: [],
    },
    store_prices,
    related: [],
    related_prices: [],
    coverage: { news: [], guides: [], reviews: [] },
    summary: {
      set_id: setNumber, anchor_mrp_inr: 59999, anchor_source: 'catalogue',
      best_price_inr: best,
      best_store_ids: best == null ? null : bestRows.map((r) => r.store_id).sort(),
      best_scraped_at: best == null ? null : bestRows[0].scraped_at,
      in_stock_store_count: buyable.length,
      discount_pct: best == null ? null : Math.round((1 - best / 59999) * 1000) / 10,
      deal_tier: null,
    },
    related_summaries: [],
  };
}
