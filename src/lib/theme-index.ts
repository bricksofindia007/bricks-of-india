// The whole list of a theme's sets, read a page at a time, with each set's lowest in-stock price. It is the input to
// the theme page's sort and paging, so it covers every set in the theme, not the first 200 of them.
import { createServerClient } from '@/lib/supabase';
import { storedCache } from '@/lib/no-storage-render';
import { READ_REVALIDATE_SECONDS } from '@/lib/price-freshness';
import { EXACT_NAME_MATCH, rawThemesFor } from '@/lib/themeMapping';
import { fetchAllRows, mergeThemeRows } from '@/lib/theme-paging';
import { mapWithConcurrency } from '@/lib/concurrency';

export type ThemeIndexRow = { set_number: string; year: number | null; pieces: number | null };

export type ThemeIndex = {
  rows: ThemeIndexRow[];
  /** Lowest in-stock price per set, in rupees. A set with no in-stock price is absent. */
  bestPrice: Record<string, number>;
};

// Sets per store_prices read: each set has a row per store, so a chunk of 100 stays well under the 1000-row cap.
const PRICE_CHUNK = 100;
// Chunks in flight at once (order 1953 item 4b). Four keeps the connection count modest.
const PRICE_CONCURRENCY = 4;

/** Read the theme's sets (name match plus mapped subthemes, merged) and their lowest in-stock prices. */
export async function loadThemeIndex(themeName: string, slug: string): Promise<ThemeIndex> {
  const supabase = createServerClient();
  const mapped = rawThemesFor(slug);

  // The order includes set_number as a tiebreak, so pages do not shift between reads when years tie.
  const exact = EXACT_NAME_MATCH[slug];
  const [byName, mappedRows] = await Promise.all([
    fetchAllRows<ThemeIndexRow>((from, to) => {
      const q = supabase.from('sets').select('set_number, year, pieces');
      const named = exact ? q.in('theme', exact) : q.ilike('theme', `%${themeName}%`);
      return named
        .order('year', { ascending: false })
        .order('set_number', { ascending: true })
        .range(from, to);
    }),
    mapped.length > 0
      ? fetchAllRows<ThemeIndexRow>((from, to) =>
          supabase.from('sets').select('set_number, year, pieces')
            .in('theme', mapped)
            .order('year', { ascending: false })
            .order('set_number', { ascending: true })
            .range(from, to))
      : Promise.resolve([] as ThemeIndexRow[]),
  ]);

  const rows = mergeThemeRows(byName, mappedRows);

  // Order 1953 item 4c: the best in-stock price per set comes from set_price_summary (one row per set), not from a scan of
  // every store row. Chunks are read PRICE_CONCURRENCY at a time instead of one after another (item 4b).
  const ids = rows.map((r) => r.set_number);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += PRICE_CHUNK) chunks.push(ids.slice(i, i + PRICE_CHUNK));
  const parts = await mapWithConcurrency(chunks, PRICE_CONCURRENCY, (chunk) => readBestPriceSummaries(supabase, chunk));
  const bestPrice = bestPricesFromSummaries(parts.flat());

  return { rows, bestPrice };
}

export type SummaryPriceRow = { set_id: string; best_price_inr: number | null; in_stock_store_count: number | null };

/**
 * Lowest in-stock price per set, from set_price_summary rows. The view already keeps only in-stock rows and scrapes from the
 * last 12 hours, so a set whose prices are older than that has no entry here (a stale price is not shown on the theme page).
 */
export function bestPricesFromSummaries(rows: SummaryPriceRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.best_price_inr == null || !((r.in_stock_store_count ?? 0) > 0)) continue;
    out[r.set_id] = r.best_price_inr;
  }
  return out;
}

async function readBestPriceSummaries(
  sb: ReturnType<typeof createServerClient>,
  chunk: string[],
): Promise<SummaryPriceRow[]> {
  const { data, error } = await sb
    .from('set_price_summary')
    .select('set_id, best_price_inr, in_stock_store_count')
    .in('set_id', chunk);
  if (error) throw error;
  return (data ?? []) as SummaryPriceRow[];
}

/** The cached index for a theme. Re-read at the price cadence, so a request does not re-read the whole theme. */
export function getThemeIndex(themeName: string, slug: string): Promise<ThemeIndex> {
  return storedCache(
    () => loadThemeIndex(themeName, slug),
    ['theme-index', slug],
    { revalidate: READ_REVALIDATE_SECONDS },
  )();
}
