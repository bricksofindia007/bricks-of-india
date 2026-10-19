// The whole list of a theme's sets, read a page at a time, with each set's lowest in-stock price. It is the input to
// the theme page's sort and paging, so it covers every set in the theme, not the first 200 of them.
import { unstable_cache } from 'next/cache';
import { createServerClient } from '@/lib/supabase';
import { READ_REVALIDATE_SECONDS } from '@/lib/price-freshness';
import { EXACT_NAME_MATCH, rawThemesFor } from '@/lib/themeMapping';
import { fetchAllRows, mergeThemeRows } from '@/lib/theme-paging';

export type ThemeIndexRow = { set_number: string; year: number | null };

export type ThemeIndex = {
  rows: ThemeIndexRow[];
  /** Lowest in-stock price per set, in rupees. A set with no in-stock price is absent. */
  bestPrice: Record<string, number>;
};

// Sets per store_prices read: each set has a row per store, so a chunk of 100 stays well under the 1000-row cap.
const PRICE_CHUNK = 100;

/** Read the theme's sets (name match plus mapped subthemes, merged) and their lowest in-stock prices. */
export async function loadThemeIndex(themeName: string, slug: string): Promise<ThemeIndex> {
  const supabase = createServerClient();
  const mapped = rawThemesFor(slug);

  // The order includes set_number as a tiebreak, so pages do not shift between reads when years tie.
  const exact = EXACT_NAME_MATCH[slug];
  const [byName, mappedRows] = await Promise.all([
    fetchAllRows<ThemeIndexRow>((from, to) => {
      const q = supabase.from('sets').select('set_number, year');
      const named = exact ? q.in('theme', exact) : q.ilike('theme', `%${themeName}%`);
      return named
        .order('year', { ascending: false })
        .order('set_number', { ascending: true })
        .range(from, to);
    }),
    mapped.length > 0
      ? fetchAllRows<ThemeIndexRow>((from, to) =>
          supabase.from('sets').select('set_number, year')
            .in('theme', mapped)
            .order('year', { ascending: false })
            .order('set_number', { ascending: true })
            .range(from, to))
      : Promise.resolve([] as ThemeIndexRow[]),
  ]);

  const rows = mergeThemeRows(byName, mappedRows);

  const bestPrice: Record<string, number> = {};
  const ids = rows.map((r) => r.set_number);
  for (let i = 0; i < ids.length; i += PRICE_CHUNK) {
    const chunk = ids.slice(i, i + PRICE_CHUNK);
    const prices = await fetchAllRows<{ set_id: string; price_inr: number | null; in_stock: boolean }>((from, to) =>
      supabase.from('store_prices').select('id, set_id, price_inr, in_stock')
        .in('set_id', chunk)
        .order('id', { ascending: true })
        .range(from, to));
    for (const p of prices) {
      if (!p.in_stock || !p.price_inr) continue;
      const cur = bestPrice[p.set_id];
      if (cur === undefined || p.price_inr < cur) bestPrice[p.set_id] = p.price_inr;
    }
  }

  return { rows, bestPrice };
}

/** The cached index for a theme. Re-read at the price cadence, so a request does not re-read the whole theme. */
export function getThemeIndex(themeName: string, slug: string): Promise<ThemeIndex> {
  return unstable_cache(
    () => loadThemeIndex(themeName, slug),
    ['theme-index', slug],
    { revalidate: READ_REVALIDATE_SECONDS },
  )();
}
