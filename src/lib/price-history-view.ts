// Price history view (H5, flag priceHistoryChart, off). Pure: no network, no browser, no storage.
// price_history is change-only: a row means "from this time until the next row" for one set and one store.
// The last row is the last CHANGE, not the last time a price was seen. So freshness comes from the current
// store_prices row for each store (its price, stock state and scraped_at), not from the history rows.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WINDOW_DAYS = 90;
/** A scrape or a price older than 48 hours is never shown as current (the site rule). */
export const STALE_MS = 48 * 60 * 60 * 1000;

export type HistoryRow = {
  store_id: string;
  price_inr: number | null;
  in_stock: boolean | null; // null = stock state unknown for that row
  recorded_at: string;      // ISO timestamp
};

export type CurrentPrice = {
  store_id: string;
  price_inr: number | null;
  in_stock: boolean | null;
  scraped_at: string;       // ISO timestamp of the current store_prices row
};

export type Segment = {
  from: number;             // epoch ms, inside the window
  to: number;               // epoch ms, inside the window
  price: number;
  inStock: boolean | null;  // null = unknown
};

export type StoreHistory = {
  store_id: string;
  segments: Segment[];      // priced segments within the window, oldest first
  firstRecordedAt: number;  // epoch ms of this store's earliest row (any price)
  coverage90: boolean;      // the stored history reaches back to the window start
  spanFrom: number;         // epoch ms where the drawn span begins (window start, or the first row)
  lowest90: boolean;        // the marker (see the rules below)
  trailingToNow: boolean;   // the line runs to now (current row fresh and matching); otherwise it stops earlier
};

const t = (iso: string) => Date.parse(iso);

/**
 * The per-store view for one set.
 *
 * Line: the step series from the baseline row (latest row at or before the window start) and the change rows after it.
 *   - Current row fresh (within 48 hours) AND its price equals the last change row's price: the line runs to now.
 *   - Current row older than 48 hours: the line stops at its scraped_at (no claim after that).
 *   - Current row fresh but its price differs, or no current row: the line stops at the last change row.
 *
 * Marker (lowest in 90 days), per store, only when ALL hold:
 *   - the stored history covers the full window (first row at or before the window start);
 *   - the current row is fresh, matches the last change row, and is in stock;
 *   - the window has no unknown stock state (a null segment blocks the marker);
 *   - the current price is no higher than any in-stock segment in the window.
 * An out-of-stock segment (false) neither counts toward the minimum nor blocks the marker.
 */
export function buildStoreHistories(
  rows: HistoryRow[],
  currents: CurrentPrice[],
  nowMs: number,
  windowDays = WINDOW_DAYS,
): StoreHistory[] {
  const start = nowMs - windowDays * DAY_MS;
  const currentBy = new Map<string, CurrentPrice>();
  for (const c of currents) currentBy.set(c.store_id, c);

  const byStore = new Map<string, HistoryRow[]>();
  for (const r of rows) {
    const list = byStore.get(r.store_id) ?? [];
    list.push(r);
    byStore.set(r.store_id, list);
  }

  const out: StoreHistory[] = [];
  for (const [store_id, list] of byStore) {
    const all = list
      .filter((r) => Number.isFinite(t(r.recorded_at)))
      .sort((a, b) => t(a.recorded_at) - t(b.recorded_at));
    const priced = all.filter((r) => r.price_inr != null);
    if (priced.length === 0) continue;

    const firstRecordedAt = t(all[0].recorded_at);
    const coverage90 = firstRecordedAt <= start;
    const lastChange = priced[priced.length - 1];
    const lastChangeAt = t(lastChange.recorded_at);

    // Points: the baseline (latest row at or before the start) and the change rows inside the window.
    let baseline: HistoryRow | null = null;
    const inside: HistoryRow[] = [];
    for (const r of priced) {
      const at = t(r.recorded_at);
      if (at <= start) baseline = r;
      else if (at <= nowMs) inside.push(r);
    }
    const points: { at: number; price: number; inStock: boolean | null }[] = [];
    if (baseline) points.push({ at: start, price: baseline.price_inr as number, inStock: baseline.in_stock });
    for (const r of inside) points.push({ at: t(r.recorded_at), price: r.price_inr as number, inStock: r.in_stock });

    // The current row decides how far the line may run.
    const cur = currentBy.get(store_id);
    const curPrice = cur && cur.price_inr != null ? cur.price_inr : null;
    const curAt = cur && Number.isFinite(t(cur.scraped_at)) ? t(cur.scraped_at) : null;
    const fresh = curAt !== null && nowMs - curAt <= STALE_MS;
    const matches = curPrice !== null && curPrice === (lastChange.price_inr as number);

    let trailingEnd: number;
    let trailingToNow = false;
    if (curAt !== null && !fresh) {
      trailingEnd = Math.max(lastChangeAt, Math.min(curAt, nowMs));
    } else if (fresh && matches) {
      trailingEnd = nowMs;
      trailingToNow = true;
    } else {
      trailingEnd = lastChangeAt; // no claim after the last change
    }

    const segments: Segment[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const to = i + 1 < points.length ? points[i + 1].at : trailingEnd;
      if (to > p.at) segments.push({ from: p.at, to, price: p.price, inStock: p.inStock });
    }

    // Marker.
    let lowest90 = false;
    if (coverage90 && fresh && matches && cur && cur.in_stock === true && segments.length > 0 && segments[0].from === start) {
      const current = curPrice as number;
      const noUnknown = segments.every((s) => s.inStock !== null);
      const inStockSegs = segments.filter((s) => s.inStock === true);
      lowest90 = noUnknown && inStockSegs.length > 0 && inStockSegs.every((s) => s.price >= current);
    }

    out.push({
      store_id,
      segments,
      firstRecordedAt,
      coverage90,
      spanFrom: coverage90 ? start : firstRecordedAt,
      lowest90,
      trailingToNow,
    });
  }
  return out.sort((a, b) => a.store_id.localeCompare(b.store_id));
}

/** A date as "18 Oct 2026". Built from the parts, so it does not depend on the locale (Netlify ICU). */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dateLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
