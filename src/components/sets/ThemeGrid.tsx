'use client';

import { useState, useMemo, useEffect } from 'react';
import { SetCard } from './SetCard';

type SortKey = 'price-asc' | 'price-desc' | 'year-desc' | 'year-asc' | 'pieces-desc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'price-asc',   label: 'Price: Low to High' },
  { value: 'price-desc',  label: 'Price: High to Low' },
  { value: 'year-desc',   label: 'Newest First' },
  { value: 'year-asc',    label: 'Oldest First' },
  { value: 'pieces-desc', label: 'Most Pieces' },
];

const PAGE_SIZE = 48;

interface ThemeGridProps {
  sets: any[];
}

export function ThemeGrid({ sets }: ThemeGridProps) {
  const [sort, setSort] = useState<SortKey>('year-desc');
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever sort changes
  useEffect(() => { setPage(1); }, [sort]);

  const processed = useMemo(() => {
    return sets.map((set) => {
      const prices = (set.prices || []).filter((p: any) => p.is_active && p.price_inr);
      const bestPrice = prices.sort((a: any, b: any) => a.price_inr - b.price_inr)[0] || null;
      return { set, bestPrice, priceCount: prices.length };
    });
  }, [sets]);

  const sorted = useMemo(() => {
    const copy = [...processed];
    switch (sort) {
      case 'price-asc':
        return copy.sort((a, b) => {
          const ap = a.bestPrice?.price_inr ?? Infinity;
          const bp = b.bestPrice?.price_inr ?? Infinity;
          return ap - bp;
        });
      case 'price-desc':
        return copy.sort((a, b) => {
          const ap = a.bestPrice?.price_inr ?? 0;
          const bp = b.bestPrice?.price_inr ?? 0;
          return bp - ap;
        });
      case 'year-asc':
        return copy.sort((a, b) => (a.set.year ?? 0) - (b.set.year ?? 0));
      case 'year-desc':
        return copy.sort((a, b) => (b.set.year ?? 0) - (a.set.year ?? 0));
      case 'pieces-desc':
        return copy.sort((a, b) => (b.set.num_parts ?? 0) - (a.set.num_parts ?? 0));
      default:
        return copy;
    }
  }, [processed, sort]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Page number range to show (up to 5 around current page)
  const pageNumbers = useMemo(() => {
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
      range.push(i);
    }
    return range;
  }, [page, totalPages]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-text-secondary text-sm">
          {sorted.length} set{sorted.length !== 1 ? 's' : ''} found
          {totalPages > 1 && (
            <span className="ml-1">— page {page} of {totalPages}</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="theme-sort" className="text-sm font-bold text-dark shrink-0">
            Sort by:
          </label>
          <select
            id="theme-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-white text-dark focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
        {paginated.map(({ set, bestPrice, priceCount }) => (
          <SetCard key={set.id} set={set} bestPrice={bestPrice} priceCount={priceCount} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm font-bold rounded-lg border border-border hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>

          {pageNumbers[0] > 1 && (
            <>
              <button onClick={() => setPage(1)} className="px-3 py-2 text-sm font-bold rounded-lg border border-border hover:bg-surface transition-colors">1</button>
              {pageNumbers[0] > 2 && <span className="text-text-secondary px-1">...</span>}
            </>
          )}

          {pageNumbers.map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`px-3 py-2 text-sm font-bold rounded-lg border transition-colors ${
                n === page
                  ? 'bg-primary text-white border-primary'
                  : 'border-border hover:bg-surface'
              }`}
            >
              {n}
            </button>
          ))}

          {pageNumbers[pageNumbers.length - 1] < totalPages && (
            <>
              {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span className="text-text-secondary px-1">...</span>}
              <button onClick={() => setPage(totalPages)} className="px-3 py-2 text-sm font-bold rounded-lg border border-border hover:bg-surface transition-colors">{totalPages}</button>
            </>
          )}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 text-sm font-bold rounded-lg border border-border hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
