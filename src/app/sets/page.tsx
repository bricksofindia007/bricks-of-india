import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createServerClient } from '@/lib/supabase';
import { SetCard } from '@/components/sets/SetCard';
import { MASCOTS } from '@/lib/brand';
import { JsonLd } from '@/components/JsonLd';
import { buildItemListSchema } from '@/lib/schemas';

export const metadata: Metadata = {
  title: 'All LEGO Sets in India | Bricks of India',
  description:
    'Browse every LEGO set available in India. Compare prices across Toycra, MyBrickHouse, Jaiman Toys and more. Updated regularly.',
  alternates: { canonical: 'https://bricksofindia.com/sets' },
};

const PAGE_SIZE = 48;

export default async function SetsPage() {
  const supabase = createServerClient();

  const { data: sets, count } = await supabase
    .from('sets')
    .select(
      `id, set_number, name, theme, year, pieces, minifigs,
       image_url, age_range, lego_mrp_inr`,
      { count: 'exact' },
    )
    .order('year', { ascending: false })
    .order('set_number', { ascending: false })
    .range(0, PAGE_SIZE - 1);

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Fetch live store prices for this page's sets
  const setNumbers = (sets ?? []).map((s: any) => s.set_number);
  const { data: storePrices } = setNumbers.length
    ? await supabase
        .from('store_prices')
        .select('set_id, store_id, price_inr, in_stock, product_url')
        .in('set_id', setNumbers)
    : { data: [] };

  // Build map: set_number → cheapest in-stock price row
  const priceMap: Record<string, { price_inr: number; store_name: string; buy_url: string | null }> = {};
  for (const row of storePrices ?? []) {
    const existing = priceMap[row.set_id];
    if (!existing || row.price_inr < existing.price_inr) {
      priceMap[row.set_id] = {
        price_inr: row.price_inr,
        store_name: row.store_id,
        buy_url: row.product_url ?? null,
      };
    }
  }

  const listItems = (sets ?? []).map((set: any) => {
    const best = priceMap[set.set_number] ?? null;
    return { name: set.name, set_number: set.set_number, image_url: set.image_url, bestPrice: best };
  });

  return (
    <div className="bg-white min-h-screen">
      <JsonLd data={buildItemListSchema('LEGO Sets — Bricks of India', total, listItems)} />

      <div className="bg-dark py-10 px-4">
        <div className="max-w-site mx-auto flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1">
            <h1 className="font-heading text-primary text-5xl md:text-6xl mb-2">ALL LEGO SETS</h1>
            <p className="text-gray-300 font-body">
              Browse every set in our India catalogue — {total.toLocaleString()} sets
            </p>
          </div>
          <Image
            src={MASCOTS.blue.pointing}
            alt="Browse LEGO sets"
            width={150}
            height={150}
            className="object-contain hidden md:block"
          />
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-8">
        {!sets || sets.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-heading text-dark text-3xl">NO SETS FOUND</p>
            <p className="text-gray-400 font-body mt-2">
              Set inventory is synced from Rebrickable. Check back shortly.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-6">
              Showing 1–{Math.min(PAGE_SIZE, total)} of {total.toLocaleString()} sets
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {sets.map((set: any) => {
                const bestPrice = priceMap[set.set_number] ?? null;
                return (
                  <SetCard
                    key={set.id}
                    set={set}
                    bestPrice={bestPrice}
                    priceCount={bestPrice ? 1 : 0}
                  />
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-10 flex-wrap">
                <span className="px-4 py-2 text-sm font-bold text-gray-500">
                  Page 1 of {totalPages}
                </span>
                <Link
                  href="/sets/page/2"
                  className="px-4 py-2 border-2 border-dark rounded-lg font-bold hover:bg-dark hover:text-white transition-colors text-sm"
                >
                  Next →
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      <div className="max-w-site mx-auto px-4 pb-8">
        <p className="text-xs text-gray-400 text-center border-t border-border pt-4">
          Prices updated every 6 hours. Always verify the final price on the retailer&apos;s website
          before purchase. LEGO® is a trademark of The LEGO Group which does not sponsor or endorse
          this site.
        </p>
      </div>
    </div>
  );
}
