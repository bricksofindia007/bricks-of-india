import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/metadata';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { ThemeGrid } from '@/components/sets/ThemeGrid';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import { THEMES } from '@/lib/brand';
import { getThemeCardUrl, getThemeCardOgUrl } from '@/lib/themeCard';
import { JsonLd } from '@/components/JsonLd';
import { buildItemListSchema } from '@/lib/schemas';
import { getPriceSummaries } from '@/lib/price-summary';
import { getThemeIndex } from '@/lib/theme-index';
import {
  canonicalThemePath, fetchAllRows, parseThemePage, parseThemeSort, resolveThemePage, sortThemeRows,
} from '@/lib/theme-paging';

// P10 revalidate audit (29 Sep): this route had no revalidate of its own and was either built
// once per deploy (its data froze between deploys) or refreshed only as a side effect of a shared
// read. Its cadence is now explicit and checked in CI.
export const revalidate = 86400; // = THEME_PAGE_REVALIDATE_SECONDS: prices and deal badges on the price cadence (route-cadence.ts)

interface Props {
  params: Promise<{ theme: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}

export async function generateStaticParams() {
  return THEMES.map((t) => ({ theme: t.slug }));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const search = await props.searchParams;
  const theme = THEMES.find((t) => t.slug === params.theme);
  if (!theme) return { title: 'Theme Not Found' };
  const page = parseThemePage(search.page);
  return buildMetadata({
    title: page > 1
      ? `LEGO ${theme.name} Sets India 2026 — Page ${page}`
      : `LEGO ${theme.name} Sets India 2026 — Compare Prices`,
    description: `All LEGO ${theme.name} sets available in India. Compare prices across Indian stores and find the best deals.`,
    // Each page is its own canonical; the sort is left out, so a sorted view is not a duplicate of the default.
    path: canonicalThemePath(params.theme, page),
    image: getThemeCardOgUrl(theme.slug),
    ogTitle: `LEGO ${theme.name} Sets India 2026 — Bricks of India`,
    ogDescription: `Compare all LEGO ${theme.name} prices across Indian stores.`,
  });
}

export default async function ThemePage(props: Props) {
  const params = await props.params;
  const search = await props.searchParams;
  const theme = THEMES.find((t) => t.slug === params.theme);
  if (!theme) notFound();

  const sort = parseThemeSort(search.sort);

  // The whole theme, in order: the name match and the mapped subthemes merged (see theme-index.ts), with each set's
  // lowest in-stock price for the price sorts. Cached at the price cadence; only the page's rows are read per request.
  const index = await getThemeIndex(theme.name, theme.slug);
  const sorted = sortThemeRows(index.rows, sort, (r) => index.bestPrice[r.set_number] ?? null);
  const total = sorted.length;

  // A page past the last one is not found, rather than an empty grid.
  const paging = resolveThemePage(total, search.page);
  if (!paging.ok) notFound();

  const pageNums = sorted.slice(paging.from, paging.to).map((r) => r.set_number);
  const supabase = createServerClient();

  let pageSets: any[] = [];
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
    pageSets = ordered.map((s) => ({
      ...s,
      prices: storePricesBySet.get(s.set_number) ?? [],
      summary: summaries.get(s.set_number) ?? null,
    }));
  }

  const listItems = pageSets.slice(0, 10).map((s) => {
    const bestPrice = (s.prices ?? [])
      .filter((p: any) => p.is_active && p.price_inr)
      .sort((a: any, b: any) => a.price_inr - b.price_inr)[0] ?? null;
    return {
      name: s.name,
      set_number: s.set_number,
      image_url: s.image_url,
      bestPrice: bestPrice ? { price_inr: bestPrice.price_inr, buy_url: bestPrice.buy_url } : null,
    };
  });

  return (
    <div className="bg-white min-h-screen">
      <JsonLd data={buildItemListSchema(`LEGO ${theme.name} Sets in India`, total, listItems)} />
      {/* Header — dark navy matches the premium footer */}
      <div className="bg-primary-dark py-10 px-4">
        <div className="max-w-site mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-white/50 mb-5 flex-wrap">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link href="/#browse-themes" className="hover:text-white transition-colors">Themes</Link>
            <span>/</span>
            <span className="text-white/90 font-bold">{theme.name}</span>
          </nav>

          {/* Title row */}
          <div className="flex items-center gap-4 mb-3">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 border-white/20">
              <ImageWithFallback
                srcs={[getThemeCardUrl(theme.slug), '/theme-cards/_default.webp']}
                alt={theme.name}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h1
                className="font-heading text-white"
                style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.1 }}
              >
                LEGO {theme.name.toUpperCase()}
              </h1>
              <p className="text-white/60 text-sm mt-1 font-body">
                {total > 0
                  ? `${total} sets found — price comparison across Indian stores; we check prices daily.`
                  : `All LEGO ${theme.name} sets in India with price comparison. We check prices daily.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-10">
        {total === 0 ? (
          <div className="text-center py-16">
            <div className="relative w-24 h-24 mx-auto mb-4 rounded-2xl overflow-hidden">
              <ImageWithFallback
                srcs={[getThemeCardUrl(theme.slug), '/theme-cards/_default.webp']}
                alt={theme.name}
                fill
                className="object-cover"
              />
            </div>
            <h2 className="font-heading text-dark text-3xl mb-2">No {theme.name} Sets Found</h2>
            <p className="text-text-secondary font-body">We&apos;re syncing the set database. Check back shortly.</p>
          </div>
        ) : (
          <ThemeGrid
            slug={theme.slug}
            sets={pageSets}
            total={total}
            page={paging.page}
            pages={paging.pages}
            sort={sort}
          />
        )}
      </div>
    </div>
  );
}
