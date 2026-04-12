import Image from 'next/image';
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { ReviewCard } from '@/components/content/ArticleCard';
import { MASCOTS } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'LEGO Reviews India — Honest Verdicts | Bricks of India',
  description: 'Honest, opinionated LEGO set reviews for Indian buyers. We tell you exactly what to buy and what to skip. No corporate speak. No fence-sitting.',
  alternates: { canonical: 'https://bricksofindia.com/reviews' },
};

export default async function ReviewsPage() {
  const { data: reviews } = await supabase
    .from('reviews')
    .select('*, sets(name, image_url, rebrickable_id, set_number, theme)')
    .order('published_at', { ascending: false });

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-dark py-12 px-4">
        <div className="max-w-site mx-auto flex items-center gap-6">
          <div className="flex-1">
            <h1 className="font-heading text-primary text-6xl mb-2">LEGO REVIEWS</h1>
            <p className="text-gray-300 font-body text-lg">
              Honest. Opinionated. Wallet-aware. We tell you exactly what&apos;s worth buying in India — and what isn&apos;t.
              No corporate speak. No fence-sitting. On that note, let&apos;s begin.
            </p>
          </div>
          <Image src={MASCOTS.red.reading} alt="Reviews" width={160} height={160} className="object-contain shrink-0 hidden md:block" />
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-10">
        {!reviews || reviews.length === 0 ? (
          <div className="text-center py-20">
            <Image src={MASCOTS.blue.phone} alt="Coming soon" width={150} height={150} className="mx-auto mb-4 object-contain" />
            <h2 className="font-heading text-dark text-3xl mb-2">REVIEWS LOADING</h2>
            <p className="text-gray-400 font-body">We&apos;re building sets as fast as our wallets allow. Reviews coming soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((review: any) => <ReviewCard key={review.id} review={review} />)}
          </div>
        )}
      </div>
    </div>
  );
}
