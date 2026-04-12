'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { SetCard } from '@/components/sets/SetCard';
import { SearchBar } from '@/components/ui/SearchBar';
import { ToycraDiscountBanner } from '@/components/ui/ToycraDiscountBanner';
import { MASCOTS, THEMES, PRICE_RANGES } from '@/lib/brand';

const PAGE_SIZE = 24;

function ComparePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get('q') || '';
  const themeFilter = searchParams.get('theme') || '';
  const priceFilter = searchParams.get('price') || '';
  const page = parseInt(searchParams.get('page') || '1');

  const [sets, setSets] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchSets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (q) params.set('q', q);
      if (themeFilter) params.set('theme', themeFilter);
      if (priceFilter) {
        const range = PRICE_RANGES.find((r) => r.label === priceFilter);
        if (range) {
          params.set('price_min', String(range.min));
          if (range.max !== Infinity) params.set('price_max', String(range.max));
        }
      }
      const res = await fetch(`/api/sets/search?${params}`);
      if (!res.ok) throw new Error(`Search request failed: ${res.status}`);
      const data = await res.json();
      setSets(data.sets ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error('Search failed:', err);
      setSets([]);
      setTotal(0);
    }
    setLoading(false);
  }, [q, themeFilter, priceFilter, page]);

  useEffect(() => {
    fetchSets();
  }, [fetchSets]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`/compare?${params.toString()}`);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-dark py-10 px-4">
        <div className="max-w-site mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1">
              <h1 className="font-heading text-primary text-5xl md:text-6xl mb-2">COMPARE LEGO® PRICES IN INDIA</h1>
              <p className="text-gray-300 font-body">
                {total > 0 ? `${total.toLocaleString()} sets. Updated every 6 hours. Cheapest first.` : 'Search 50,000+ LEGO® sets across 8 Indian stores.'}
              </p>
            </div>
            <Image src={MASCOTS.blue.pointing} alt="Find best price" width={150} height={150} className="object-contain" />
          </div>
          <div className="mt-6 max-w-2xl">
            <SearchBar size="lg" initialValue={q} placeholder="Search by set name or number... go on then." />
          </div>
        </div>
      </div>

      <ToycraDiscountBanner variant="compact" />

      <div className="max-w-site mx-auto px-4 py-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-8">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-bold text-dark">Theme:</span>
            <button
              onClick={() => updateFilter('theme', '')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${!themeFilter ? 'bg-dark text-white border-dark' : 'bg-white text-dark border-border hover:border-dark'}`}
            >
              All
            </button>
            {THEMES.map((t) => (
              <button
                key={t.slug}
                onClick={() => updateFilter('theme', t.name)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${themeFilter === t.name ? 'bg-dark text-white border-dark' : 'bg-white text-dark border-border hover:border-dark'}`}
              >
                {t.emoji} {t.name}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center mt-2 w-full">
            <span className="text-sm font-bold text-dark">Price:</span>
            <button
              onClick={() => updateFilter('price', '')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${!priceFilter ? 'bg-dark text-white border-dark' : 'bg-white text-dark border-border hover:border-dark'}`}
            >
              Any
            </button>
            {PRICE_RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => updateFilter('price', r.label)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-colors ${priceFilter === r.label ? 'bg-dark text-white border-dark' : 'bg-white text-dark border-border hover:border-dark'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-400 font-body">Hunting for the best prices...</p>
          </div>
        ) : sets.length === 0 ? (
          <div className="text-center py-20">
            <Image src={MASCOTS.blue.confused} alt="No results" width={150} height={150} className="mx-auto mb-4 object-contain" />
            <h2 className="font-heading text-dark text-3xl mb-2">NOTHING FOUND</h2>
            <p className="text-gray-400 font-body">Even LEGO® can&apos;t build that. Try a different search.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()} sets
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {sets.map((set: any) => {
                const prices = set.prices || [];
                const activePrices = prices.filter((p: any) => p.is_active && p.price_inr);
                const bestPrice = activePrices.sort((a: any, b: any) => a.price_inr - b.price_inr)[0] || null;
                return <SetCard key={set.id} set={set} bestPrice={bestPrice} priceCount={activePrices.length} />;
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-10">
                {page > 1 && (
                  <button
                    onClick={() => updateFilter('page', String(page - 1))}
                    className="px-4 py-2 border-2 border-dark rounded-lg font-bold hover:bg-dark hover:text-white transition-colors text-sm"
                  >
                    ← Previous
                  </button>
                )}
                <span className="px-4 py-2 text-sm font-bold text-gray-500">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <button
                    onClick={() => updateFilter('page', String(page + 1))}
                    className="px-4 py-2 border-2 border-dark rounded-lg font-bold hover:bg-dark hover:text-white transition-colors text-sm"
                  >
                    Next →
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Price accuracy notice */}
      <div className="max-w-site mx-auto px-4 pb-8">
        <p className="text-xs text-gray-400 text-center border-t border-border pt-4">
          Prices updated every 6 hours. Always verify the final price on the retailer&apos;s website before purchase.
          LEGO® is a trademark of The LEGO Group which does not sponsor or endorse this site.
        </p>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-400 font-body">Loading price comparison...</p>
        </div>
      </div>
    }>
      <ComparePageInner />
    </Suspense>
  );
}
