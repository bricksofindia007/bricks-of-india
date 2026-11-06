// E6 indexing rule (draft, not shipped): a set is indexable only if it has a store price above zero.
// Sets without one are noindex, follow and leave the sitemap. Pure: no database access here.

/** True when at least one store price is above zero. */
export function hasIndianPrice(prices: ReadonlyArray<number | null | undefined>): boolean {
  return prices.some((p) => typeof p === 'number' && Number.isFinite(p) && p > 0);
}

/**
 * Whether a set page is noindex, follow (order 0870). Live rule: tier3 and the noindex override. The unpriced rule is
 * added only while the unpriced-sets switch is on, so with the switch off the answer is the live answer.
 */
export function setRobotsNoindex(
  set: { index_tier: string; noindex_override?: boolean | null },
  priced: boolean,
  unpricedSetsHidden: boolean,
): boolean {
  return set.index_tier === 'tier3' || Boolean(set.noindex_override) || (unpricedSetsHidden && !priced);
}
