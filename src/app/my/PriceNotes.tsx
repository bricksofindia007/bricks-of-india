import { VOICE } from '@/lib/my-collection';
import { WISHLIST_NO_PRICE_LINE, formatRs } from '@/lib/collection-worth';

// Presentational pieces of the My Collection page. They take their state as props so the rendered text can be
// tested on the server (the page itself only knows its price state after the browser runs).

/** Shown when the price read fails. The names and pieces stay on the page. */
export function PricesUnavailable() {
  return <p role="alert" className="text-sm text-gray-600 mb-4">{VOICE.pricesUnavailable}</p>;
}

/**
 * The price line on a wishlist row. The store names come from the store list. If a store's name can't be read, the row
 * shows the neutral line instead: a store ID is never shown.
 */
export function WishPrice({
  priceReady,
  price,
  storeIds,
  storeNames,
}: {
  priceReady: boolean;
  price: number | null;
  storeIds: string[] | null;
  storeNames: Record<string, string>;
}) {
  if (!priceReady) return null;
  if (price == null) return <p className="mt-1 text-gray-500">{WISHLIST_NO_PRICE_LINE}</p>;
  const ids = storeIds ?? [];
  if (ids.some((id) => !storeNames[id])) return <p className="mt-1 text-gray-500">{VOICE.pricesUnavailable}</p>;
  return (
    <p className="mt-1">
      <span className="font-price font-bold text-deal-green">₹{formatRs(price)}</span>
      {ids.length ? <> at {ids.map((id) => storeNames[id]).join(', ')}</> : null}
    </p>
  );
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
 * The worth line under an owned row. It is the rule's own line: an estimate, the retired line, or "Worth not known yet"
 * (rule 4). The no-price line is for wishlist rows only.
 */
export function OwnedWorthLine({ line }: { line: string }) {
  return <p className="mt-1">{line}</p>;
}
