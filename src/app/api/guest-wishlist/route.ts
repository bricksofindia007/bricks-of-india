// Guest wishlist view: today's prices for the set numbers the visitor's own browser sends (order 1560).
// Returns prices only, keyed by set number. Names and pictures come from the visitor's browser, so nothing is looked up for them.
// No cookies, no headers read, nothing written. Behind guestWishlistPage (off: 404).
// Request cost (G2): one sets query plus ceil(N/150) price-summary queries per request, at most 500 numbers, so at most 8 queries.
// Cache: s-maxage one hour, since the answer depends only on the set numbers in the query.
// Failure behaviour (G14): a failed read returns an empty price map, so the page shows no prices. Never a stale price.
import { NextResponse, type NextRequest } from 'next/server';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { loadWishlistSets } from '@/lib/wishlist-sets';

export async function GET(req: NextRequest) {
  if (!FEATURE_FLAGS.guestWishlistPage) return new NextResponse(null, { status: 404 });
  const raw = req.nextUrl.searchParams.get('sets') ?? '';
  const sets = await loadWishlistSets(raw.split(','));
  const prices: Record<string, number> = {};
  for (const s of sets) if (s.price != null) prices[s.set_number] = s.price;
  return NextResponse.json(
    { prices },
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600' } },
  );
}
