import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/metadata';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { SHARE_TEXT, shareEnabled } from '@/lib/share';
import { WISHLIST_PATH, parseWishlistSegment, setCountLabel, setPagePath } from '@/lib/wishlist-share';
import { loadWishlistSets } from '@/lib/wishlist-sets';
import { formatPrice } from '@/lib/utils';

// Decision 21c (order 1520). A shared guest wishlist: the set numbers are in the address, nothing is stored.
// Cache: one hour per distinct list (a literal, as segment config requires). The page reads no cookies and no headers (G1).
// Request cost (G2), per cache fill of one list of N valid numbers: 1 query for the sets (chunks of 150) plus
// ceil(N / 150) price-summary queries (G3). At most 500 numbers: 8 queries.
// Failure behaviour (G14): with the flag off, or no valid number, or no catalogue match, the page is not found.
// If the price read fails, the list still shows with no price for each set. No stale or guessed price is ever shown.
export const revalidate = 3600;

type Params = { sets: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { sets } = await params;
  // Shared lists are never indexed: the page carries noindex, and its canonical is its own address.
  return buildMetadata({
    title: SHARE_TEXT.wishlistMetaTitle,
    description: SHARE_TEXT.previewCaption,
    path: `${WISHLIST_PATH}/${sets}`,
    robots: { index: false, follow: true },
  });
}

export default async function SharedWishlistPage({ params }: { params: Promise<Params> }) {
  if (!shareEnabled(FEATURE_FLAGS)) notFound();
  const { sets } = await params;
  const wanted = parseWishlistSegment(sets);
  if (wanted.length === 0) notFound();

  const found = await loadWishlistSets(wanted);
  if (found.length === 0) notFound();

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-primary-dark py-12 px-4">
        <div className="max-w-site mx-auto">
          <h1 className="font-heading text-white text-5xl mb-2">{SHARE_TEXT.wishlistHeading}</h1>
          <p className="text-white/70 font-body text-lg">{setCountLabel(found.length)}</p>
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-10">
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {found.map((s) => {
            const href = setPagePath(s.set_number, s.name);
            return (
              <li key={s.set_number} className="rounded-xl border border-neutral-200 p-4">
                <Link href={href} className="block">
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
                </Link>
                <p className="text-sm text-neutral-600">
                  {s.price != null ? formatPrice(s.price) : <Link href={href} className="underline">{SHARE_TEXT.wishlistNoPrice}</Link>}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="mt-10">
          <Link href="/sets" className="inline-block rounded-full bg-primary-dark px-6 py-3 font-semibold text-white">
            {SHARE_TEXT.wishlistStart}
          </Link>
        </div>
      </div>
    </div>
  );
}
