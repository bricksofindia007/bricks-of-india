// Daily volume rule for the price read functions (owner decision, 17 Oct 2026).
// Alert when any price function's calls today exceed 3x its 7-day median, and
// today's count is at least the floor. Pure: the caller supplies the counts.

export const MULTIPLE = 3;
export const FLOOR_CALLS = 2000;
export const BASELINE_DAYS = 7;

export const PRICE_FUNCTIONS = [
  'get_set_prices',
  'get_prices_for_sets',
  'get_price_history',
  'get_best_prices_for_sets',
  'get_price_summaries',
  'get_price_summary_for_set',
];

function median(values) {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/**
 * counts: { [fnName]: { today: number, prior: number[] } }
 * prior: the daily call counts for the previous days (up to BASELINE_DAYS, oldest first).
 * Returns the functions over the rule. A function with no baseline days is not judged.
 */
export function evaluatePriceVolume(counts) {
  const breaches = [];
  for (const fn of Object.keys(counts)) {
    const { today, prior } = counts[fn];
    const base = (prior ?? []).slice(-BASELINE_DAYS).filter((n) => Number.isFinite(n));
    if (base.length === 0 || !Number.isFinite(today)) continue;
    const med = median(base);
    const limit = MULTIPLE * med;
    if (today >= FLOOR_CALLS && today > limit) {
      breaches.push({ fn, today, median: med, limit });
    }
  }
  return breaches;
}

/** One plain-text body for the existing alert path. Names and counts only. */
export function formatVolumeAlert(breaches) {
  const lines = breaches.map((b) =>
    `${b.fn}: ${b.today} calls today (7-day median ${Math.round(b.median)}, alert above ${Math.round(b.limit)}).`);
  return ['Price function call volume is above its usual level.', '', ...lines,
    '', 'Source: the capacity job call counts. Check the price read callers before the next release window.'].join('\n');
}
