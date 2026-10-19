// The data behind one theme page: the sort and the page, read from the cached theme index, then the page's own rows.
// Shared by every theme route, so the four address shapes read the same way.
import { createServerClient } from '@/lib/supabase';
import { THEMES } from '@/lib/brand';
import { getPriceSummaries } from '@/lib/price-summary';
import { getThemeIndex } from '@/lib/theme-index';
import { fetchAllRows, resolveThemePage, sortThemeRows, type ThemeSort } from '@/lib/theme-paging';

export type ThemeView = {
  theme: { name: string; slug: string };
  sort: ThemeSort;
  total: number;
  page: number;
  pages: number;
  /** The sets on this page, in sort order, with prices and summaries. */
  sets: any[];
};

/**
 * One page of a theme in one sort order, or null when the theme is unknown or the page is past the last one.
 * A failed read throws (the route's error boundary shows the "temporarily unavailable" page).
 */
export async function loadThemeView(slug: string, sort: ThemeSort, page: number): Promise<ThemeView | null> {
  const theme = THEMES.find((t) => t.slug === slug);
  if (!theme) return null;

  const index = await getThemeIndex(theme.name, theme.slug);
  const sorted = sortThemeRows(index.rows, sort, (r) => index.bestPrice[r.set_number] ?? null);
  const paging = resolveThemePage(sorted.length, String(page));
  if (!paging.ok) return null;

  const pageNums = sorted.slice(paging.from, paging.to).map((r) => r.set_number);
  const supabase = createServerClient();
  let sets: any[] = [];

  if (pageNums.length > 0) {
    const { data: setRows, error: setErr } = await supabase.from('sets').select('*').in('set_number', pageNums);
    if (setErr) throw new Error('theme read failed');
    const byNumber = new Map((setRows ?? []).map((s: any) => [s.set_number, s]));
    const ordered = pageNums.map((n) => byNumber.get(n)).filter(Boolean) as any[];

    // Prices for this page only. Without them the cards show no price (as before); the page itself still renders.
    const storePricesBySet = new Map<string, any[]>();
    try {
      const storePrices = await fetchAllRows<any>((from, to) =>
        supabase
          .from('store_prices')
          .select('id, set_id, store_id, price_inr, in_stock, product_url, scraped_at')
          .in('set_id', pageNums)
          .order('id', { ascending: true })
          .range(from, to));
      for (const sp of storePrices) {
        if (!storePricesBySet.has(sp.set_id)) storePricesBySet.set(sp.set_id, []);
        storePricesBySet.get(sp.set_id)!.push({
          id: sp.id,
          price_inr: sp.price_inr,
          // PR-A: only an in-stock row can be the set's best price.
          is_active: sp.price_inr !== null && sp.in_stock,
          in_stock: sp.in_stock,
          scraped_at: sp.scraped_at,
          store_name: sp.store_id,
          buy_url: sp.product_url,
        });
      }
    } catch (err) {
      console.error('[theme] store_prices read failed:', (err as Error).message);
    }

    const summaries = await getPriceSummaries(supabase, pageNums);
    sets = ordered.map((s) => ({
      ...s,
      prices: storePricesBySet.get(s.set_number) ?? [],
      summary: summaries.get(s.set_number) ?? null,
    }));
  }

  return { theme: { name: theme.name, slug: theme.slug }, sort, total: sorted.length, page: paging.page, pages: paging.pages, sets };
}
