import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { cache } from 'react';
import { buildMetadata } from '@/lib/metadata';
import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { SET_PAGE_REVALIDATE_SECONDS, PRICE_CADENCE, bestInStock, isPriceFresh } from '@/lib/price-freshness';
import { PriceAge } from '@/components/ui/PriceAge';
import { getSet } from '@/lib/rebrickable';
import { formatPrice, whatsappShareUrl, socialCardImage, setMetaDescription } from '@/lib/utils';
import { MASCOTS } from '@/lib/brand';
import { resolveThemeSlug } from '@/lib/themeMapping';
import { Badge, BestPriceBadge, OnlyAtBadge, DealBadge } from '@/components/ui/Badge';
import { priceLabel, storeName, ANCHOR_SOURCE_LABEL, type SetPriceSummary } from '@/lib/price-summary';
import { ToycraDiscountBanner } from '@/components/ui/ToycraDiscountBanner';
import { SetCard } from '@/components/sets/SetCard';
import { JsonLd } from '@/components/JsonLd';
import { buildProductSchema, buildFAQSchema } from '@/lib/schemas';
// Durable-cache guard (2026-07-02): a revalidate must always be set, or
// rendered pages persist across deploys. Set pages use 6h (operator decision
// 2026-09-26): 26k crawlable URLs, and Supabase egress is the binding Free
// quota. = SET_PAGE_REVALIDATE_SECONDS (segment config must be a literal).
export const revalidate = 21600;
// The Supabase read (set_page_data) expires on the same 6h clock via a
// per-read `next.revalidate`, NOT fetchCache='default-cache', which cached
// it until the next deploy.

export async function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ slug: string }>;
}

// ── The 2 stores we actively track ───────────────────────────────────────────
// Alphabetical (R5: no store gets precedence; ties are shown with equal weight).
const TRACKED_STORES = [
  { id: 'mybrickhouse', name: 'MyBrickHouse',  url: 'https://mybrickhouse.com' },
  { id: 'toycra',       name: 'Toycra',       url: 'https://www.toycra.com'   },
];

// Fix A (2026-09-26): everything this page renders comes from ONE read-only
// RPC, public.set_page_data (migration 20260926030000), instead of 8
// separate requests. React cache() makes generateMetadata and the page share
// that single call. Every Supabase request writes a ~2.5 KB gateway log line
// and crawlers render thousands of distinct set pages a day, so this page
// was the main driver of the project's log ingest and a large share of egress.
type SetPageData = {
  set: any | null;
  store_prices: any[];
  related: any[];
  related_prices: { set_id: string; price_inr: number; store_id: string; product_url: string | null; in_stock: boolean; scraped_at: string }[];
  coverage: { news: any[]; guides: any[]; reviews: any[] };
  // PR-B: public.set_price_summary rows (R2-R6), folded into the same call.
  summary: SetPriceSummary | null;
  related_summaries: SetPriceSummary[];
};

const getSetPageData = cache(async (slug: string): Promise<SetPageData | null> => {
  const setNumber = slug.split('-')[0];
  // Set pages read on a 6h clock (SET_PAGE_REVALIDATE_SECONDS; operator
  // decision 2026-09-26: 26k crawlable URLs, egress is the binding quota).
  const client = createServerClient({ revalidate: SET_PAGE_REVALIDATE_SECONDS });
  const { data, error } = await client.rpc('set_page_data', { p_set_number: setNumber, p_slug: slug });
  if (error) throw error;
  const d = data as SetPageData;
  if (d.set) return d;

  // Fallback: Rebrickable (runtime only — never called at build time since
  // this route has no generateStaticParams)
  const rbSet = await getSet(`${setNumber}-1`);
  if (!rbSet) return null;

  return {
    ...d,
    set: {
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
    },
  };
});

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const set = (await getSetPageData(params.slug))?.set;
  if (!set) return { title: 'Set Not Found' };
  return {
    ...buildMetadata({
      title: `${set.name} (${set.set_number}) Price in India 2026`,
      description: setMetaDescription(set.name),
      path: `/sets/${params.slug}`,
      image: socialCardImage(set.image_url),
      ogTitle: `${set.name} (${set.set_number}) — Best Price in India`,
      ogDescription: `Compare ${set.name} prices across Indian stores. Best deal updated ${PRICE_CADENCE}.`,
    }),
    // GSC-01 Part A: Tier 3 (merch/parts/exclusives, not real LEGO sets)
    // stays crawlable -- follow: true -- so link equity and any existing
    // backlinks still flow through, but is excluded from the index. The
    // Rebrickable fallback path (no DB row) has no index_tier at all and
    // is intentionally left unrestricted -- it's a live, uncached lookup
    // for a set not yet in our catalog, not a known-noindex case.
    //
    // noindex_override (2026-08-29): a second, independent noindex signal
    // -- currently the tier2/year<2020/zero-price-history-ever cutoff (see
    // migration 20260829010000_tier2_stale_noindex_override.sql). Kept
    // separate from index_tier deliberately (that column is DB-trigger-
    // maintained and would silently get recomputed away from a manual
    // 'tier3' override on the next Rebrickable metadata resync -- see the
    // migration's own comment). Same follow:true treatment as tier3.
    ...((set.index_tier === 'tier3' || set.noindex_override) && { robots: { index: false, follow: true } }),
  };
}

export default async function SetPage(props: Props) {
  const params = await props.params;
  const pageData = await getSetPageData(params.slug);
  if (!pageData?.set) notFound();
  const set = pageData.set;

  // ── store_prices for this set (from set_page_data) ───────────────────────
  const storePrices = pageData.store_prices;

  const storePriceMap = new Map((storePrices ?? []).map((sp: any) => [sp.store_id, sp]));

  // Staleness: max(scraped_at) across all rows for this set
  const lastUpdated = storePrices && storePrices.length > 0
    ? storePrices.reduce((latest: string, sp: any) =>
        new Date(sp.scraped_at) > new Date(latest) ? sp.scraped_at : latest,
        storePrices[0].scraped_at)
    : null;

  // Best price across tracked stores (for schema + FAQ). PR-A: in-stock rows
  // only -- a sold-out listing's price is not a price anyone can pay. The
  // badge additionally needs a fresh row (<= PRICE_STALE_HOURS); an older
  // row still shows, with its real age, but earns no badge.
  const activePrices = TRACKED_STORES
    .map((s) => storePriceMap.get(s.id))
    .filter((sp): sp is any => sp?.price_inr != null);
  const bestStorePrice = bestInStock(activePrices);
  const hasPrices = bestStorePrice != null;

  // PR-B: locked rules R2-R6 from public.set_price_summary -- the MRP anchor
  // and its source, the deal tier, and which store(s) hold the fresh
  // in-stock best price. Badges come only from here.
  const summary = pageData.summary ?? null;
  const label = priceLabel(summary);
  const bestStoreIds = new Set(summary?.best_store_ids ?? []);
  // R5: stores at the lowest price first (alphabetical), then the rest.
  const orderedStores = [...TRACKED_STORES].sort((a, b) =>
    Number(bestStoreIds.has(b.id)) - Number(bestStoreIds.has(a.id)) || a.name.localeCompare(b.name));
  const anchorMrp = summary?.anchor_mrp_inr ?? null;
  const hasToycra = !!storePriceMap.get('toycra')?.price_inr;

  // Related sets (same theme, newest first) and their prices, from set_page_data.
  const relatedSets: any[] = pageData.related;
  const relatedPriceMap: Record<string, { price_inr: number; store_name: string; buy_url: string | null; in_stock: boolean; scraped_at: string }> = {};
  for (const rp of pageData.related_prices) {
    if (!rp.in_stock) continue; // PR-A: best price = in-stock rows only
    const existing = relatedPriceMap[rp.set_id];
    if (!existing || rp.price_inr < existing.price_inr) {
      relatedPriceMap[rp.set_id] = { price_inr: rp.price_inr, store_name: rp.store_id, buy_url: rp.product_url ?? null, in_stock: true, scraped_at: rp.scraped_at };
    }
  }

  const relSummaries = new Map((pageData.related_summaries ?? []).map((r) => [r.set_id, r]));

  // Related Coverage (GEO-05b Phase 3) — the reverse of Phase 2's forward
  // linking: any published article whose body links to THIS set's own
  // slug via [num](/sets/<this-slug>), the exact markdown pattern
  // linkFirstSetMentions() inserts. Reuses that link shape rather than a
  // second matching system. Rendered only if at least one match exists —
  // absent, not an empty "no coverage yet" block (same discipline as the
  // Part C review/aggregateRating fix).
  // Nav & Content Overhaul (2026-08-09): blog_posts dropped from this query
  // -- every row that matters here was copied into guides or news_articles
  // (category='Opinion'), so querying blog_posts too would either double-
  // count the same coverage or point at a slug that now just 301s. guides
  // added since it's a real coverage source now (weekly generation, §5).
  // Same %](/sets/<slug>)% match, now done inside set_page_data.
  const newsCoverageRes = { data: pageData.coverage.news };
  const guidesCoverageRes = { data: pageData.coverage.guides };
  const reviewCoverageRes = { data: pageData.coverage.reviews };
  const relatedCoverage = [
    ...(newsCoverageRes.data ?? []).map((a: any) => ({
      ...a,
      href: `/news/${a.slug}`,
      kind: a.category === 'Opinion' ? 'Opinion' : 'News',
    })),
    ...(guidesCoverageRes.data ?? []).map((a: any) => ({ ...a, href: `/guides/${a.slug}`, kind: 'Guide' })),
    ...(reviewCoverageRes.data ?? []).map((a: any) => ({ ...a, href: `/reviews/${a.slug}`, kind: 'Review' })),
  ].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

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
  };

  return (
    <div className="bg-white min-h-screen">
      <JsonLd data={buildProductSchema(set, activePrices, params.slug, STORE_NAMES, setMetaDescription(set.name), review)} />

      {/* Breadcrumb */}
      <div className="max-w-site mx-auto px-4 py-3">
        <nav className="text-sm text-gray-400 flex items-center gap-2">
          <Link href="/" className="hover:text-accent-blue">Home</Link>
          <span>/</span>
          <Link href="/compare" className="hover:text-accent-blue">Sets</Link>
          <span>/</span>
          {set.theme && (() => {
            // Was `/themes/${slugify(set.theme)}` unconditionally -- 404'd
            // for any raw theme (Rebrickable's full taxonomy) that isn't
            // one of the curated /themes/ pages. resolveThemeSlug() only
            // returns a slug for a theme actually reviewed/mapped to a
            // real page; everything else renders as plain unlinked text
            // instead of a dead link. See docs/audits/theme-mapping-proposal.csv.
            const themeSlug = resolveThemeSlug(set.theme);
            return (
              <>
                {themeSlug ? (
                  <Link href={`/themes/${themeSlug}`} className="hover:text-accent-blue">{set.theme}</Link>
                ) : (
                  <span>{set.theme}</span>
                )}
                <span>/</span>
              </>
            );
          })()}
          <span className="text-dark font-bold truncate min-w-0 flex-1">{set.name}</span>
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

            {/* MRP (R2): the anchor and its source win over any other MRP. The
                US-price estimate shows only when there is no anchor at all. */}
            {(anchorMrp || set.lego_mrp_inr) && (
              <div className="bg-light-grey rounded-xl p-4 mb-6 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-bold">
                    {anchorMrp ? 'MRP' : set.mrp_verified ? 'MRP' : 'Est. MRP (from US price)'}
                  </p>
                  <p className="font-price text-2xl font-bold text-dark">{formatPrice(anchorMrp ?? set.lego_mrp_inr!)}</p>
                  {anchorMrp && summary?.anchor_source && (
                    <p className="text-xs text-gray-500">{ANCHOR_SOURCE_LABEL[summary.anchor_source]}</p>
                  )}
                </div>
                {summary?.deal_tier ? <DealBadge tier={summary.deal_tier} pct={summary.discount_pct} /> : <span className="text-3xl">🏷️</span>}
              </div>
            )}

            {/* ── PRICE COMPARISON TABLE ────────────────────────────────────── */}
            <div className="border-2 border-dark rounded-2xl overflow-hidden mb-2">
              <div className="bg-dark px-5 py-3 flex items-center justify-between">
                <h2 className="font-heading text-primary text-xl">COMPARE PRICES IN INDIA</h2>
              </div>

              <div className="divide-y divide-border">
                {/* Tracked stores — always shown, even if no data */}
                {orderedStores.map((store) => {
                  const sp = storePriceMap.get(store.id);
                  // R5/R6 (PR-B): every store at the fresh in-stock lowest price is
                  // highlighted equally; the trophy appears only when 2+ stores are
                  // in stock and exactly one is cheapest; one store in stock reads
                  // "Only at <store>". Replaces the 2026-07-02 single-winner rule,
                  // which silently favoured whichever store was listed first.
                  const atBest = bestStoreIds.has(store.id);
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
                    <div key={store.id} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          {atBest && label?.kind === 'best' && <BestPriceBadge />}
                          {atBest && label?.kind === 'only' && <OnlyAtBadge store={store.name} />}
                          <span className="font-bold text-dark">{store.name}</span>
                          {!sp.in_stock && (
                            <span className="text-sm text-gray-500 font-bold">Out of stock at {store.name}</span>
                          )}
                          {sp.price_inr && !isPriceFresh(sp.scraped_at) && (
                            <PriceAge scrapedAt={sp.scraped_at} prefix="Price from" className="text-xs text-gray-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {sp.price_inr ? (
                            <span className={`font-price font-bold text-lg ${atBest ? 'text-deal-green' : sp.in_stock ? 'text-dark' : 'text-gray-400'}`}>
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
            <p className="text-xs mb-4 text-gray-400"><PriceAge scrapedAt={lastUpdated} /></p>

            {/* Price disclaimer */}
            <p className="text-xs text-gray-400 mb-6">
              Prices updated {PRICE_CADENCE}. Always verify the final price on the retailer&apos;s website before purchase.
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
                {(() => { const faqs = [
                  {
                    q: `Where is ${set.name} cheapest in India?`,
                    // R5: every store at the lowest price is named, alphabetically.
                    a: summary?.best_price_inr != null && summary.best_store_ids?.length
                      ? `Based on our latest comparison, ${summary.best_store_ids.map(storeName).join(' and ')} ${summary.best_store_ids.length > 1 ? 'share' : 'has'} the lowest in-stock price at ${formatPrice(summary.best_price_inr)}. Prices are checked ${PRICE_CADENCE}.`
                      : hasPrices
                      ? `The lowest in-stock price we last saw was ${formatPrice(bestStorePrice!.price_inr)} at ${storeName(bestStorePrice!.store_id)}, but that price is more than 12 hours old — check the store for today's price.`
                      : `We're currently setting up price tracking for ${set.name}. Check Toycra, MyBrickHouse, and Amazon India for live prices.`,
                  },
                  {
                    q: `Is ${set.name} available in India?`,
                    a: `${set.name} availability is tracked across Toycra and MyBrickHouse. Check individual store links above for real-time stock.`,
                  },
                  {
                    q: `What is the official MRP of ${set.name} in India?`,
                    a: anchorMrp && summary?.anchor_source
                      ? `The MRP for ${set.name} is ${formatPrice(anchorMrp)} (${ANCHOR_SOURCE_LABEL[summary.anchor_source]}).`
                      : set.lego_mrp_inr
                      ? set.mrp_verified
                        ? `The confirmed LEGO India MRP for ${set.name} is ${formatPrice(set.lego_mrp_inr)}.`
                        : `Based on the US retail price, ${set.name} works out to roughly ${formatPrice(set.lego_mrp_inr)} in India before local pricing adjustments. Check lego.com/en-in for the official MRP.`
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
                ]; return (<><JsonLd data={buildFAQSchema(faqs)} />{faqs.map((faq, i) => (
                  <details key={i} className="border-2 border-border rounded-xl overflow-hidden group">
                    <summary className="px-4 py-3 font-bold text-dark cursor-pointer hover:bg-light-grey transition-colors flex items-center justify-between">
                      {faq.q}
                      <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <div className="px-4 py-3 bg-light-grey text-gray-600 font-body text-sm leading-relaxed">
                      {faq.a}
                    </div>
                  </details>
                ))}</>);})()}
              </div>
            </div>
          </div>
        </div>

        {/* Related Sets */}
        {relatedSets.length > 0 && (
          <div className="mt-12">
            <h2 className="font-heading text-dark text-3xl mb-6">MORE {set.theme?.toUpperCase()} SETS</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {relatedSets.map((relSet: any) => {
                const bestP = relatedPriceMap[relSet.set_number] ?? null;
                return <SetCard key={relSet.id} set={relSet} bestPrice={bestP} priceCount={bestP ? 1 : 0} summary={relSummaries.get(relSet.set_number)} />;
              })}
            </div>
          </div>
        )}

        {/* Related Coverage (GEO-05b Phase 3) */}
        {relatedCoverage.length > 0 && (
          <div className="mt-12">
            <h2 className="font-heading text-dark text-3xl mb-6">RELATED COVERAGE</h2>
            <div className="flex flex-col gap-3">
              {relatedCoverage.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex items-center justify-between gap-3 px-5 py-4 rounded-xl border-2 border-border hover:border-accent-blue transition-colors"
                >
                  <span className="font-bold text-dark">{a.title}</span>
                  <Badge variant="grey">{a.kind}</Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
