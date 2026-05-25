import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { MASCOTS } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'LEGO Buying Guides India 2026 — Tips, Deals & Advice | Bricks of India',
  description: 'Expert LEGO buying guides for Indian collectors. Learn how to buy LEGO in India, find the best deals, avoid import traps, and build your collection smartly.',
  alternates: { canonical: 'https://bricksofindia.com/guides' },
};

const GUIDE_CATEGORIES = ['Getting Started', 'India Specific', 'Advanced'];

interface Guide {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  featured_image_url: string | null;
  read_time_minutes: number | null;
  published_at: string;
}

export default async function GuidesPage({ searchParams }: { searchParams: { category?: string } }) {
  const category = searchParams.category || '';
  let query = supabase.from('guides').select('id, slug, title, excerpt, category, featured_image_url, read_time_minutes, published_at').order('published_at', { ascending: false });
  if (category) query = query.eq('category', category);
  const { data: guides } = await query;

  return (
    <div className="bg-white min-h-screen">
      {/* Hero */}
      <div className="py-12 px-4" style={{ background: 'var(--boi-sky)' }}>
        <div className="max-w-site mx-auto flex items-center gap-6">
          <div className="flex-1">
            <h1 className="font-heading text-6xl mb-2" style={{ color: 'var(--boi-navy)' }}>GUIDES</h1>
            <p className="font-body text-lg" style={{ color: 'var(--boi-navy)', opacity: 0.75 }}>
              Everything you need to buy LEGO smarter in India. From first set to serious collector.
            </p>
          </div>
          <Image src={MASCOTS.blue.pointing} alt="Guides" width={160} height={160} className="object-contain shrink-0 hidden md:block" />
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-10">
        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Link
            href="/guides"
            className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-colors ${!category ? 'bg-dark text-white border-dark' : 'bg-white text-dark border-border hover:border-dark'}`}
          >
            All
          </Link>
          {GUIDE_CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`/guides?category=${encodeURIComponent(cat)}`}
              className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-colors ${category === cat ? 'bg-dark text-white border-dark' : 'bg-white text-dark border-border hover:border-dark'}`}
            >
              {cat}
            </Link>
          ))}
        </div>

        {!guides || guides.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 font-body text-lg">Guides are being written. Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {guides.map((guide: Guide) => (
              <Link
                key={guide.id}
                href={`/guides/${guide.slug}`}
                className="group block bg-white rounded-xl border border-border hover:border-primary transition-all duration-200 hover:shadow-lg overflow-hidden"
              >
                {guide.featured_image_url ? (
                  <div className="relative bg-surface overflow-hidden" style={{ aspectRatio: '16/9' }}>
                    <Image
                      src={guide.featured_image_url}
                      alt={guide.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      unoptimized
                    />
                    {guide.category && (
                      <div className="absolute top-3 left-3">
                        <span className="inline-block bg-white text-dark text-xs font-bold px-3 py-1 rounded-full border-2 border-dark">
                          {guide.category}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-surface flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
                    {guide.category && (
                      <span className="inline-block bg-white text-dark text-xs font-bold px-3 py-1 rounded-full border-2 border-dark">
                        {guide.category}
                      </span>
                    )}
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-bold text-dark text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors mb-2">
                    {guide.title}
                  </h3>
                  {guide.excerpt && (
                    <p className="text-text-secondary text-sm line-clamp-2 mb-3 font-body">{guide.excerpt}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-text-secondary">
                    <span>{formatDate(guide.published_at)}</span>
                    {guide.read_time_minutes && <span>{guide.read_time_minutes} min read</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
