// Price history view (H5, flag priceHistoryChart, off). Pure: no network, no browser, no storage.
// price_history is change-only: a row means "from this time until the next row" for one set and one store.
// The price in effect at any moment is the latest row at or before it.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WINDOW_DAYS = 90;
/** A price past 48 hours is never shown as current (the site rule). The trailing line stops here. */
export const STALE_MS = 48 * 60 * 60 * 1000;

export type HistoryRow = {
  store_id: string;
  price_inr: number | null;
  in_stock: boolean | null; // null = stock state unknown for that row
  recorded_at: string;      // ISO timestamp
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
  lowest90: boolean;        // the marker: current in-stock price is the lowest of the full window
};

const t = (iso: string) => Date.parse(iso);

/**
 * Builds the per-store view for one set. Rows may come in any order; they are sorted here.
 * Null prices are skipped. A store with no priced rows is not returned.
 */
export function buildStoreHistories(rows: HistoryRow[], nowMs: number, windowDays = WINDOW_DAYS): StoreHistory[] {
  const start = nowMs - windowDays * DAY_MS;
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

    // Points inside the window: the baseline (latest row at or before the start) and the change rows after it.
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

    const last = points[points.length - 1];
    const lastRowAt = last ? last.at : null;
    const trailingEnd = last ? Math.min(nowMs, last.at + STALE_MS) : nowMs;
    const segments: Segment[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const to = i + 1 < points.length ? points[i + 1].at : trailingEnd;
      if (to > p.at) segments.push({ from: p.at, to, price: p.price, inStock: p.inStock });
    }

    // Marker: the current price is in stock, fresh (within 48 hours), and no higher than any price in the window,
    // and every part of the window is known to be in stock with a price. Unknown stock or a gap means no marker.
    let lowest90 = false;
    if (coverage90 && last && lastRowAt !== null && nowMs - lastRowAt <= STALE_MS && last.inStock === true) {
      const current = last.price;
      const allKnownInStock = segments.length > 0 && segments.every((s) => s.inStock === true);
      const coversFullWindow = segments.length > 0 && segments[0].from === start;
      lowest90 = allKnownInStock && coversFullWindow && segments.every((s) => s.price >= current);
    }

    out.push({
      store_id,
      segments,
      firstRecordedAt,
      coverage90,
      spanFrom: coverage90 ? start : firstRecordedAt,
      lowest90,
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
