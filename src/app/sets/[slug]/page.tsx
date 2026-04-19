import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServerClient, supabase } from '@/lib/supabase';
import { getSet } from '@/lib/rebrickable';
import { formatPrice, slugify, whatsappShareUrl } from '@/lib/utils';
import { MASCOTS } from '@/lib/brand';
import { Badge, BestPriceBadge, OutOfStockBadge } from '@/components/ui/Badge';
import { ToycraDiscountBanner } from '@/components/ui/ToycraDiscountBanner';
import { SetCard } from '@/components/sets/SetCard';

interface Props {
  params: { slug: string };
}

// ── The 3 stores we actively track ───────────────────────────────────────────
const TRACKED_STORES = [
  { id: 'toycra',       name: 'Toycra',       url: 'https://www.toycra.com'   },
  { id: 'mybrickhouse', name: 'MyBrickHouse',  url: 'https://mybrickhouse.com' },
  { id: 'jaiman',       name: 'Jaiman Toys',   url: 'https://jaimantoys.com'   },
];

async function getSetData(slug: string) {
  const setNumber = slug.split('-')[0];

  // Primary path: Supabase
  const { data: set } = await supabase
    .from('sets')
    .select('*, reviews(*)')
    .eq('set_number', setNumber)
    .single();

  if (set) return set;

  // Fallback: Rebrickable (runtime only — never called at build time since
  // this route has no generateStaticParams)
  const rbSet = await getSet(`${setNumber}-1`);
  if (!rbSet) return null;

  return {
    id: rbSet.set_num,
    set_number: setNumber,
    rebrickable_id: rbSet.set_num,
    name: rbSet.name,
    year: rbSet.year,
    theme: '',
    subtheme: null,
    pieces: rbSet.num_parts,
    minifigs: null,
    image_url: rbSet.set_img_url,
    description: null,
    age_range: null,
    lego_mrp_inr: null,
    created_at: '',
    updated_at: '',
    reviews: [],
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const set = await getSetData(params.slug);
  if (!set) return { title: 'Set Not Found' };
  return {
    title: `${set.name} (${set.set_number}) Price in India 2026`,
    description: `Find the best price for ${set.name} in India. Compare prices across Toycra, MyBrickHouse, Jaiman Toys and more. Updated every 6 hours.`,
    alternates: { canonical: `https://bricksofindia.com/sets/${params.slug}` },
    openGraph: {
      title: `${set.name} (${set.set_number}) — Best Price in India`,
      description: `Compare ${set.name} prices across Indian stores. Best deal updated every 6 hours.`,
      images: set.image_url ? [{ url: set.image_url }] : [],
    },
  };
}

export default async function SetPage({ params }: Props) {
  const set = await getSetData(params.slug);
  if (!set) notFound();

  // ── Query store_prices for this set ──────────────────────────────────────
  const serverClient = createServerClient();
  const { data: storePrices } = await serverClient
    .from('store_prices')
    .select('*')
    .eq('set_id', set.set_number);

  const storePriceMap = new Map((storePrices ?? []).map((sp: any) => [sp.store_id, sp]));

  // Staleness: max(scraped_at) across all rows for this set
  const lastUpdated = storePrices && storePrices.length > 0
    ? storePrices.reduce((latest: string, sp: any) =>
        new Date(sp.scraped_at) > new Date(latest) ? sp.scraped_at : latest,
        storePrices[0].scraped_at)
    : null;

  const hoursAgo = lastUpdated
    ? (Date.now() - new Date(lastUpdated).getTime()) / 3_600_000
    : null;

  const stalenessColor =
    !hoursAgo         ? 'text-gray-400' :
    hoursAgo > 72     ? 'text-red-500'  :
    hoursAgo > 24     ? 'text-amber-500':
                        'text-gray-400';

  const stalenessText =
    !hoursAgo     ? 'Prices not yet scraped — check stores directly' :
    hoursAgo < 1  ? 'Updated just now' :
    hoursAgo < 24 ? `Updated ${Math.floor(hoursAgo)}h ago` :
    hoursAgo > 72 ? `Updated ${Math.floor(hoursAgo)}h ago — data may be stale` :
                    `Updated ${Math.floor(hoursAgo)}h ago`;

  // Best price across tracked stores (for schema + FAQ)
  const activePrices = TRACKED_STORES
    .map((s) => storePriceMap.get(s.id))
    .filter((sp): sp is any => sp?.price_inr != null);
  const bestStorePrice = activePrices.sort((a, b) => a.price_inr - b.price_inr)[0] ?? null;
  const hasPrices = activePrices.length > 0;
  const hasToycra = !!storePriceMap.get('toycra')?.price_inr;

  // Related sets
  let relatedSets = null;
  if (set.theme) {
    const { data } = await supabase
      .from('sets')
      .select('*, prices(*)')
      .eq('theme', set.theme)
      .neq('set_number', set.set_number)
      .limit(4);
    relatedSets = data;
  }

  const review = set.reviews?.[0] || null;
  const shareUrl = `https://bricksofindia.com/sets/${params.slug}`;
  const waText   = `Check out ${set.name} price comparison on Bricks of India — use code ABHINAV12 for 12% off at Toycra!`;

  const setImageSrc =
    set.image_url ??
    (set.rebrickable_id
      ? `https://cdn.rebrickable.com/media/sets/${set.rebrickable_id}.jpg`
      : '/mascots/blue-fig-confused.png');

  const STORE_NAMES: Record<string, string> = {
    toycra:       'Toycra',
    mybrickhouse: 'MyBrickHouse',
    jaiman:       'Jaiman Toys',
  };

  const schemaProduct = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: set.name,
    sku: set.set_number,
    image: set.image_url ?? undefined,
    description:
      set.description ||
      `LEGO ${set.theme ? set.theme + ' ' : ''}set ${set.set_number}${set.pieces ? ', ' + set.pieces + ' pieces' : ''}, compare prices across Indian stores`,
    brand: { '@type': 'Brand', name: 'LEGO' },
    ...(hasPrices && {
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'INR',
        lowPrice: activePrices.reduce(
          (min: number, sp: any) => (sp.price_inr < min ? sp.price_inr : min),
          activePrices[0]?.price_inr,
        ),
        highPrice: activePrices.reduce(
          (max: number, sp: any) => (sp.price_inr > max ? sp.price_inr : max),
          activePrices[0]?.price_inr,
        ),
        offerCount: activePrices.length,
        availability: 'https://schema.org/InStock',
        offers: activePrices.map((sp: any) => ({
          '@type': 'Offer',
          price: sp.price_inr,
          priceCurrency: 'INR',
          url: sp.product_url || `https://bricksofindia.com/sets/${params.slug}`,
          availability: sp.in_stock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          seller: {
            '@type': 'Organization',
            name: STORE_NAMES[sp.store_id] ?? sp.store_id,
          },
        })),
      },
    }),
  };

  return (
    <div className="bg-white min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaProduct) }}
      />

      {/* Breadcrumb */}
      <div className="max-w-site mx-auto px-4 py-3">
        <nav className="text-sm text-gray-400 flex items-center gap-2">
          <Link href="/" className="hover:text-accent-blue">Home</Link>
          <span>/</span>
          <Link href="/compare" className="hover:text-accent-blue">Sets</Link>
          <span>/</span>
          {set.theme && (
            <>
              <Link href={`/themes/${slugify(set.theme)}`} className="hover:text-accent-blue">{set.theme}</Link>
              <span>/</span>
            </>
          )}
          <span className="text-dark font-bold truncate">{set.name}</span>
        </nav>
      </div>

      <div className="max-w-site mx-auto px-4 pb-12">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* Left: Image */}
          <div className="lg:col-span-2">
            <div className="sticky top-20">
              <div className="bg-light-grey rounded-2xl p-6 border-2 border-border">
                <Image
                  src={setImageSrc}
                  alt={set.name}
                  width={500}
                  height={500}
                  className="w-full object-contain"
                  unoptimized
                />
              </div>
              {/* Share */}
              <div className="mt-4 flex gap-3">
                <a
                  href={whatsappShareUrl(waText, shareUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold py-2.5 rounded-lg hover:bg-green-600 transition-colors text-sm"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Share on WhatsApp
                </a>
              </div>
            </div>
          </div>

          {/* Right: Details */}
          <div className="lg:col-span-3">
            {/* Badges + Title */}
            <div className="flex flex-wrap gap-2 mb-3">
              {set.theme    && <Badge variant="grey">{set.theme}</Badge>}
              {set.year     && <Badge variant="grey">{set.year}</Badge>}
              {set.age_range && <Badge variant="grey">Ages {set.age_range}</Badge>}
              {set.pieces   && <Badge variant="grey">{set.pieces.toLocaleString()} pcs</Badge>}
            </div>
            <h1 className="font-heading text-dark text-4xl md:text-5xl leading-tight mb-2">{set.name}</h1>
            <p className="text-gray-400 font-price text-sm mb-4">Set #{set.set_number}</p>

            {/* Official MRP */}
            {set.lego_mrp_inr && (
              <div className="bg-light-grey rounded-xl p-4 mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-bold">Official LEGO India MRP</p>
                  <p className="font-price text-2xl font-bold text-dark">{formatPrice(set.lego_mrp_inr)}</p>
                </div>
                <span className="text-3xl">🏷️</span>
              </div>
            )}

            {/* ── PRICE COMPARISON TABLE ────────────────────────────────────── */}
            <div className="border-2 border-dark rounded-2xl overflow-hidden mb-2">
              <div className="bg-dark px-5 py-3 flex items-center justify-between">
                <h2 className="font-heading text-primary text-xl">COMPARE PRICES IN INDIA</h2>
              </div>

              <div className="divide-y divide-border">
                {/* Tracked stores — always shown, even if no data */}
                {TRACKED_STORES.map((store, i) => {
                  const sp = storePriceMap.get(store.id);
                  const isBest = hasPrices && sp?.price_inr === bestStorePrice?.price_inr && sp?.price_inr != null;
                  const isToycra = store.id === 'toycra';

                  if (!sp) {
                    // No row for this store
                    return (
                      <div key={store.id} className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                        <span className="font-bold text-dark">{store.name}</span>
                        <span className="text-gray-400 text-sm">Not available at {store.name}</span>
                      </div>
                    );
                  }

                  return (
                    <div key={store.id} className={`px-5 py-4 ${isToycra ? 'bg-yellow-50' : ''}`}>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          {isBest && <BestPriceBadge />}
                          <span className="font-bold text-dark">{store.name}</span>
                          {sp.price_inr && !sp.in_stock && <OutOfStockBadge />}
                        </div>
                        <div className="flex items-center gap-3">
                          {sp.price_inr ? (
                            <span className={`font-price font-bold text-lg ${isBest ? 'text-deal-green' : 'text-dark'}`}>
                              {formatPrice(sp.price_inr)}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">Price unavailable</span>
                          )}
                          {sp.in_stock && (
                            <a
                              href={sp.product_url}
                              target="_blank"
                              rel="noopener noreferrer sponsored"
                              className="bg-dark text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors whitespace-nowrap"
                            >
                              {sp.price_inr ? 'Buy Now →' : 'Check Price →'}
                            </a>
                          )}
                          {!sp.in_stock && (
                            <span className="bg-gray-100 text-gray-500 text-sm font-bold px-4 py-2 rounded-lg whitespace-nowrap">
                              Sold out
                            </span>
                          )}
                        </div>
                      </div>
                      {isToycra && (
                        <div className="mt-2">
                          <ToycraDiscountBanner variant="inline" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Amazon + Flipkart — search links only, never quoted prices */}
                <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                  <span className="font-bold text-dark">Amazon India</span>
                  <a
                    href={`https://www.amazon.in/s?k=LEGO+${set.set_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-blue font-bold text-sm hover:underline"
                  >
                    Search on Amazon →
                  </a>
                </div>
                <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                  <span className="font-bold text-dark">Flipkart</span>
                  <a
                    href={`https://www.flipkart.com/search?q=LEGO+${set.set_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-blue font-bold text-sm hover:underline"
                  >
                    Search on Flipkart →
                  </a>
                </div>
              </div>
            </div>

            {/* Staleness indicator */}
            <p className={`text-xs mb-4 ${stalenessColor}`}>{stalenessText}</p>

            {/* Price disclaimer */}
            <p className="text-xs text-gray-400 mb-6">
              Prices updated every 6 hours. Always verify the final price on the retailer&apos;s website before purchase.
              LEGO® is a trademark of The LEGO Group which does not sponsor or endorse this site.
            </p>

            {/* Toycra banner when Toycra has stock */}
            {hasToycra && <div className="mb-6"><ToycraDiscountBanner variant="compact" /></div>}

            {/* Set Description */}
            {set.description && (
              <div className="mb-6">
                <h2 className="font-heading text-dark text-2xl mb-3">SET DETAILS</h2>
                <p className="text-gray-600 font-body leading-relaxed">{set.description}</p>
              </div>
            )}

            {/* Review / Verdict */}
            {review && (
              <div className="border-2 border-dark rounded-2xl p-5 mb-6">
                <div className="flex items-start gap-4">
                  <Image src={MASCOTS.red.judging} alt="Verdict" width={80} height={80} className="object-contain shrink-0" />
                  <div>
                    <h2 className="font-heading text-dark text-2xl mb-1">BRICKS OF INDIA VERDICT</h2>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-primary text-lg">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                      <span className="text-sm text-gray-400">({review.rating}/5)</span>
                    </div>
                    <p className="text-gray-600 font-body mb-3">{review.verdict}</p>
                    <Link href={`/reviews/${review.slug}`} className="text-accent-blue font-bold text-sm hover:underline">
                      Read full review →
                    </Link>
                  </div>
                </div>
                {review.youtube_url && (
                  <div className="mt-4 aspect-video rounded-xl overflow-hidden">
                    <iframe
                      src={review.youtube_url.replace('watch?v=', 'embed/')}
                      title={`${set.name} Review`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                )}
              </div>
            )}

            {/* FAQ */}
            <div className="mb-6">
              <h2 className="font-heading text-dark text-2xl mb-4">FREQUENTLY ASKED QUESTIONS</h2>
              <div className="space-y-3">
                {[
                  {
                    q: `Where is ${set.name} cheapest in India?`,
                    a: hasPrices
                      ? `Based on our latest comparison, ${bestStorePrice ? TRACKED_STORES.find(s => s.id === bestStorePrice.store_id)?.name ?? 'a tracked store' : 'a tracked store'} has the best price at ${bestStorePrice ? formatPrice(bestStorePrice.price_inr) : '—'}. Prices update every 6 hours.`
                      : `We're currently setting up price tracking for ${set.name}. Check Toycra, MyBrickHouse, and Amazon India for live prices.`,
                  },
                  {
                    q: `Is ${set.name} available in India?`,
                    a: `${set.name} availability is tracked across Toycra, MyBrickHouse, and Jaiman Toys. Check individual store links above for real-time stock.`,
                  },
                  {
                    q: `What is the official MRP of ${set.name} in India?`,
                    a: set.lego_mrp_inr
                      ? `The official LEGO India MRP for ${set.name} is ${formatPrice(set.lego_mrp_inr)}.`
                      : `The official India MRP for ${set.name} hasn't been confirmed. Check lego.com/en-in for the latest official pricing.`,
                  },
                  {
                    q: `Is ${set.name} worth buying?`,
                    a: review
                      ? `Our verdict: ${review.verdict} (${review.rating}/5 stars). Read our full review for the complete breakdown.`
                      : `We haven't reviewed ${set.name} yet, but you can compare prices across Indian stores above.`,
                  },
                  {
                    q: `Where can I buy ${set.name} with a discount?`,
                    a: `Use code ABHINAV12 at Toycra for 12% off (min. ₹500 purchase). This is an exclusive Bricks of India deal with no usage limits.`,
                  },
                ].map((faq, i) => (
                  <details key={i} className="border-2 border-border rounded-xl overflow-hidden group">
                    <summary className="px-4 py-3 font-bold text-dark cursor-pointer hover:bg-light-grey transition-colors flex items-center justify-between">
                      {faq.q}
                      <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="px-4 py-3 bg-light-grey text-gray-600 font-body text-sm leading-relaxed">
                      {faq.a}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Related Sets */}
        {relatedSets && relatedSets.length > 0 && (
          <div className="mt-12">
            <h2 className="font-heading text-dark text-3xl mb-6">MORE {set.theme?.toUpperCase()} SETS</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {relatedSets.map((relSet: any) => {
                const rPrices = (relSet.prices || []).filter((p: any) => p.is_active && p.price_inr);
                const bestP = rPrices.sort((a: any, b: any) => a.price_inr - b.price_inr)[0] || null;
                return <SetCard key={relSet.id} set={relSet} bestPrice={bestP} priceCount={rPrices.length} />;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
