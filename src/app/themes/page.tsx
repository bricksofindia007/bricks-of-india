import type { Metadata } from 'next';
import Link from 'next/link';
import { THEMES, MASCOTS } from '@/lib/brand';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Browse LEGO Themes in India 2026 | Bricks of India',
  description:
    'Browse all LEGO themes available in India. Technic, City, Star Wars, Harry Potter, Speed Champions and more — with live price comparison across Indian stores.',
  alternates: { canonical: 'https://bricksofindia.com/themes' },
};

export default function ThemesPage() {
  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-dark py-12 px-4">
        <div className="max-w-site mx-auto flex items-center gap-6">
          <div className="flex-1">
            <h1 className="font-heading text-primary text-6xl mb-2">BROWSE BY THEME</h1>
            <p className="text-gray-300 font-body text-lg">
              From Technic to Botanical — whatever destroys your wallet, we&apos;ve got it covered.
              Pick a theme and find the best prices in India.
            </p>
          </div>
          <Image
            src={MASCOTS.blue.pointing}
            alt="Browse themes"
            width={150}
            height={150}
            className="object-contain shrink-0 hidden md:block"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-site mx-auto px-4 py-10">
        <p className="text-sm text-gray-400 mb-6">{THEMES.length} themes · prices updated every 6 hours</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {THEMES.map((theme) => (
            <Link
              key={theme.slug}
              href={`/themes/${theme.slug}`}
              className="group block bg-white rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all duration-200"
              style={{ '--theme-accent': theme.accentColor } as React.CSSProperties}
            >
              <div className="relative overflow-hidden" style={{ aspectRatio: '4/3' }}>
                <ImageWithFallback
                  srcs={[
                    theme.image,
                    `https://images.brickset.com/sets/images/${theme.slug}-1.jpg`,
                    '/images/lego-placeholder.svg',
                  ]}
                  alt={theme.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
                <div
                  className="absolute inset-x-0 bottom-0 h-1"
                  style={{ backgroundColor: theme.accentColor }}
                />
              </div>
              <div className="px-3 py-2.5 flex items-center gap-1.5">
                <span className="text-base leading-none">{theme.emoji}</span>
                <span className="font-bold text-dark group-hover:text-primary text-sm transition-colors truncate">
                  {theme.name}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
