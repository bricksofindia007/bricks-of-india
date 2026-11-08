'use client';

// Guest wishlist view (order 1560, behind guestWishlistPage). Shows the sets this visitor hearted, from this browser only.
// Names and pictures come from the browser. Only the set numbers are sent, to get today's prices. No account, no cookies,
// nothing stored on our side. Prices are shown one set at a time, with no sum and no price time. The collection tab is
// not shown to guests (it needs sign-up).
// Failure behaviour: if the price read fails, the list still shows, with no prices. Never a stale or guessed price.

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShareControl } from '@/components/share/ShareControl';
import { CHANGED_EVENT, VOICE, loadWishlist, type WishItem } from '@/lib/my-collection';
import { SHARE_TEXT } from '@/lib/share';
import { formatPrice } from '@/lib/utils';
import { setPagePath, wishlistSharePath } from '@/lib/wishlist-share';

const PLACEHOLDER = '/images/lego-placeholder.svg';

export function GuestWishlist() {
  const [wish, setWish] = useState<WishItem[]>([]);
  const [ready, setReady] = useState(false);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [pricesReady, setPricesReady] = useState(false);

  useEffect(() => {
    const load = () => setWish(loadWishlist());
    load();
    setReady(true);
    window.addEventListener(CHANGED_EVENT, load);
    return () => window.removeEventListener(CHANGED_EVENT, load);
  }, []);

  const numbers = wish.map((w) => w.set);
  const key = numbers.join(',');

  useEffect(() => {
    if (!ready) return;
    if (numbers.length === 0) { setPricesReady(true); return; }
    let live = true;
    setPricesReady(false);
    fetch(`/api/guest-wishlist?sets=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? r.json() : { prices: {} }))
      .then((data: { prices?: Record<string, number> }) => { if (live) setPrices(data.prices ?? {}); })
      .catch(() => { if (live) setPrices({}); })
      .finally(() => { if (live) setPricesReady(true); });
    return () => { live = false; };
    // The key is the list of set numbers; the list object itself changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);

  if (!ready) return null;
  const sharePath = wishlistSharePath(numbers);

  return (
    <section className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-heading text-dark text-4xl mb-2">My Wishlist</h1>
      <p className="text-sm text-gray-500 mb-6">Saved on this device only. Clearing your browser data clears this list.</p>

      {wish.length === 0 ? (
        <p>{VOICE.wishlistEmpty}</p>
      ) : (
        <>
          <p className="mb-4">{wish.length === 1 ? '1 set' : `${wish.length} sets`}</p>
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {wish.map((w) => {
              const href = setPagePath(w.set, w.name);
              return (
                <li key={w.set} className="rounded-xl border border-neutral-200 p-4">
                  <Link href={href} className="block">
                    <div className="relative aspect-square w-full">
                      <Image
                        src={w.image_url || PLACEHOLDER}
                        alt={w.name}
                        fill
                        sizes="(min-width: 768px) 25vw, 50vw"
                        unoptimized
                        className="object-contain"
                      />
                    </div>
                    <p className="mt-3 font-semibold">{w.name}</p>
                  </Link>
                  <p className="text-sm text-neutral-600">
                    {!pricesReady ? null : prices[w.set] != null ? formatPrice(prices[w.set]) : (
                      <Link href={href} className="underline">{SHARE_TEXT.wishlistNoPrice}</Link>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
          {sharePath && (
            <ShareControl target={{ id: 'guest-wishlist', title: SHARE_TEXT.wishlistMetaTitle, path: sharePath, pageType: 'sets_list' }} />
          )}
        </>
      )}
    </section>
  );
}
