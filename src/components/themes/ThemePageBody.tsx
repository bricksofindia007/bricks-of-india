import Link from 'next/link';
import { ThemeGrid } from '@/components/sets/ThemeGrid';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import { getThemeCardUrl } from '@/lib/themeCard';
import { JsonLd } from '@/components/JsonLd';
import { buildItemListSchema } from '@/lib/schemas';
import type { ThemeView } from '@/lib/theme-page-data';

// The theme page as one piece: header, grid and pager, and the list's structured data. Used by every theme route,
// so the page-one, page-N and sorted addresses render the same markup.
export function ThemePageBody({ view }: { view: ThemeView }) {
  const { theme, sort, total, page, pages, sets } = view;

  const listItems = sets.slice(0, 10).map((s) => {
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
          <ThemeGrid slug={theme.slug} sets={sets} total={total} page={page} pages={pages} sort={sort} />
        )}
      </div>
    </div>
  );
}
