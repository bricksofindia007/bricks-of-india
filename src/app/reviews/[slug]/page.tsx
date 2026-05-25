import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { createServerClient, supabase } from '@/lib/supabase';
import { formatDate, formatPrice, whatsappShareUrl, twitterShareUrl } from '@/lib/utils';
import { MASCOTS } from '@/lib/brand';
import { ToycraDiscountBanner } from '@/components/ui/ToycraDiscountBanner';
import { Byline } from '@/components/content/Byline';
import { JsonLd } from '@/components/JsonLd';
import { buildReviewSchema } from '@/lib/schemas';

interface Props { params: { slug: string } }

const TRACKED_STORES = [
  { id: 'toycra',       name: 'Toycra'      },
  { id: 'mybrickhouse', name: 'MyBrickHouse' },
  { id: 'jaiman',       name: 'Jaiman Toys'  },
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data: review } = await supabase.from('reviews').select('*, sets(name)').eq('slug', params.slug).single();
  if (!review) return { title: 'Review Not Found' };
  return {
    title: `LEGO ${review.sets?.name || review.title} Review — Is It Worth Buying in India?`,
    description: `Our honest verdict on the LEGO ${review.sets?.name}. ${review.rating}/5 stars. Read the full review including price comparison and buying advice for India.`,
    alternates: { canonical: `https://bricksofindia.com/reviews/${params.slug}` },
  };
}

export default async function ReviewPage({ params }: Props) {
  const { data: review } = await supabase
    .from('reviews')
    .select('*, sets(*)')
    .eq('slug', params.slug)
    .single();

  if (!review) notFound();

  const set = review.sets;

  // Store prices — full map for all tracked stores (mirrors sets/[slug]/page.tsx pattern)
  const storePriceMap = new Map<string, { store_id: string; price_inr: number | null; in_stock: boolean; product_url: string }>();
  if (set?.set_number) {
    const serverClient = createServerClient();
    const { data: storePrices } = await serverClient
      .from('store_prices')
      .select('store_id, price_inr, in_stock, product_url')
      .eq('set_id', set.set_number);
    for (const sp of storePrices ?? []) {
      storePriceMap.set(sp.store_id, sp);
    }
  }
  const activePrices = TRACKED_STORES
    .map(s => storePriceMap.get(s.id))
    .filter((sp): sp is { store_id: string; price_inr: number; in_stock: boolean; product_url: string } =>
      sp != null && sp.price_inr != null);
  const hasPrices = activePrices.length > 0;
  const bestStorePrice =
    activePrices.filter(sp => sp.in_stock).sort((a, b) => a.price_inr - b.price_inr)[0]
    ?? activePrices.sort((a, b) => a.price_inr - b.price_inr)[0]
    ?? null;

  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
  const shareUrl = `https://bricksofindia.com/reviews/${params.slug}`;
  const waText = `Just read this LEGO review on Bricks of India — use ABHINAV12 for 12% off at Toycra!`;

  return (
    <div className="bg-white min-h-screen">
      <JsonLd data={buildReviewSchema(review, review.title, set)} />
      {/* Hero */}
      <div className="bg-dark py-12 px-4">
        <div className="max-w-site mx-auto">
          <nav className="text-sm text-gray-400 flex items-center gap-2 mb-4">
            <Link href="/" className="hover:text-primary">Home</Link>
            <span>/</span>
            <Link href="/reviews" className="hover:text-primary">Reviews</Link>
            <span>/</span>
            <span className="text-gray-200">{review.title}</span>
          </nav>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-primary text-2xl">{stars}</span>
            <span className="text-gray-400">({review.rating}/5)</span>
            <span className={`font-bold text-sm px-3 py-1 rounded-full ${review.rating >= 4 ? 'bg-deal-green text-white' : 'bg-warning-orange text-white'}`}>
              {review.rating >= 4 ? '👍 Recommended' : '👎 Skip It'}
            </span>
          </div>
          <h1 className="font-heading text-white text-5xl md:text-6xl mb-2">{review.title}</h1>
          <Byline publishedAt={review.published_at} updatedAt={review.updated_at} />
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-10">
        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            {/* YouTube embed */}
            {review.youtube_url && (
              <div className="aspect-video rounded-2xl overflow-hidden mb-8 shadow-xl">
                <iframe
                  src={review.youtube_url.replace('watch?v=', 'embed/')}
                  title={review.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            )}

            {/* Review content */}
            <div className="prose prose-gray max-w-none font-body leading-relaxed text-gray-700 mb-8">
              <ReactMarkdown>{review.content}</ReactMarkdown>
            </div>

            {/* Verdict */}
            <div className="border-2 border-dark rounded-2xl p-6 mb-8">
              <div className="flex items-start gap-4">
                <Image src={review.rating >= 4 ? MASCOTS.red.thumbsUp : MASCOTS.red.thumbsDown} alt="Verdict" width={80} height={80} className="object-contain shrink-0" />
                <div>
                  <h3 className="font-heading text-dark text-2xl mb-1">BRICKS OF INDIA SAYS:</h3>
                  <p className="font-bold text-lg text-dark">{review.verdict}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-primary text-xl">{stars}</span>
                    <span className="font-price font-bold text-dark">{review.rating}/5</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Share */}
            <div className="flex gap-3 mb-8">
              <a href={whatsappShareUrl(waText, shareUrl)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#25D366] text-white font-bold px-4 py-2 rounded-lg text-sm">
                <span>📱</span> WhatsApp
              </a>
              <a href={twitterShareUrl(review.title, shareUrl)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 bg-dark text-white font-bold px-4 py-2 rounded-lg text-sm">
                <span>🐦</span> Twitter
              </a>
            </div>

            <ToycraDiscountBanner variant="compact" />
          </div>

          {/* Sidebar */}
          <div>
            {set && (
              <div className="sticky top-20">
                <div className="bg-light-grey rounded-2xl p-4 border-2 border-border mb-6">
                  <Image
                    src={
                      set.image_url ??
                      (set.rebrickable_id
                        ? `https://cdn.rebrickable.com/media/sets/${set.rebrickable_id}.jpg`
                        : '/mascots/blue-fig-confused.png')
                    }
                    alt={set.name}
                    width={300}
                    height={300}
                    className="w-full object-contain mb-3"
                    unoptimized
                  />
                  <h3 className="font-heading text-dark text-xl mb-1">{set.name}</h3>
                  <p className="font-price text-gray-400 text-sm mb-3">Set #{set.set_number}</p>

                  {/* Store prices — always shown, "Not listed" fallback per store */}
                  <div className="border-t border-border pt-3 mb-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-2">Prices in India</p>
                    <div className="space-y-2">
                      {TRACKED_STORES.map((store) => {
                        const sp = storePriceMap.get(store.id);
                        if (!sp?.price_inr) {
                          return (
                            <div key={store.id} className="flex items-center justify-between">
                              <span className="text-sm text-dark">{store.name}</span>
                              <span className="text-xs text-gray-400">Not listed</span>
                            </div>
                          );
                        }
                        const isBest = hasPrices && sp.price_inr === bestStorePrice?.price_inr;
                        return (
                          <div key={store.id} className="flex items-center justify-between">
                            <span className="text-sm text-dark">{store.name}</span>
                            <div className="flex items-center gap-2">
                              <span className={`font-price text-sm font-bold ${isBest ? 'text-deal-green' : 'text-dark'}`}>
                                {formatPrice(sp.price_inr)}
                              </span>
                              {sp.in_stock ? (
                                <a
                                  href={sp.product_url}
                                  target="_blank"
                                  rel="noopener noreferrer sponsored"
                                  className="text-xs font-bold text-primary hover:underline"
                                >
                                  Buy →
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400">OOS</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {bestStorePrice?.in_stock && (
                      <a
                        href={bestStorePrice.product_url}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className="block w-full text-center bg-deal-green text-white font-bold py-2 rounded-lg hover:opacity-90 transition-opacity text-sm mt-3"
                      >
                        Buy Now →
                      </a>
                    )}
                  </div>

                  <Link href={`/sets/${set.set_number}-${set.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    className="block w-full text-center bg-primary text-dark font-bold py-2.5 rounded-lg hover:bg-yellow-400 transition-colors text-sm">
                    Compare Prices →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mt-8">
          <h2 className="font-heading text-dark text-3xl mb-4">FREQUENTLY ASKED QUESTIONS</h2>
          <div className="space-y-3">
            {[
              {
                q: `Is ${set?.name || 'this set'} worth buying in India in 2026?`,
                a: `${review.verdict} Our rating: ${review.rating}/5. ${review.rating >= 4 ? "Yes, we think it's a solid purchase." : "We'd recommend waiting for a better deal or considering alternatives."}`,
              },
              {
                q: `Where can I buy ${set?.name || 'this set'} cheapest in India?`,
                a: hasPrices
                  ? `Based on our latest tracking, ${TRACKED_STORES.find(s => s.id === bestStorePrice?.store_id)?.name ?? 'a tracked store'} has the best price. Use code ABHINAV12 at Toycra for 12% off.`
                  : `Check Toycra, MyBrickHouse, and Jaiman Toys for current prices. Use code ABHINAV12 at Toycra for an exclusive 12% off.`,
              },
              {
                q: `What is the price of ${set?.name || 'this set'} in India?`,
                a: set?.lego_mrp_inr
                  ? `The official LEGO India MRP is ₹${set.lego_mrp_inr.toLocaleString('en-IN')}. Some stores may sell at a discount. Compare prices above.`
                  : 'Check our price comparison tool for current prices across Indian stores.',
              },
              {
                q: `How many pieces does ${set?.name || 'this set'} have?`,
                a: set?.pieces
                  ? `${set.name} has ${set.pieces.toLocaleString()} pieces. ${set.pieces > 1000 ? "That's a serious build — budget at least a weekend." : 'A manageable build for most experience levels.'}`
                  : 'Check the product listing for piece count details.',
              },
              {
                q: `Is ${set?.name || 'this set'} suitable for adults?`,
                a: `${set?.age_range ? `The official age range is ${set.age_range}, but` : ''} LEGO is genuinely for all ages. We think adults arguably enjoy it more — no one judges you for reading the instructions.`,
              },
            ].map((faq, i) => (
              <details key={i} className="border-2 border-border rounded-xl overflow-hidden">
                <summary className="px-4 py-3 font-bold text-dark cursor-pointer hover:bg-light-grey transition-colors">{faq.q}</summary>
                <div className="px-4 py-3 bg-light-grey text-gray-600 font-body text-sm">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
