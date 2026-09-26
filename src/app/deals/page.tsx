import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/metadata';
import { createServerClient } from '@/lib/supabase';
import { READ_REVALIDATE_SECONDS, PRICE_CADENCE } from '@/lib/price-freshness';
import { getDeals } from '@/lib/price-summary';
import { SetCard } from '@/components/sets/SetCard';
import { ToycraDiscountBanner } from '@/components/ui/ToycraDiscountBanner';
import { MASCOTS } from '@/lib/brand';
import { TaglineWink } from '@/components/ui/Taglines';

export const metadata: Metadata = buildMetadata({
  title: 'Best LEGO Deals in India Right Now',
  description: 'Current best LEGO prices across all Indian stores. Price drops, exclusive codes, and the sets worth buying right now.',
  path: '/deals',
});

export const revalidate = 3600; // = READ_REVALIDATE_SECONDS (segment config must be a literal)
// Supabase reads here expire hourly via per-read `next.revalidate`
// (supabaseRead / createServerClient({ revalidate }) -- src/lib/supabase.ts),
// NOT fetchCache='default-cache', which cached them until the next deploy.

// PR-B (2026-09-26): deals follow the locked rules, computed once in the
// public.set_price_summary view (see src/lib/price-summary.ts):
//   R2 MRP anchor: MyBrickHouse displayed MRP -> Toycra displayed MRP ->
//      verified catalogue MRP -> none (never a deal).
//   R3 deal = fresh (<= 12h) in-stock listed price >= 10% below the anchor;
//      hot deal >= 20%. No coupon (ABHINAV12 or any other) is ever applied.
// Replaces the 30-day-average rule, which read store_prices (1,884 rows) and
// price_history (167k rows in 30 days) without pagination -- PostgREST
// returned 1,000 of each, so the averages were computed from a fragment --
// plus an MSRP x 1.35 "fallback" that called above-MRP prices deals.
export default async function DealsPage() {
  const supabase = createServerClient({ revalidate: READ_REVALIDATE_SECONDS });
  const deals = await getDeals(supabase);

  const setsById = new Map<string, any>();
  const ids = deals.map((d) => d.set_id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase
      .from('sets')
      .select('id, set_number, name, theme, year, pieces, image_url, age_range, lego_mrp_inr, mrp_verified')
      .in('set_number', ids.slice(i, i + 150));
    for (const row of data ?? []) setsById.set(row.set_number, row);
  }
  const withSet = deals.filter((d) => setsById.has(d.set_id));
  const hotDeals = withSet.filter((d) => d.deal_tier === 'hot');
  const plainDeals = withSet.filter((d) => d.deal_tier === 'deal');

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-primary-dark py-12 px-4">
        <div className="max-w-site mx-auto flex items-center gap-6">
          <div className="flex-1">
            <h1 className="font-heading text-white text-6xl mb-2">BEST LEGO DEALS IN INDIA</h1>
            <p className="text-white/70 font-body text-lg mb-2">
              Every set at least 10% below its MRP right now, at the price the store lists — no coupon applied.
              Prices checked {PRICE_CADENCE}.
              Your wallet is about to have a very complicated day.
            </p>
            <p className="mt-1">
              <TaglineWink />
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

        {withSet.length === 0 ? (
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
              No set is currently 10% or more below its MRP at a store that has it in stock.
              Prices are checked {PRICE_CADENCE} — check back soon.
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
            {[
              { title: 'HOT DEALS', sub: '20% or more below MRP', list: hotDeals },
              { title: 'DEALS', sub: '10–20% below MRP', list: plainDeals },
            ].filter((g) => g.list.length > 0).map((g) => (
              <section key={g.title} className="mb-10">
                <h2 className="font-heading text-dark text-3xl mb-1">
                  {g.title} ({g.list.length} sets)
                </h2>
                <p className="text-sm text-gray-500 mb-6">{g.sub} · MRP = MyBrickHouse&apos;s listed MRP, else Toycra&apos;s, else the verified LEGO India MRP</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {g.list.map((d) => (
                    <SetCard
                      key={d.set_id}
                      set={setsById.get(d.set_id)}
                      bestPrice={{ price_inr: d.best_price_inr, in_stock: true, scraped_at: d.best_scraped_at }}
                      summary={d}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}

        <p className="text-xs text-gray-400 text-center mt-8 border-t border-border pt-4">
          Prices updated {PRICE_CADENCE}. Always verify the final price on the retailer&apos;s website.
          LEGO® is a trademark of The LEGO Group which does not sponsor or endorse this site.
        </p>
      </div>
    </div>
  );
}
