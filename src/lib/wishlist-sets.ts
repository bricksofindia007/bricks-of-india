// Catalogue lookup and price rule for the wishlist pages (decision 21c and the guest view).
// Server only. Reads through the service-role client that the set pages use, with the same revalidate, and prices only
// through getPriceSummaries() (G3). A price is returned only inside the 26-hour freshness window, checked again here.
// Failure behaviour (G14): a failed set read returns no sets; a failed price read returns sets with no price. Never a stale price.
import { createServerClient } from '@/lib/supabase';
import { PRICE_READ_REVALIDATE_SECONDS, isPriceFresh } from '@/lib/price-freshness';
import { getPriceSummaries } from '@/lib/price-summary';
import { parseWishlistSegment } from '@/lib/wishlist-share';

export type WishlistSet = { set_number: string; name: string; image_url: string | null; price: number | null };

/** The catalogue rows for the given set numbers, in the order given. Unknown numbers are dropped. */
export async function loadWishlistSets(setNumbers: readonly string[]): Promise<WishlistSet[]> {
  const wanted = parseWishlistSegment(setNumbers.join(','));
  if (wanted.length === 0) return [];
  const supabase = createServerClient({ revalidate: PRICE_READ_REVALIDATE_SECONDS });
  const byNumber = new Map<string, { set_number: string; name: string; image_url: string | null }>();
  for (let i = 0; i < wanted.length; i += 150) {
    const { data, error } = await supabase
      .from('sets')
      .select('set_number, name, image_url')
      .in('set_number', wanted.slice(i, i + 150));
    if (error) return [];
    for (const row of data ?? []) byNumber.set(row.set_number, row);
  }
  const found = wanted.filter((n) => byNumber.has(n)).map((n) => byNumber.get(n)!);
  if (found.length === 0) return [];
  const summaries = await getPriceSummaries(supabase, found.map((s) => s.set_number));
  return found.map((s) => {
    const summary = summaries.get(s.set_number);
    const price = summary && summary.best_price_inr != null && isPriceFresh(summary.best_scraped_at)
      ? summary.best_price_inr
      : null;
    return { set_number: s.set_number, name: s.name, image_url: s.image_url, price };
  });
}
