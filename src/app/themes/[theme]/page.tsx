import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { SetCard } from '@/components/sets/SetCard';
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
    title: `LEGO® ${theme.name} Sets India 2026 — Compare Prices | Bricks of India`,
    description: `All LEGO® ${theme.name} sets available in India. Compare prices across Indian stores and find the best deals.`,
    alternates: { canonical: `https://bricksofindia.com/themes/${params.theme}` },
  };
}

export default async function ThemePage({ params }: Props) {
  const theme = THEMES.find((t) => t.slug === params.theme);
  if (!theme) notFound();

  const { data: sets } = await supabase
    .from('sets')
    .select('*, prices(*)')
    .ilike('theme', `%${theme.name}%`)
    .order('year', { ascending: false })
    .limit(48);

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-dark py-12 px-4">
        <div className="max-w-site mx-auto">
          <div className="flex items-center gap-4 mb-2">
            <span className="text-6xl">{theme.emoji}</span>
            <h1 className="font-heading text-primary text-6xl md:text-7xl">LEGO® {theme.name.toUpperCase()}</h1>
          </div>
          <p className="text-gray-300 font-body text-lg">
            All LEGO® {theme.name} sets available in India with live price comparison.
            Find the best deal before your wallet changes its mind.
          </p>
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-10">
        {!sets || sets.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-8xl block mb-4">{theme.emoji}</span>
            <h2 className="font-heading text-dark text-3xl mb-2">{theme.name} Sets Loading</h2>
            <p className="text-gray-400 font-body">We&apos;re syncing the set database. Check back shortly.</p>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-6">{sets.length} sets found</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {sets.map((set: any) => {
                const prices = (set.prices || []).filter((p: any) => p.is_active && p.price_inr);
                const bestPrice = prices.sort((a: any, b: any) => a.price_inr - b.price_inr)[0] || null;
                return <SetCard key={set.id} set={set} bestPrice={bestPrice} priceCount={prices.length} />;
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
