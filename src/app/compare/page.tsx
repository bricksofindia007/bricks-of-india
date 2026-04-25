import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase';
import { searchSets } from '@/lib/rebrickable';
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
  searchParams: { q?: string; theme?: string; price?: string; page?: string; noPrice?: string };
}

/** Build a /compare URL, merging overrides into the current params. */
function buildUrl(
  current: Props['searchParams'],
  overrides: Partial<Props['searchParams']>,
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  if (merged.q)                           params.set('q',       merged.q);
  if (merged.theme)                       params.set('theme',   merged.theme);
  if (merged.price)                       params.set('price',   merged.price);
  if (merged.noPrice === '1')             params.set('noPrice', '1');
  if (merged.page && merged.page !== '1') params.set('page',    merged.page);
  const qs = params.toString();
  return qs ? `/compare?${qs}` : '/compare';
}

/** Strip Rebrickable variant suffix: "75192-1" → "75192" */
function stripSuffix(setNum: string): string {
  return setNum.replace(/-\d+$/, '');
}

export default async function ComparePage({ searchParams }: Props) {
  const q             = (searchParams.q ?? '').trim();
  const themeFilter   = searchParams.theme ?? '';
  const priceFilter   = searchParams.price ?? '';
  const includeNoPrice = searchParams.noPrice === '1';
  const page          = Math.max(1, parseInt(searchParams.page ?? '1'));
  const from        = (page - 1) * PAGE_SIZE;
  const to          = from + PAGE_SIZE - 1;

  let sets: any[]  = [];
  let total        = 0;
  let usedRebrickable = false;

  // ── Rebrickable-first for plain-text search (no theme/price filter) ──────────
  // Gives access to the full 170k+ Rebrickable catalogue instead of our ~756-row
  // Supabase cache. Hydrates Indian prices from Supabase for matched sets.
  const useRebrickable = !!q && !themeFilter && !priceFilter;

  if (useRebrickable) {
    try {
      const rbResult = await searchSets(q, page, PAGE_SIZE);
      if (rbResult.results.length > 0) {
        const setNumbers = rbResult.results.map((s) => stripSuffix(s.set_num));
        const supabase   = createServerClient();
        const { data: supabaseSets } = await supabase
          .from('sets')
          .select('id, set_number, lego_mrp_inr, age_range, theme, subtheme, minifigs, prices(*)')
          .in('set_number', setNumbers);

        const supabaseMap = new Map<string, any>(
          (supabaseSets ?? []).map((s) => [s.set_number, s]),
        );

        sets = rbResult.results.map((rb) => {
          const sn  = stripSuffix(rb.set_num);
          const sup = supabaseMap.get(sn);
          return {
            id:             sup?.id ?? rb.set_num,
            set_number:     sn,
            rebrickable_id: rb.set_num,
            name:           rb.name,
            year:           rb.year,
            theme:          sup?.theme ?? '',
            subtheme:       sup?.subtheme ?? null,
            pieces:         rb.num_parts ?? null,
            minifigs:       sup?.minifigs ?? null,
            image_url:      rb.set_img_url ?? null,
            description:    null,
            age_range:      sup?.age_range ?? null,
            lego_mrp_inr:   sup?.lego_mrp_inr ?? null,
            created_at:     '',
            updated_at:     '',
            prices:         sup?.prices ?? [],
          };
        });
        total           = rbResult.count;
        usedRebrickable = true;
      }
    } catch (err) {
      console.error('[Compare] Rebrickable search error — falling back to Supabase:', err);
    }
  }

  // ── Supabase path ────────────────────────────────────────────────────────────
  // Used when: theme/price filter active, Rebrickable errored, or RB returned 0.
  // Text search covers name, theme, AND set_number — fixes "q=Technic" returning
  // nothing because most Technic sets don't have "Technic" in their name.
  if (!usedRebrickable) {
    const supabase = createServerClient();
    let query = supabase
      .from('sets')
      .select('*, prices(*)', { count: 'exact' })
      .order('year', { ascending: false })
      .range(from, to);

    if (q) query = query.or(`name.ilike.%${q}%,theme.ilike.%${q}%,set_number.ilike.%${q}%`);
    if (themeFilter) query = query.ilike('theme', `%${themeFilter}%`);
    if (priceFilter) {
      const range = PRICE_RANGES.find((r) => r.label === priceFilter);
      if (range) {
        if (includeNoPrice) {
          // Include sets with no listed price alongside the filtered range
          const maxClause = range.max !== Infinity
            ? `,and(lego_mrp_inr.gte.${range.min},lego_mrp_inr.lte.${range.max})`
            : `,lego_mrp_inr.gte.${range.min}`;
          query = query.or(`lego_mrp_inr.is.null${maxClause}`);
        } else {
          query = query.gte('lego_mrp_inr', range.min);
          if (range.max !== Infinity) query = query.lte('lego_mrp_inr', range.max);
        }
      }
    }

    const { data, count } = await query;
    sets  = data ?? [];
    total = count ?? 0;
  }

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
          {priceFilter && (
            <Link
              href={buildUrl(searchParams, {
                noPrice: includeNoPrice ? undefined : '1',
                page: undefined,
              })}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${
                includeNoPrice
                  ? 'bg-dark text-white border-dark'
                  : 'bg-white text-dark border-border hover:border-dark'
              }`}
            >
              {includeNoPrice ? '+ unpriced' : 'Include unpriced'}
            </Link>
          )}
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
