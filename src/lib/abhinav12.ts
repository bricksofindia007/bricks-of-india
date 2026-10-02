// ABHINAV12 (Abhinav, 2 Oct 2026): the code does NOT apply to already-discounted
// Toycra items. A "with ABHINAV12" price is shown only for a full-price Toycra
// listing: no compare-at (struck-through) price above the listed price, and an
// order of at least ₹500. Everything else gets no code price.
export const ABHINAV12_RATE = 0.12;
export const ABHINAV12_MIN_ORDER = 500;

export interface CodePriceInput {
  store_id: string;
  price_inr: number | null;
  compare_at_price_inr?: number | null;
}

/** True when the Toycra listing is at full price (no compare-at discount). */
export function isFullPrice(row: Pick<CodePriceInput, 'price_inr' | 'compare_at_price_inr'>): boolean {
  if (row.price_inr == null) return false;
  return row.compare_at_price_inr == null || row.compare_at_price_inr <= row.price_inr;
}

/** Price after ABHINAV12, or null when the code doesn't apply. */
export function abhinav12Price(row: CodePriceInput): number | null {
  if (row.store_id !== 'toycra' || row.price_inr == null) return null;
  if (row.price_inr < ABHINAV12_MIN_ORDER || !isFullPrice(row)) return null;
  return Math.round(row.price_inr * (1 - ABHINAV12_RATE));
}
