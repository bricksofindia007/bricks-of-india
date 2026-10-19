import Link from 'next/link';
import { SetCard } from './SetCard';
import { ThemeSortSelect } from './ThemeSortSelect';
import { themeHref, type ThemeSort } from '@/lib/theme-paging';

interface ThemeGridProps {
  slug: string;
  /** The sets on this page, already sorted and sliced. */
  sets: any[];
  /** Every set in the theme, not just this page. */
  total: number;
  page: number;
  pages: number;
  sort: ThemeSort;
}

const PAGER_LINK = 'px-3 py-2 text-sm font-bold rounded-lg border border-border hover:bg-surface transition-colors';
const PAGER_CURRENT = 'px-3 py-2 text-sm font-bold rounded-lg border bg-primary text-white border-primary';
const PAGER_STEP ='px-4 py-2 text-sm font-bold rounded-lg border border-border hover:bg-surface transition-colors';
const PAGER_OFF = 'px-4 py-2 text-sm font-bold rounded-lg border border-border opacity-40 cursor-not-allowed';

export function ThemeGrid({ slug, sets, total, page, pages, sort }: ThemeGridProps) {
  const processed = sets.map((set) => {
    const prices = (set.prices || []).filter((p: any) => p.is_active && p.price_inr);
    const bestPrice = prices.sort((a: any, b: any) => a.price_inr - b.price_inr)[0] || null;
    return { set, bestPrice, priceCount: prices.length };
  });

  // Page numbers shown: up to two either side of the current page, with the first and last always reachable.
  const from = Math.max(1, page - 2);
  const to = Math.min(pages, page + 2);
  const numbers: number[] = [];
  for (let n = from; n <= to; n++) numbers.push(n);
  const href = (n: number) => themeHref(slug, { page: n, sort });

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-text-secondary text-sm">
          {total} set{total !== 1 ? 's' : ''} found
          {pages > 1 && <span className="ml-1">— page {page} of {pages}</span>}
        </p>
        <ThemeSortSelect slug={slug} sort={sort} />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
        {processed.map(({ set, bestPrice, priceCount }) => (
          <SetCard key={set.id} set={set} bestPrice={bestPrice} priceCount={priceCount} summary={set.summary ?? null} />
        ))}
      </div>

      {/* Pager: plain links, so every page can be reached without script. */}
      {pages > 1 && (
        <nav aria-label="Pages of sets" className="flex items-center justify-center gap-2 flex-wrap">
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev" className={PAGER_STEP}>Previous</Link>
          ) : (
            <span aria-disabled="true" className={PAGER_OFF}>Previous</span>
          )}

          {from > 1 && (
            <>
              <Link href={href(1)} className={PAGER_LINK}>1</Link>
              {from > 2 && <span className="text-text-secondary px-1">...</span>}
            </>
          )}

          {numbers.map((n) =>
            n === page ? (
              <span key={n} aria-current="page" className={PAGER_CURRENT}>{n}</span>
            ) : (
              <Link key={n} href={href(n)} className={PAGER_LINK}>{n}</Link>
            ),
          )}

          {to < pages && (
            <>
              {to < pages - 1 && <span className="text-text-secondary px-1">...</span>}
              <Link href={href(pages)} className={PAGER_LINK}>{pages}</Link>
            </>
          )}

          {page < pages ? (
            <Link href={href(page + 1)} rel="next" className={PAGER_STEP}>Next</Link>
          ) : (
            <span aria-disabled="true" className={PAGER_OFF}>Next</span>
          )}
        </nav>
      )}
    </>
  );
}
