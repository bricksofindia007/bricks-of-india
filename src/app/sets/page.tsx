import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { unstable_cache } from 'next/cache';
import { createServerClient } from '@/lib/supabase';
import { SetCard } from '@/components/sets/SetCard';
import { MASCOTS, THEMES } from '@/lib/brand'; // THEMES used as fallback only
import { JsonLd } from '@/components/JsonLd';
import { buildItemListSchema } from '@/lib/schemas';

export const metadata: Metadata = {
  title: 'All LEGO Sets in India | Bricks of India',
  description:
    'Browse every LEGO set available in India. Filter by theme, price, and availability. ' +
    'Compare prices across Toycra and MyBrickHouse. Updated every 6 hours.',
  alternates: { canonical: 'https://bricksofindia.com/sets' },
};

const PAGE_SIZE = 48;

type SortKey = 'newest' | 'price_asc' | 'price_desc' | 'pieces';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest',     label: 'Newest' },
  { value: 'price_asc',  label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'pieces',     label: 'Most Pieces' },
];

const PRICE_BANDS: Record<string, { min: number; max: number; label: string }> = {
  under2k: { min: 0,     max: 1999,    label: 'Under ₹2,000' },
  '2k5k':  { min: 2000,  max: 4999,    label: '₹2,000–5,000' },
  '5k10k': { min: 5000,  max: 9999,    label: '₹5,000–10,000' },
  '10k':   { min: 10000, max: 9_999_999, label: '₹10,000+' },
};

interface Props {
  searchParams: {
    page?:    string;
    theme?:   string;
    sort?:    string;
    instock?: string;
    price?:   string;
  };
}

function buildUrl(
  base: Props['searchParams'],
  override: Partial<Props['searchParams']>,
): string {
  const merged = { ...base, ...override };
  const p = new URLSearchParams();
  if (merged.theme)                p.set('theme',   merged.theme);
  if (merged.sort && merged.sort !== 'newest') p.set('sort', merged.sort);
  if (merged.instock === '1')      p.set('instock', '1');
  if (merged.price)                p.set('price',   merged.price);
  if (merged.page && merged.page !== '1') p.set('page', merged.page);
  const qs = p.toString();
  return qs ? `/sets?${qs}` : '/sets';
}

// Netlify credit audit (2026-08-29): this ran a full paginated scan of
// store_prices (every row, every store) on EVERY /sets request regardless
// of which filters were active — filters only ever sort/slice the
// already-fully-fetched priceMap afterward (isPriceMode branch below), and
// the no-filter path never touched allPrices for its own query but still
// paid to fetch it for the per-card best-price badges. Same root pattern
// as the already-fixed /lab/price-drops bug (2026-08-15, see that file's
// comment) — the fetch is decoupled from searchParams and cached here.
// Revalidate matches store_prices' real write cadence: scrape-prices.yml's
// `0 */6 * * *` cron — same real cadence already derived for
// /lab/price-drops, not copied from /deals's unrelated 6h value.
type PriceRow = {
  set_id: string; price_inr: number;
  in_stock: boolean; store_id: string; product_url: string | null;
};
const getAllSetsStorePrices = unstable_cache(
  async (): Promise<PriceRow[]> => {
    const supabase = createServerClient();
    const allPrices: PriceRow[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data } = await supabase
        .from('store_prices')
        .select('set_id, price_inr, in_stock, store_id, product_url')
        .range(offset, offset + 999);
      if (!data || data.length === 0) break;
      allPrices.push(...(data as PriceRow[]));
      if (data.length < 1000) break;
    }
    return allPrices;
  },
  ['sets-page-all-store-prices'],
  { revalidate: 21600 }, // 6h — matches scrape-prices.yml
);

export default async function SetsPage({ searchParams }: Props) {
  const supabase    = createServerClient();
  const pageNum     = Math.max(1, parseInt(searchParams.page || '1') || 1);
  const themeFilter = searchParams.theme || '';
  const sortKey     = (searchParams.sort || 'newest') as SortKey;
  const instockOnly = searchParams.instock === '1';
  const priceBand   = PRICE_BANDS[searchParams.price || ''] ?? null;
  const from        = (pageNum - 1) * PAGE_SIZE;

  const isPriceMode =
    instockOnly || !!priceBand || sortKey === 'price_asc' || sortKey === 'price_desc';

  // ── 0. Distinct themes for dropdown (RPC, fallback to curated list) ───────
  let themes: string[];
  try {
    const { data, error } = await supabase.rpc('get_distinct_themes');
    if (error) throw error;
    themes = ((data ?? []) as { theme: string }[]).map(r => r.theme).filter(Boolean);
    if (themes.length === 0) throw new Error('RPC returned empty list');
  } catch {
    themes = THEMES.map(t => t.name);
  }

  // ── 1. All store_prices (filtering + card display) ────────────────────────
  const allPrices = await getAllSetsStorePrices();

  // Best-price map: one row per set (in-stock preferred, then cheapest)
  const priceMap: Record<string, {
    price_inr: number; store_name: string; buy_url: string | null; in_stock: boolean;
  }> = {};
  for (const p of allPrices) {
    const ex = priceMap[p.set_id];
    const better =
      !ex ||
      (p.in_stock && !ex.in_stock) ||
      (p.in_stock === ex.in_stock && p.price_inr < ex.price_inr);
    if (better) {
      priceMap[p.set_id] = {
        price_inr: p.price_inr, store_name: p.store_id,
        buy_url: p.product_url ?? null, in_stock: p.in_stock,
      };
    }
  }

  // ── 2. Resolve the page of sets ───────────────────────────────────────────
  let sets: any[] = [];
  let total = 0;

  if (isPriceMode) {
    // Work from the price side: filter → sort → paginate IDs → fetch sets
    let entries = Object.entries(priceMap);
    if (instockOnly) entries = entries.filter(([, v]) => v.in_stock);
    if (priceBand)   entries = entries.filter(
      ([, v]) => v.price_inr >= priceBand.min && v.price_inr <= priceBand.max
    );
    if (sortKey === 'price_asc')  entries.sort((a, b) => a[1].price_inr - b[1].price_inr);
    if (sortKey === 'price_desc') entries.sort((a, b) => b[1].price_inr - a[1].price_inr);

    let allIds = entries.map(([id]) => id);

    // Intersect with theme if active
    if (themeFilter && allIds.length > 0) {
      const themeNums = new Set<string>();
      for (let offset = 0; ; offset += 1000) {
        const { data } = await supabase
          .from('sets').select('set_number').eq('theme', themeFilter)
          .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        for (const r of data as { set_number: string }[]) themeNums.add(r.set_number);
        if (data.length < 1000) break;
      }
      allIds = allIds.filter(id => themeNums.has(id));
    }

    total = allIds.length;
    const pageIds = allIds.slice(from, from + PAGE_SIZE);

    if (pageIds.length > 0) {
      const { data } = await supabase
        .from('sets')
        .select('id, set_number, name, theme, year, pieces, image_url, age_range, lego_mrp_inr, mrp_verified')
        .in('set_number', pageIds);
      const byNum = new Map((data ?? []).map((s: any) => [s.set_number, s]));
      sets = pageIds.map(id => byNum.get(id)).filter(Boolean);
    }

  } else {
    // DB sort: newest or pieces — Supabase handles ordering and pagination
    let q = supabase
      .from('sets')
      .select(
        'id, set_number, name, theme, year, pieces, image_url, age_range, lego_mrp_inr, mrp_verified',
        { count: 'exact' },
      );

    if (themeFilter) q = q.eq('theme', themeFilter);

    q = sortKey === 'pieces'
      ? q.order('pieces', { ascending: false, nullsFirst: false })
      : q.order('year', { ascending: false }).order('set_number', { ascending: false });

    const { data, count } = await q.range(from, from + PAGE_SIZE - 1);
    sets  = data ?? [];
    total = count ?? 0;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const listItems = sets.map((s: any) => ({
    name: s.name, set_number: s.set_number,
    image_url: s.image_url, bestPrice: priceMap[s.set_number] ?? null,
  }));

  const activeFilters = [
    themeFilter,
    instockOnly ? '1' : '',
    searchParams.price || '',
    sortKey !== 'newest' ? sortKey : '',
  ].filter(Boolean).length;

  return (
    <div className="bg-white min-h-screen">
      <JsonLd data={buildItemListSchema('LEGO Sets — Bricks of India', total, listItems, from + 1)} />

      {/* ── Header ── */}
      <div className="bg-dark py-10 px-4">
        <div className="max-w-site mx-auto flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1">
            <h1 className="font-heading text-primary text-5xl md:text-6xl mb-2">ALL LEGO SETS</h1>
            <p className="text-gray-300 font-body">
              {themeFilter ? `${themeFilter} · ` : ''}
              {total.toLocaleString()} sets{instockOnly ? ' in stock' : ''}
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

      <div className="max-w-site mx-auto px-4 py-6">

        {/* ── Filter bar ── */}
        <form method="get" action="/sets" className="bg-gray-50 border border-border rounded-xl p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-end">

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Theme</label>
              <select
                name="theme"
                defaultValue={themeFilter}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-white font-body min-w-[150px]"
              >
                <option value="">All Themes</option>
                {themes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sort by</label>
              <select
                name="sort"
                defaultValue={sortKey}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-white font-body min-w-[170px]"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Price</label>
              <select
                name="price"
                defaultValue={searchParams.price || ''}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-white font-body min-w-[160px]"
              >
                <option value="">Any Price</option>
                {Object.entries(PRICE_BANDS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Stock</label>
              <label className="flex items-center gap-2 border border-border rounded-lg px-3 bg-white cursor-pointer text-sm font-body h-[38px]">
                <input
                  type="checkbox"
                  name="instock"
                  value="1"
                  defaultChecked={instockOnly}
                  className="accent-[#F7A800] w-4 h-4"
                />
                In stock only
              </label>
            </div>

            <div className="flex gap-2 items-end">
              <button
                type="submit"
                className="px-5 py-2 bg-[#F7A800] text-[#0F2D6B] font-bold rounded-lg text-sm hover:brightness-95 transition-all"
              >
                Apply
              </button>
              {activeFilters > 0 && (
                <Link
                  href="/sets"
                  className="px-4 py-2 border border-border rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors font-body"
                >
                  Clear{activeFilters > 1 ? ` (${activeFilters})` : ''}
                </Link>
              )}
            </div>
          </div>
        </form>

        {/* ── Results summary ── */}
        <p className="text-sm text-gray-500 mb-4">
          {sets.length === 0
            ? 'No sets match your filters.'
            : `Showing ${from + 1}–${Math.min(from + sets.length, total)} of ${total.toLocaleString()} sets`}
          {totalPages > 1 && ` · Page ${pageNum} of ${totalPages}`}
        </p>

        {/* ── Grid ── */}
        {sets.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-heading text-dark text-3xl mb-2">NO SETS FOUND</p>
            <p className="text-gray-400 font-body mb-4">Try loosening your filters.</p>
            <Link
              href="/sets"
              className="inline-block px-6 py-2 bg-dark text-white font-bold rounded-lg text-sm"
            >
              Clear all filters
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {sets.map((set: any) => (
              <SetCard
                key={set.id}
                set={set}
                bestPrice={priceMap[set.set_number] ?? null}
                priceCount={priceMap[set.set_number] ? 1 : 0}
              />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-10 flex-wrap">
            {pageNum > 1 && (
              <Link
                href={buildUrl(searchParams, { page: String(pageNum - 1) })}
                className="px-4 py-2 border-2 border-dark rounded-lg font-bold hover:bg-dark hover:text-white transition-colors text-sm"
              >
                ← Prev
              </Link>
            )}

            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const n =
                totalPages <= 7          ? i + 1 :
                pageNum   <= 4           ? i + 1 :
                pageNum   >= totalPages - 3 ? totalPages - 6 + i :
                                           pageNum - 3 + i;
              return (
                <Link
                  key={n}
                  href={buildUrl(searchParams, { page: String(n) })}
                  className={`px-4 py-2 border-2 rounded-lg font-bold text-sm transition-colors ${
                    n === pageNum
                      ? 'border-[#F7A800] bg-[#F7A800] text-[#0F2D6B]'
                      : 'border-dark hover:bg-dark hover:text-white'
                  }`}
                >
                  {n}
                </Link>
              );
            })}

            {pageNum < totalPages && (
              <Link
                href={buildUrl(searchParams, { page: String(pageNum + 1) })}
                className="px-4 py-2 border-2 border-dark rounded-lg font-bold hover:bg-dark hover:text-white transition-colors text-sm"
              >
                Next →
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="max-w-site mx-auto px-4 pb-8">
        <p className="text-xs text-gray-400 text-center border-t border-border pt-4">
          Prices updated every 6 hours. Always verify the final price on the retailer&apos;s website
          before purchase. LEGO® is a trademark of The LEGO Group which does not sponsor or
          endorse this site.
        </p>
      </div>
    </div>
  );
}
