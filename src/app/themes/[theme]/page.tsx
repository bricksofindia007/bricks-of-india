import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { ThemeGrid } from '@/components/sets/ThemeGrid';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import { THEMES } from '@/lib/brand';

interface Props {
  params: { theme: string };
}

export async function generateStaticParams() {
  return THEMES.map((t) => ({ theme: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const theme = THEMES.find((t) => t.slug === params.theme);
  if (!theme) return { title: 'Theme Not Found' };
  return {
    title: `LEGO ${theme.name} Sets India 2026 — Compare Prices | Bricks of India`,
    description: `All LEGO ${theme.name} sets available in India. Compare prices across Indian stores and find the best deals.`,
    alternates: { canonical: `https://bricksofindia.com/themes/${params.theme}` },
  };
}

export default async function ThemePage({ params }: Props) {
  const theme = THEMES.find((t) => t.slug === params.theme);
  if (!theme) notFound();

  // Build-time: Supabase only — no Rebrickable calls during next build.
  // Rebrickable is queried offline (GitHub Actions) and data is stored in Supabase.
  const supabase = createServerClient();

  const { data: rawSets } = await supabase
    .from('sets')
    .select('*')
    .ilike('theme', `%${theme.name}%`)
    .order('year', { ascending: false })
    .limit(200);

  const setsArr = rawSets ?? [];

  // Fetch current prices from store_prices (new pipeline).
  // Gracefully skip if the table doesn't exist yet (pre-migration).
  const storePricesBySet = new Map<string, any[]>();
  if (setsArr.length > 0) {
    const setNums = setsArr.map((s) => s.set_number);
    const { data: storePrices, error: spErr } = await supabase
      .from('store_prices')
      .select('id, set_id, store_id, price_inr, in_stock, product_url')
      .in('set_id', setNums);

    if (!spErr && storePrices) {
      for (const sp of storePrices) {
        if (!storePricesBySet.has(sp.set_id)) storePricesBySet.set(sp.set_id, []);
        storePricesBySet.get(sp.set_id)!.push({
          id: sp.id,
          price_inr: sp.price_inr,
          is_active: sp.price_inr !== null,
          store_name: sp.store_id,
          buy_url: sp.product_url,
        });
      }
    }
  }

  const sets = setsArr.map((s) => ({
    ...s,
    prices: storePricesBySet.get(s.set_number) ?? [],
  }));

  const setCount = sets.length;

  return (
    <div className="bg-white min-h-screen">
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
                srcs={[theme.image, '/images/lego-placeholder.svg']}
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
                {setCount > 0
                  ? `${setCount} sets found — live price comparison across all Indian stores.`
                  : `All LEGO ${theme.name} sets in India with live price comparison.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-10">
        {sets.length === 0 ? (
          <div className="text-center py-16">
            <div className="relative w-24 h-24 mx-auto mb-4 rounded-2xl overflow-hidden">
              <ImageWithFallback
                srcs={[theme.image, '/images/lego-placeholder.svg']}
                alt={theme.name}
                fill
                className="object-cover"
              />
            </div>
            <h2 className="font-heading text-dark text-3xl mb-2">No {theme.name} Sets Found</h2>
            <p className="text-text-secondary font-body">We&apos;re syncing the set database. Check back shortly.</p>
          </div>
        ) : (
          <ThemeGrid sets={sets} />
        )}
      </div>
    </div>
  );
}
