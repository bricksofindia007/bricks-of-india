import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase';
import { SetCard } from '@/components/sets/SetCard';
import { ToycraDiscountBanner } from '@/components/ui/ToycraDiscountBanner';
import { MASCOTS } from '@/lib/brand';
import { formatPrice } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Best LEGO Deals in India Right Now | Bricks of India',
  description: 'Current best LEGO prices across all Indian stores. Price drops, exclusive codes, and the sets worth buying right now.',
  alternates: { canonical: 'https://bricksofindia.com/deals' },
};

export const revalidate = 21600; // 6 hours

// A set is a "deal" when any tracked store's price is ≥10% below the 30-day
// average for that set. Fallback when history is thin: price < MSRP × 1.35.
const DEAL_DISCOUNT_THRESHOLD = 0.10; // 10% below average
const MSRP_BENCHMARK_MULTIPLIER = 1.35;

export default async function DealsPage() {
  const supabase = createServerClient();

  // Get all current store prices
  const { data: storePrices } = await supabase
    .from('store_prices')
    .select('set_id, store_id, price_inr, in_stock, scraped_at')
    .not('price_inr', 'is', null);

  // 30-day history for deal calculation
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: history } = await supabase
    .from('price_history')
    .select('set_id, price_inr')
    .gte('recorded_at', thirtyDaysAgo.toISOString());

  // Build 30-day average map: set_id → average price across all stores
  const historyBySet: Record<string, number[]> = {};
  for (const h of history ?? []) {
    if (!historyBySet[h.set_id]) historyBySet[h.set_id] = [];
    historyBySet[h.set_id].push(h.price_inr as number);
  }

  const avgBySet: Record<string, number> = {};
  for (const setId of Object.keys(historyBySet)) {
    const prices = historyBySet[setId];
    avgBySet[setId] = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
  }

  // Find deal set IDs
  const dealSetIds = new Set<string>();
  const currentBySet: Record<string, number> = {}; // best current price per set

  for (const sp of storePrices ?? []) {
    const curr = sp.price_inr as number;
    if (currentBySet[sp.set_id] === undefined || curr < currentBySet[sp.set_id]) {
      currentBySet[sp.set_id] = curr;
    }
  }

  for (const setId of Object.keys(currentBySet)) {
    const bestPrice = currentBySet[setId];
    const avg30d = avgBySet[setId];
    if (avg30d && avg30d > 0) {
      // Primary: 10% below 30-day average
      if (bestPrice <= avg30d * (1 - DEAL_DISCOUNT_THRESHOLD)) {
        dealSetIds.add(setId);
      }
    }
    // Fallback: handled below after joining set info
  }

  // Fetch set data for matching sets (include all with prices for fallback logic)
  const priceSetIds = Object.keys(currentBySet);
  if (priceSetIds.length === 0) {
    // No store_prices data yet — fall back to old prices table
    return <DealsFromLegacyPrices />;
  }

  const { data: setsData } = await supabase
    .from('sets')
    .select('*, prices(*)')
    .in('set_number', priceSetIds);

  // Apply MSRP fallback for sets without enough history
  const dealSets: any[] = [];

  for (const set of setsData ?? []) {
    const bestPrice = currentBySet[set.set_number];
    if (bestPrice === undefined) continue;
    const isDeal = dealSetIds.has(set.set_number);
    const hasMrp  = set.lego_mrp_inr && set.lego_mrp_inr > 0;

    if (isDeal) {
      dealSets.push({ ...set, _dealPrice: bestPrice });
    } else if (!avgBySet[set.set_number] && hasMrp) {
      // No history yet — use MSRP × 1.35 benchmark
      if (bestPrice < set.lego_mrp_inr * MSRP_BENCHMARK_MULTIPLIER) {
        dealSets.push({ ...set, _dealPrice: bestPrice });
      }
    }
  }

  // Sort by biggest savings (absolute ₹)
  dealSets.sort((a, b) => {
    const savA = (a.lego_mrp_inr || a._dealPrice) - a._dealPrice;
    const savB = (b.lego_mrp_inr || b._dealPrice) - b._dealPrice;
    return savB - savA;
  });

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-primary-dark py-12 px-4">
        <div className="max-w-site mx-auto flex items-center gap-6">
          <div className="flex-1">
            <h1 className="font-heading text-white text-6xl mb-2">BEST LEGO DEALS IN INDIA</h1>
            <p className="text-white/70 font-body text-lg">
              Updated every 6 hours. These are the best prices right now across all Indian stores.
              Your wallet is about to have a very complicated day.
            </p>
          </div>
          <Image
            src={MASCOTS.both.celebrate}
            alt="Deals"
            width={180}
            height={180}
            className="object-contain shrink-0 hidden md:block"
          />
        </div>
      </div>

      {/* Toycra exclusive */}
      <ToycraDiscountBanner variant="full" />

      <div className="max-w-site mx-auto px-4 py-10">
        {/* ABHINAV12 spotlight */}
        <div className="bg-accent rounded-2xl p-6 mb-10 flex flex-col md:flex-row items-center gap-6 border-2 border-amber-600">
          <div className="flex-1">
            <p className="text-dark/70 text-xs font-bold uppercase tracking-widest mb-1">Exclusive Discount Code</p>
            <h2 className="font-heading text-dark text-3xl mb-2">12% OFF AT TOYCRA</h2>
            <p className="text-dark/80 font-body mb-4">
              Use code{' '}
              <span className="inline-block font-heading text-2xl bg-dark text-accent px-4 py-1 rounded-lg mx-1 leading-tight">
                ABHINAV12
              </span>
              {' '}at Toycra for 12% off any LEGO set. Min. ₹500. No usage limits.
            </p>
            <a
              href="https://www.toycra.com"
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-block bg-dark text-white font-bold px-6 py-2.5 rounded-xl hover:bg-gray-800 transition-colors text-sm"
            >
              Shop Toycra Now →
            </a>
          </div>
          <Image
            src={MASCOTS.red.trophy}
            alt="Best deal"
            width={130}
            height={130}
            className="object-contain shrink-0"
          />
        </div>

        {dealSets.length === 0 ? (
          <div className="text-center py-16">
            <Image
              src={MASCOTS.blue.phone}
              alt="No deals"
              width={150}
              height={150}
              className="mx-auto mb-4 object-contain"
            />
            <h2 className="font-heading text-dark text-3xl mb-2">NO DEALS RIGHT NOW</h2>
            <p className="text-gray-400 font-body mb-4">
              No sets are currently priced significantly below their usual range.
              Prices are checked every 6 hours — check back soon.
            </p>
            <Link
              href="/compare"
              className="inline-block bg-dark text-white font-bold px-6 py-2.5 rounded-xl hover:bg-gray-800 transition-colors text-sm"
            >
              Browse all sets →
            </Link>
          </div>
        ) : (
          <>
            <h2 className="font-heading text-dark text-3xl mb-6">
              ACTIVE DEALS ({dealSets.length} sets)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {dealSets.map((set: any) => {
                const bestPrice = {
                  id: 'deal',
                  set_id: set.id,
                  store_name: '',
                  store_url: '',
                  price_inr: set._dealPrice,
                  availability: 'in_stock' as const,
                  buy_url: '',
                  scraped_at: '',
                  is_active: true,
                };
                const priceCount = (storePrices ?? []).filter(
                  (sp) => sp.set_id === set.set_number && sp.price_inr,
                ).length;
                return (
                  <SetCard key={set.id} set={set} bestPrice={bestPrice} priceCount={priceCount} />
                );
              })}
            </div>
          </>
        )}

        <p className="text-xs text-gray-400 text-center mt-8 border-t border-border pt-4">
          Prices updated every 6 hours. Always verify the final price on the retailer&apos;s website.
          LEGO® is a trademark of The LEGO Group which does not sponsor or endorse this site.
        </p>
      </div>
    </div>
  );
}

/**
 * Fallback shown when store_prices is empty (pipeline not yet run).
 * Reads from the old prices table so the page isn't blank on first deploy.
 */
async function DealsFromLegacyPrices() {
  const supabase = createServerClient();

  const { data: setsWithPrices } = await supabase
    .from('sets')
    .select('*, prices(*)')
    .not('prices', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(48);

  const sets = (setsWithPrices || []).filter((s: any) => {
    const p = (s.prices || []).filter((x: any) => x.is_active && x.price_inr);
    return p.length > 0;
  });

  if (sets.length === 0) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="font-heading text-dark text-3xl mb-3">NO DEALS RIGHT NOW</h2>
          <p className="text-gray-400 font-body mb-4">
            Price tracking is setting up. Check back in a few hours once the first scrape completes.
          </p>
          <Link
            href="/compare"
            className="inline-block bg-dark text-white font-bold px-6 py-2.5 rounded-xl hover:bg-gray-800 transition-colors text-sm"
          >
            Browse all sets →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-primary-dark py-12 px-4">
        <div className="max-w-site mx-auto">
          <h1 className="font-heading text-white text-5xl mb-2">LEGO SETS WITH PRICES</h1>
          <p className="text-white/70">Updated price data from our tracked stores.</p>
        </div>
      </div>
      <ToycraDiscountBanner variant="compact" />
      <div className="max-w-site mx-auto px-4 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {sets.map((set: any) => {
            const prices = (set.prices || []).filter((p: any) => p.is_active && p.price_inr);
            const bestPrice = prices.sort((a: any, b: any) => a.price_inr - b.price_inr)[0] || null;
            return <SetCard key={set.id} set={set} bestPrice={bestPrice} priceCount={prices.length} />;
          })}
        </div>
      </div>
    </div>
  );
}
