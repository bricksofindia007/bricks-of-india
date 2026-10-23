import { stepChartGeometry, type ChartPoint } from '@/lib/price-history-chart';
import { formatPrice } from '@/lib/utils';

// Server-rendered SVG step chart of the cheapest in-stock price over time. Renders nothing when there is
// too little history to draw (fewer than two changes), so the page is unchanged in that case.
export function PriceHistoryChart({ points }: { points: ChartPoint[] }) {
  const g = stepChartGeometry(points);
  if (!g) return null;
  const from = new Date(g.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const to = new Date(g.end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <section className="bg-light-grey rounded-xl p-4 mb-6" aria-labelledby="price-history-heading">
      <h2 id="price-history-heading" className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-2">
        Price history
      </h2>
      <p className="text-sm text-gray-600 mb-2">Cheapest price in stock, {from} to {to}</p>
      <svg viewBox="0 0 600 160" role="img" aria-label={`Cheapest in-stock price from ${formatPrice(g.min)} to ${formatPrice(g.max)}`} className="w-full h-40">
        <path d={g.d} fill="none" stroke="currentColor" strokeWidth={2} className="text-dark" />
      </svg>
      <p className="text-xs text-gray-500 mt-2">Lowest {formatPrice(g.min)} · Highest {formatPrice(g.max)}</p>
    </section>
  );
}
