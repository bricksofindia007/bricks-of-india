import { worthOf, usableRate, formatRs, ESTIMATE_NOTE, type StoredRate } from './collection-worth';

// The set page's estimate (order 0380 item 4, D-2026-10-30-10). Shown only when the set has no store price, no LEGO India
// list price, is not retired, and has a US price with a usable rate. It reuses the My Collection rule (worthOf), so the
// two pages agree. The caller checks the switch (setPageUsEstimate) first. Returns null otherwise.

export type SetPageEstimateInput = {
  set_number: string;
  us_price_usd?: number | string | null;
  lego_mrp_inr?: number | string | null;
  retired?: boolean | null;
  year?: number | null;
};

export type SetPageEstimate = { text: string; note: string };

export function setPageEstimate(set: SetPageEstimateInput, hasStorePrice: boolean, rate: StoredRate | null, now = new Date()): SetPageEstimate | null {
  if (hasStorePrice) return null;
  const usable = usableRate(rate, now);
  if (!usable) return null;
  const w = worthOf(
    {
      set: set.set_number,
      indianPriceInr: null,
      usPriceUsd: set.us_price_usd == null ? null : Number(set.us_price_usd),
      qty: 1,
      listPriceInr: set.lego_mrp_inr == null ? null : Number(set.lego_mrp_inr),
      year: set.year ?? null,
    },
    usable,
    set.retired == null ? null : set.retired,
    null,
  );
  if (w.rule !== 'estimate' || w.inr == null || !w.note) return null;
  return { text: `About ₹${formatRs(w.inr)}`, note: ESTIMATE_NOTE };
}
