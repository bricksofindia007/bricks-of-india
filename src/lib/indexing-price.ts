// E6 indexing rule (draft, not shipped): a set is indexable only if it has a store price above zero.
// Sets without one are noindex, follow and leave the sitemap. Pure: no database access here.

/** True when at least one store price is above zero. */
export function hasIndianPrice(prices: ReadonlyArray<number | null | undefined>): boolean {
  return prices.some((p) => typeof p === 'number' && Number.isFinite(p) && p > 0);
}
