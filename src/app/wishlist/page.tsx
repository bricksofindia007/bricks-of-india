import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/metadata';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { GuestWishlist } from '@/components/wishlist/GuestWishlist';
import { SHARE_TEXT } from '@/lib/share';

// Guest wishlist view (order 1560). Behind guestWishlistPage (off: not found). The list comes from this browser only,
// so the page itself reads no cookies, no headers and no data. Never indexed: the list is private to the visitor.
export const metadata: Metadata = buildMetadata({
  title: SHARE_TEXT.guestWishlistHeading,
  description: SHARE_TEXT.guestWishlistDescription,
  path: '/wishlist',
  robots: { index: false, follow: false },
});

export default function GuestWishlistPage() {
  if (!FEATURE_FLAGS.guestWishlistPage) notFound();
  return <GuestWishlist />;
}
