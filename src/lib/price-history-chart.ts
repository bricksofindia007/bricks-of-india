// Price history chart data: the cheapest in-stock price over time, built from existing price_history rows.
// Rows are change-only per store, so each store's last known state is carried forward between its rows.
// Pure functions: no network, no database. A value that can't be read is left out, never guessed.

export type HistoryRow = {
  store_id: string;
  price_inr: number | null;
  in_stock: boolean | null;
  recorded_at: string;
};

export type ChartPoint = { t: number; price: number };

export type ChartGeometry = {
  d: string;
  min: number;
  max: number;
  start: number;
  end: number;
  points: ChartPoint[];
};

/** Step series of the cheapest in-stock price across stores, one point per change, oldest first. */
export function cheapestInStockSeries(rows: HistoryRow[]): ChartPoint[] {
  const valid = rows
    .filter((r) => Number.isFinite(r.price_inr) && Number.isFinite(Date.parse(r.recorded_at)))
    .map((r) => ({ store: r.store_id, price: Number(r.price_inr), inStock: r.in_stock === true, t: Date.parse(r.recorded_at) }))
    .sort((a, b) => a.t - b.t);

  const lastByStore = new Map<string, { price: number; inStock: boolean }>();
  const out: ChartPoint[] = [];
  let i = 0;
  while (i < valid.length) {
    const t = valid[i].t;
    while (i < valid.length && valid[i].t === t) {
      lastByStore.set(valid[i].store, { price: valid[i].price, inStock: valid[i].inStock });
      i += 1;
    }
    let cheapest: number | null = null;
    for (const v of lastByStore.values()) {
      if (v.inStock && (cheapest === null || v.price < cheapest)) cheapest = v.price;
    }
    if (cheapest === null) continue;
    const prev = out[out.length - 1];
    if (!prev || prev.price !== cheapest) out.push({ t, price: cheapest });
  }
  return out;
}

/** SVG path for a step line inside width x height, with padding. Null when there is too little to draw. */
export function stepChartGeometry(points: ChartPoint[], width = 600, height = 160, pad = 8): ChartGeometry | null {
  if (points.length < 2) return null;
  const start = points[0].t;
  const end = points[points.length - 1].t;
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const xSpan = Math.max(end - start, 1);
  const ySpan = Math.max(max - min, 1);
  const x = (t: number) => pad + ((t - start) / xSpan) * (width - 2 * pad);
  const y = (p: number) => pad + (1 - (p - min) / ySpan) * (height - 2 * pad);

  let d = `M ${x(points[0].t).toFixed(1)} ${y(points[0].price).toFixed(1)}`;
  for (let k = 1; k < points.length; k += 1) {
    const prevY = y(points[k - 1].price).toFixed(1);
    d += ` L ${x(points[k].t).toFixed(1)} ${prevY} L ${x(points[k].t).toFixed(1)} ${y(points[k].price).toFixed(1)}`;
  }
  d += ` L ${x(end).toFixed(1)} ${y(points[points.length - 1].price).toFixed(1)}`;
  return { d, min, max, start, end, points };
}

type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

/** Rows for one set through the existing read function. Throws on an error result, so a failed read is never cached. */
export async function fetchPriceHistoryRows(client: RpcClient, setNumber: string): Promise<HistoryRow[]> {
  const { data, error } = await client.rpc('get_price_history', { p_set_number: setNumber, p_limit: 200 });
  if (error) throw new Error('price history read failed');
  return Array.isArray(data) ? (data as HistoryRow[]) : [];
}

/**
 * Loads the chart points for one set. Any failure (error result or exception) returns null: the page renders without
 * the chart. Logs a fixed message only, never values.
 */
export async function loadPriceHistoryPoints(client: RpcClient, setNumber: string): Promise<ChartPoint[] | null> {
  try {
    const points = cheapestInStockSeries(await fetchPriceHistoryRows(client, setNumber));
    return points.length >= 2 ? points : null;
  } catch {
    console.error('[price-history] read failed; chart omitted');
    return null;
  }
}
