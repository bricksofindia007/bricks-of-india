// Paging and sorting for a theme page. The rules are the ones the theme grid used on the client (sort order, the
// two-query merge), moved to the server so every set in the theme is reachable, not just the first 200.
// The page reads ?page=N and ?sort=… the same way /sets does.

export const THEME_PAGE_SIZE = 48;

export const THEME_SORT_OPTIONS = [
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'year-desc', label: 'Newest First' },
  { value: 'year-asc', label: 'Oldest First' },
] as const;
// "Most Pieces" is not offered: the set rows have no parts count, so the option could not sort anything. Old links
// that still say pieces-desc fall back to Newest First, the same as any unknown sort.

export type ThemeSort = (typeof THEME_SORT_OPTIONS)[number]['value'];

const SORT_VALUES = new Set<string>(THEME_SORT_OPTIONS.map((o) => o.value));

/** Unknown or missing sort values fall back to the default, Newest First. */
export function parseThemeSort(raw: string | undefined): ThemeSort {
  return raw && SORT_VALUES.has(raw) ? (raw as ThemeSort) : 'year-desc';
}

/** The page number as /sets reads it: below 1, or not a number, is page 1. */
export function parseThemePage(raw: string | undefined): number {
  return Math.max(1, parseInt(raw || '1', 10) || 1);
}

/** Number of pages for a total. An empty theme still has one (empty) page. */
export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / THEME_PAGE_SIZE));
}

export type ThemePageResolution =
  | { ok: true; page: number; pages: number; from: number; to: number }
  | { ok: false; pages: number };

/** The slice of the sorted list a page shows, or a refusal when the page is past the last one (a 404 on the page). */
export function resolveThemePage(total: number, rawPage: string | undefined): ThemePageResolution {
  const page = parseThemePage(rawPage);
  const pages = pageCount(total);
  if (page > pages) return { ok: false, pages };
  const from = (page - 1) * THEME_PAGE_SIZE;
  return { ok: true, page, pages, from, to: Math.min(total, from + THEME_PAGE_SIZE) };
}

type IndexRow = { set_number: string; year: number | null };

/**
 * The two populations, merged as before: the rows matching the theme name first, then the rows mapped to the theme.
 * A set appears once, at its first occurrence. The result is ordered newest first.
 */
export function mergeThemeRows<T extends IndexRow>(byName: T[], mapped: T[]): T[] {
  const seen = new Set<string>();
  const merged = [...byName, ...mapped].filter((r) => (seen.has(r.set_number) ? false : (seen.add(r.set_number), true)));
  return merged.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

/**
 * Sort the merged list the way the grid's sort select did. Price uses each set's lowest in-stock price; a set with no
 * price sorts last in both price orders. Equal keys keep their current order (JavaScript's sort is stable).
 */
export function sortThemeRows<T extends IndexRow>(rows: T[], sort: ThemeSort, bestPriceOf: (row: T) => number | null): T[] {
  const copy = [...rows];
  switch (sort) {
    case 'price-asc':
      return copy.sort((a, b) => {
        const ap = bestPriceOf(a) ?? Infinity;
        const bp = bestPriceOf(b) ?? Infinity;
        return ap - bp;
      });
    case 'price-desc':
      return copy.sort((a, b) => {
        const ap = bestPriceOf(a) ?? 0;
        const bp = bestPriceOf(b) ?? 0;
        return bp - ap;
      });
    case 'year-asc':
      return copy.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
    case 'year-desc':
      return copy.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    default:
      return copy;
  }
}

/** The address of a theme page. Page 1 and the default sort have no query string. */
export function themeHref(slug: string, opts: { page?: number; sort?: ThemeSort } = {}): string {
  const q = new URLSearchParams();
  if (opts.page && opts.page > 1) q.set('page', String(opts.page));
  if (opts.sort && opts.sort !== 'year-desc') q.set('sort', opts.sort);
  const qs = q.toString();
  return `/themes/${slug}${qs ? `?${qs}` : ''}`;
}

/**
 * The canonical address of a page: the page number only, never the sort. Each page is its own canonical, so pages
 * 2 and up are not duplicates of page 1.
 */
export function canonicalThemePath(slug: string, page: number): string {
  return page > 1 ? `/themes/${slug}?page=${page}` : `/themes/${slug}`;
}

/**
 * Read every row a query matches, a thousand at a time (the database returns at most 1000 rows per request). A failed
 * read throws: the page must not show "no sets" when the read failed.
 */
export async function fetchAllRows<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await run(offset, offset + 999);
    if (error) throw new Error('theme read failed');
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
