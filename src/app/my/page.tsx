import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildMetadata } from '@/lib/metadata';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { MyCollection } from './MyCollection';

// My Collection: the visitor's wishlist and collection, saved in their browser. The page is the same
// for everyone; the lists and their prices load in the browser. Not indexed, not in the sitemap.
export const metadata: Metadata = buildMetadata({
  title: 'My Collection',
  description: 'Your LEGO wishlist and collection, saved on this device.',
  path: '/my',
  robots: { index: false, follow: false },
});

export default function MyPage() {
  if (!FEATURE_FLAGS.myCollectionPage) notFound();
  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-heading text-dark text-4xl mb-2">My Collection</h1>
      <p className="text-sm text-gray-500 mb-6">Saved on this device only. Clearing your browser data clears these lists.</p>
      <MyCollection />
    </main>
  );
}
