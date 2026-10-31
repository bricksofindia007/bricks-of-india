// Visitor-facing strings for the price history chart (H5, flag priceHistoryChart, off).
// NOT APPROVED. Every string here is a placeholder until Abhinav approves it (logs/evidence/2026-10-28/t2-h5-new-strings.md).
// Change a string here only with the owner's written words.

export const PRICE_HISTORY_STRINGS = {
  heading: 'Price history',                    // placeholder, S1
  lowestMarker: 'Lowest in 90 days',           // placeholder, S2 (shown only with full 90-day coverage)
  sinceLabel: 'Since {date}',                  // placeholder, S3 (shown when a store's history starts after 90 days ago)
  rangeLabel: 'Shown: {from} to {to}',         // placeholder, S5 (the span the stored history covers)
} as const;

/** Fills a placeholder. Only {name} tokens; no locale formatting. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '');
}
