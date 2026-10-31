import { RETIRED_LINE, isPre2020Set } from './collection-worth';

// The Priceless line on a set page (order 0420, D-2026-10-31-04 and -05). Shown only for a set with no store price, no
// verified LEGO India list price, no US estimate, and that is retired or from before 2020. The page keeps every existing
// line; this adds approved line 3 once, under the existing text. The caller checks the switch (setPagePriceless) first.

export type PricelessInput = {
  lego_mrp_inr?: number | string | null;
  mrp_verified?: boolean | null;
  retired?: boolean | null;
  year?: number | null;
};

export function setPagePricelessLine(set: PricelessInput, hasStorePrice: boolean, hasUsEstimate: boolean): string | null {
  if (hasStorePrice || hasUsEstimate) return null;
  // Any LEGO India figure, verified or not, is a value (My Collection counts it as an estimate): the page shows no Priceless.
  if (set.lego_mrp_inr != null) return null;
  if (set.retired === true || isPre2020Set(set.year ?? null)) return RETIRED_LINE;
  return null;
}
