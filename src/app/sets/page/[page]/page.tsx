import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { SetCard } from '@/components/sets/SetCard';
import { MASCOTS } from '@/lib/brand';
import { JsonLd } from '@/components/JsonLd';
import { buildItemListSchema } from '@/lib/schemas';

const PAGE_SIZE = 48;

interface Props {
  params: { page: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = parseInt(params.page);
  return {
    title: `All LEGO Sets — Page ${p} | Bricks of India`,
    alternates: { canonical: `https://bricksofindia.com/sets/page/${p}` },
  };
}

export default async function SetsPageN({ params }: Props) {
  const page = parseInt(params.page);
  if (isNaN(page) || page < 2) notFound();

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = createServerClient();

  const { data: sets, count } = await supabase
    .from('sets')
    .select(
      `id, set_number, name, theme, year, pieces, minifigs,
       image_url, age_range, lego_mrp_inr,
       prices(id, price_inr, store_name, availability, buy_url, is_active)`,
      { count: 'exact' },
    )
    .order('year', { ascending: false })
    .order('set_number', { ascending: false })
    .range(from, to);

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (page > totalPages && totalPages > 0) notFound();

  const listItems = (sets ?? []).map((set: any) => {
    const activePrices = (set.prices ?? []).filter((p: any) => p.is_active && p.price_inr);
    const bestPrice = activePrices.sort((a: any, b: any) => a.price_inr - b.price_inr)[0] ?? null;
    return { name: set.name, set_number: set.set_number, image_url: set.image_url, bestPrice };
  });

  return (
    <div className="bg-white min-h-screen">
      <JsonLd
        data={buildItemListSchema(
          `LEGO Sets — Page ${page} — Bricks of India`,
          total,
          listItems,
          from + 1,
        )}
      />

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
        <p className="text-sm text-gray-500 mb-6">
          Showing {from + 1}–{Math.min(to + 1, total)} of {total.toLocaleString()} sets · Page{' '}
          {page} of {totalPages}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {(sets ?? []).map((set: any) => {
            const activePrices = (set.prices ?? []).filter(
              (p: any) => p.is_active && p.price_inr,
            );
            const bestPrice =
              activePrices.sort((a: any, b: any) => a.price_inr - b.price_inr)[0] ?? null;
            return (
              <SetCard
                key={set.id}
                set={set}
                bestPrice={bestPrice}
                priceCount={activePrices.length}
              />
            );
          })}
        </div>

        <div className="flex justify-center gap-2 mt-10 flex-wrap">
          <Link
            href={page === 2 ? '/sets' : `/sets/page/${page - 1}`}
            className="px-4 py-2 border-2 border-dark rounded-lg font-bold hover:bg-dark hover:text-white transition-colors text-sm"
          >
            ← Previous
          </Link>
          <span className="px-4 py-2 text-sm font-bold text-gray-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/sets/page/${page + 1}`}
              className="px-4 py-2 border-2 border-dark rounded-lg font-bold hover:bg-dark hover:text-white transition-colors text-sm"
            >
              Next →
            </Link>
          )}
        </div>
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
