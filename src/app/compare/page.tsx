import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase';
import { SetCard } from '@/components/sets/SetCard';
import { SearchBar } from '@/components/ui/SearchBar';
import { ToycraDiscountBanner } from '@/components/ui/ToycraDiscountBanner';
import { MASCOTS, THEMES, PRICE_RANGES } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Compare LEGO Prices in India | Bricks of India',
  description: 'Compare LEGO set prices across Toycra, MyBrickHouse, Jaiman Toys and more. Updated every 6 hours. Find the best deal in India.',
  alternates: { canonical: 'https://bricksofindia.com/compare' },
};

const PAGE_SIZE = 24;

interface Props {
  searchParams: { q?: string; theme?: string; price?: string; page?: string };
}

/** Build a /compare URL, merging overrides into the current params. */
function buildUrl(
  current: Props['searchParams'],
  overrides: Partial<Props['searchParams']>,
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  if (merged.q)     params.set('q',     merged.q);
  if (merged.theme) params.set('theme', merged.theme);
  if (merged.price) params.set('price', merged.price);
  if (merged.page && merged.page !== '1') params.set('page', merged.page);
  const qs = params.toString();
  return qs ? `/compare?${qs}` : '/compare';
}

export default async function ComparePage({ searchParams }: Props) {
  const q           = (searchParams.q ?? '').trim();
  const themeFilter = searchParams.theme ?? '';
  const priceFilter = searchParams.price ?? '';
  const page        = Math.max(1, parseInt(searchParams.page ?? '1'));
  const from        = (page - 1) * PAGE_SIZE;
  const to          = from + PAGE_SIZE - 1;

  const supabase = createServerClient();

  let query = supabase
    .from('sets')
    .select('*, prices(*)', { count: 'exact' })
    .order('year', { ascending: false })
    .range(from, to);

  if (q)           query = query.or(`name.ilike.%${q}%,set_number.ilike.%${q}%`);
  if (themeFilter) query = query.ilike('theme', `%${themeFilter}%`);
  if (priceFilter) {
    const range = PRICE_RANGES.find((r) => r.label === priceFilter);
    if (range) {
      query = query.gte('lego_mrp_inr', range.min);
      if (range.max !== Infinity) query = query.lte('lego_mrp_inr', range.max);
    }
  }

  const { data: sets, count } = await query;
  const total      = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-dark py-10 px-4">
        <div className="max-w-site mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1">
              <h1 className="font-heading text-primary text-5xl md:text-6xl mb-2">
                COMPARE LEGO PRICES IN INDIA
              </h1>
              <p className="text-gray-300 font-body">
                {total > 0
                  ? `${total.toLocaleString()} sets. Updated every 6 hours. Cheapest first.`
                  : 'Search LEGO sets across Toycra, MyBrickHouse, Jaiman Toys and more.'}
              </p>
            </div>
            <Image
              src={MASCOTS.blue.pointing}
              alt="Find best price"
              width={150}
              height={150}
              className="object-contain"
            />
          </div>
          <div className="mt-6 max-w-2xl">
            <SearchBar size="lg" initialValue={q} placeholder="Search by set name or number... go on then." />
          </div>
        </div>
      </div>

      <ToycraDiscountBanner variant="compact" />

      <div className="max-w-site mx-auto px-4 py-8">
        {/* ── Theme filters ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 items-center mb-4">
          <span className="text-sm font-bold text-dark">Theme:</span>
          <Link
            href={buildUrl(searchParams, { theme: undefined, page: undefined })}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
              !themeFilter ? 'bg-dark text-white border-dark' : 'bg-white text-dark border-border hover:border-dark'
            }`}
          >
            All
          </Link>
          {THEMES.map((t) => (
            <Link
              key={t.slug}
              href={buildUrl(searchParams, {
                theme: themeFilter === t.name ? undefined : t.name,
                page: undefined,
              })}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
                themeFilter === t.name
                  ? 'bg-dark text-white border-dark'
                  : 'bg-white text-dark border-border hover:border-dark'
              }`}
            >
              {t.emoji} {t.name}
            </Link>
          ))}
        </div>

        {/* ── Price filters ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 items-center mb-8">
          <span className="text-sm font-bold text-dark">Price:</span>
          <Link
            href={buildUrl(searchParams, { price: undefined, page: undefined })}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
              !priceFilter ? 'bg-dark text-white border-dark' : 'bg-white text-dark border-border hover:border-dark'
            }`}
          >
            Any
          </Link>
          {PRICE_RANGES.map((r) => (
            <Link
              key={r.label}
              href={buildUrl(searchParams, {
                price: priceFilter === r.label ? undefined : r.label,
                page: undefined,
              })}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
                priceFilter === r.label
                  ? 'bg-dark text-white border-dark'
                  : 'bg-white text-dark border-border hover:border-dark'
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>

        {/* ── Results ───────────────────────────────────────────────────── */}
        {!sets || sets.length === 0 ? (
          <div className="text-center py-20">
            <Image
              src={MASCOTS.blue.confused}
              alt="No results"
              width={150}
              height={150}
              className="mx-auto mb-4 object-contain"
            />
            <h2 className="font-heading text-dark text-3xl mb-2">
              {q || themeFilter || priceFilter ? 'NOTHING FOUND' : 'NO SETS TRACKED YET'}
            </h2>
            <p className="text-gray-400 font-body">
              {q || themeFilter || priceFilter
                ? 'Try a different search or filter.'
                : 'Set inventory is synced from Rebrickable. Check back shortly.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                Showing {from + 1}–{Math.min(to + 1, total)} of {total.toLocaleString()} sets
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {(sets ?? []).map((set: any) => {
                const prices = (set.prices || []).filter((p: any) => p.is_active && p.price_inr);
                const bestPrice = prices.sort((a: any, b: any) => a.price_inr - b.price_inr)[0] || null;
                return (
                  <SetCard key={set.id} set={set} bestPrice={bestPrice} priceCount={prices.length} />
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-10 flex-wrap">
                {page > 1 && (
                  <Link
                    href={buildUrl(searchParams, { page: String(page - 1) })}
                    className="px-4 py-2 border-2 border-dark rounded-lg font-bold hover:bg-dark hover:text-white transition-colors text-sm"
                  >
                    ← Previous
                  </Link>
                )}
                <span className="px-4 py-2 text-sm font-bold text-gray-500">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={buildUrl(searchParams, { page: String(page + 1) })}
                    className="px-4 py-2 border-2 border-dark rounded-lg font-bold hover:bg-dark hover:text-white transition-colors text-sm"
                  >
                    Next →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="max-w-site mx-auto px-4 pb-8">
        <p className="text-xs text-gray-400 text-center border-t border-border pt-4">
          Prices updated every 6 hours. Always verify the final price on the retailer&apos;s website before purchase.
          LEGO® is a trademark of The LEGO Group which does not sponsor or endorse this site.
        </p>
      </div>
    </div>
  );
}
