// "Price N days ago" from price_history (#383, 27 Sep 2026).
//
// Since FP5.7 (migration 20260927135145) price_history is change-only: a
// row means "from this time until the next row". run_retention() also
// compacts rows older than 30 days down to change points. So the price at
// the window start is the LATEST row at or before it -- not the oldest row
// inside the window, which is the first CHANGE in the window (for a set
// that dropped 10 days ago, that is the new, already-dropped price).
// Fallback only when a listing has no row before the window at all (first
// observed inside it): its oldest in-window row.

export type HistRow = { set_id: string; store_id: string; price_inr: number | null; recorded_at: string };

/**
 * @param preWindowDesc rows with recorded_at <= since, newest first
 * @param inWindowAsc   rows with recorded_at >  since, oldest first
 * @returns baseline price per `${set_id}:${store_id}`
 */
export function baselinePrices(preWindowDesc: HistRow[], inWindowAsc: HistRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of preWindowDesc) {
    const k = `${r.set_id}:${r.store_id}`;
    if (r.price_inr != null && !out.has(k)) out.set(k, r.price_inr);
  }
  for (const r of inWindowAsc) {
    const k = `${r.set_id}:${r.store_id}`;
    if (r.price_inr != null && !out.has(k)) out.set(k, r.price_inr);
  }
  return out;
}
