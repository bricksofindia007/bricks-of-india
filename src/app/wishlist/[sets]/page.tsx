import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/metadata';
import { createServerClient } from '@/lib/supabase';
import { PRICE_READ_REVALIDATE_SECONDS, isPriceFresh } from '@/lib/price-freshness';
import { getPriceSummaries } from '@/lib/price-summary';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { SHARE_TEXT, shareEnabled } from '@/lib/share';
import { WISHLIST_PATH, parseWishlistSegment } from '@/lib/wishlist-share';

// Decision 21c (order 1520). A shared guest wishlist: the set numbers are in the address, nothing is stored.
// Cache: one hour per distinct list (a literal, as segment config requires). The page reads no cookies and no headers (G1).
// Request cost (G2), per cache fill of one list of N valid numbers: 1 query for the sets (chunks of 150) plus
// ceil(N / 150) price-summary queries through getPriceSummaries(), the approved reader (G3). At most 500 numbers: 8 queries.
// Failure behaviour (G14): with the flag off, or no valid number, or no catalogue match, the page is not found.
// If the price read fails, the list still shows with no price for each set. No stale or guessed price is ever shown.
export const revalidate = 3600;

type Params = { sets: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { sets } = await params;
  // Shared lists are never indexed: the page carries noindex, and its canonical is its own address.
  return buildMetadata({
    title: 'A shared wish list',
    description: 'A LEGO wish list shared from Bricks of India.',
    path: `${WISHLIST_PATH}/${sets}`,
    robots: { index: false, follow: true },
  });
}

// Indian digit grouping by hand: the Netlify runtime has no en-IN locale, so locale formatting is not used.
function inr(n: number): string {
  const s = String(Math.round(n));
  if (s.length <= 3) return s;
  return `${s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${s.slice(-3)}`;
}

export default async function SharedWishlistPage({ params }: { params: Promise<Params> }) {
  if (!shareEnabled(FEATURE_FLAGS)) notFound();
  const { sets } = await params;
  const wanted = parseWishlistSegment(sets);
  if (wanted.length === 0) notFound();

  const supabase = createServerClient({ revalidate: PRICE_READ_REVALIDATE_SECONDS });
  const byNumber = new Map<string, { set_number: string; name: string; image_url: string | null }>();
  for (let i = 0; i < wanted.length; i += 150) {
    const { data, error } = await supabase
      .from('sets')
      .select('set_number, name, image_url')
      .in('set_number', wanted.slice(i, i + 150));
    if (error) break;
    for (const row of data ?? []) byNumber.set(row.set_number, row);
  }
  // Unknown numbers are ignored; the list keeps the order the visitor saved.
  const found = wanted.filter((n) => byNumber.has(n)).map((n) => byNumber.get(n)!);
  if (found.length === 0) notFound();

  const summaries = await getPriceSummaries(supabase, found.map((s) => s.set_number));

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-primary-dark py-12 px-4">
        <div className="max-w-site mx-auto">
          <h1 className="font-heading text-white text-5xl mb-2">{SHARE_TEXT.collectionShared}</h1>
          <p className="text-white/70 font-body text-lg">{found.length === 1 ? '1 set' : `${found.length} sets`}</p>
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-10">
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {found.map((s) => {
            const summary = summaries.get(s.set_number);
            // Shown only inside the 26-hour window the reader already applies, and checked again here (48-hour rule).
            const price = summary && summary.best_price_inr != null && isPriceFresh(summary.best_scraped_at)
              ? summary.best_price_inr
              : null;
            return (
              <li key={s.set_number} className="rounded-xl border border-neutral-200 p-4">
                <div className="relative aspect-square w-full">
                  <Image
                    src={s.image_url || '/images/lego-placeholder.svg'}
                    alt={s.name}
                    fill
                    sizes="(min-width: 768px) 25vw, 50vw"
                    unoptimized
                    className="object-contain"
                  />
                </div>
                <p className="mt-3 font-semibold">{s.name}</p>
                <p className="text-sm text-neutral-600">
                  {price != null ? `₹${inr(price)}` : 'Price not shown right now'}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="mt-10">
          <Link href="/" className="inline-block rounded-full bg-primary-dark px-6 py-3 font-semibold text-white">
            Open Bricks of India
          </Link>
        </div>
      </div>
    </div>
  );
}
