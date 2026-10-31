// Price history chart (H5, flag priceHistoryChart, off). Server-rendered inline SVG: no client JavaScript.
// Shows one step line per store over the span the stored history covers (at most 90 days). Renders nothing when
// there is no priced history. The marker and the since-label follow the rules in src/lib/price-history-view.ts.

import { buildStoreHistories, dateLabel, WINDOW_DAYS, type CurrentPrice, type HistoryRow, type StoreHistory } from '@/lib/price-history-view';
import { PRICE_HISTORY_STRINGS, fill } from '@/lib/price-history-strings';

// Indian digit grouping without a locale call (Netlify's ICU lacks en-IN). Local copy: the worth rules stay in My Collection.
function formatRs(n: number): string {
  const s = String(Math.round(n));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

const W = 640;
const H = 220;
const PAD_L = 56;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 28;
const COLOURS = ['#1f2937', '#2563eb', '#16a34a', '#d97706', '#9333ea'];

export function PriceHistoryChart({
  rows,
  currents,
  storeNames,
  nowMs,
}: {
  rows: HistoryRow[];
  currents: CurrentPrice[];
  storeNames: Record<string, string>;
  nowMs: number;
}) {
  const stores: StoreHistory[] = buildStoreHistories(rows, currents, nowMs, WINDOW_DAYS).filter((s) => s.segments.length > 0);
  if (stores.length === 0) return null;

  const from = Math.min(...stores.map((s) => s.spanFrom));
  const to = nowMs;
  const span = Math.max(1, to - from);
  const prices = stores.flatMap((s) => s.segments.map((g) => g.price));
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const range = Math.max(1, hi - lo);

  const x = (ms: number) => PAD_L + ((ms - from) / span) * (W - PAD_L - PAD_R);
  const y = (p: number) => PAD_T + (1 - (p - lo) / range) * (H - PAD_T - PAD_B);

  return (
    <section className="mb-8">
      <h2 className="font-heading text-dark text-xl mb-2">{PRICE_HISTORY_STRINGS.heading}</h2>
      <svg role="img" aria-label={PRICE_HISTORY_STRINGS.heading} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <line x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} stroke="#d1d5db" />
        <text x={PAD_L - 6} y={PAD_T + 4} textAnchor="end" fontSize="12" fill="#4b5563">{`₹${formatRs(hi)}`}</text>
        <text x={PAD_L - 6} y={H - PAD_B} textAnchor="end" fontSize="12" fill="#4b5563">{`₹${formatRs(lo)}`}</text>
        <text x={PAD_L} y={H - 8} fontSize="12" fill="#4b5563">{dateLabel(from)}</text>
        <text x={W - PAD_R} y={H - 8} textAnchor="end" fontSize="12" fill="#4b5563">{dateLabel(to)}</text>
        {stores.map((s, i) => {
          const colour = COLOURS[i % COLOURS.length];
          const d = s.segments
            .map((g, j) => `${j === 0 ? 'M' : 'L'}${x(g.from).toFixed(1)},${y(g.price).toFixed(1)} H${x(g.to).toFixed(1)}`)
            .join(' ');
          return <path key={s.store_id} d={d} fill="none" stroke={colour} strokeWidth={2} />;
        })}
      </svg>
      <ul className="mt-2 space-y-1 text-sm text-gray-700">
        {stores.map((s, i) => (
          <li key={s.store_id} className="flex flex-wrap items-center gap-2">
            <span aria-hidden="true" style={{ display: 'inline-block', width: 12, height: 12, background: COLOURS[i % COLOURS.length] }} />
            <span>{storeNames[s.store_id] ?? s.store_id}</span>
            {s.lowest90 && <span className="font-semibold">{PRICE_HISTORY_STRINGS.lowestMarker}</span>}
            {!s.coverage90 && (
              <span className="text-gray-500">{fill(PRICE_HISTORY_STRINGS.sinceLabel, { date: dateLabel(s.firstRecordedAt) })}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-gray-500">
        {fill(PRICE_HISTORY_STRINGS.rangeLabel, { from: dateLabel(from), to: dateLabel(to) })}
      </p>
    </section>
  );
}
