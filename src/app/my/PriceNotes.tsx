import { VOICE } from '@/lib/my-collection';
import { WISHLIST_NO_PRICE_LINE, formatRs } from '@/lib/collection-worth';

// Presentational pieces of the My Collection page. They take their state as props so the rendered text can be
// tested on the server (the page itself only knows its price state after the browser runs).

/** Shown when the price read fails. The names and pieces stay on the page. */
export function PricesUnavailable() {
  return <p role="alert" className="text-sm text-gray-600 mb-4">{VOICE.pricesUnavailable}</p>;
}

/** The page's total worth figure. Any estimate in it is labelled, so no rupee figure is shown without its source. */
export function TotalWorthValue({ loading, inr, estimates }: { loading: boolean; inr: number; estimates: number }) {
  if (loading) return <>…</>;
  if (inr <= 0) return <>—</>;
  return (
    <>
      ₹{formatRs(inr)}
      {estimates > 0 && <span className="block text-xs font-normal text-gray-600">includes estimates from US prices</span>}
    </>
  );
}

/**
 * The worth line under a row. Once the price read has succeeded, a set with no verified Indian price (rule
 * "unknown") says so. While the read is pending or failed, the row shows the neutral line, never the no-price claim.
 */
export function OwnedWorthLine({ priceReady, rule, line }: { priceReady: boolean; rule: string; line: string }) {
  return <p className="mt-1">{priceReady && rule === 'unknown' ? WISHLIST_NO_PRICE_LINE : line}</p>;
}
