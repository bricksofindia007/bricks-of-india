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

// Nav & Content Overhaul (2026-08-09): these chips previously listed
// 'Getting Started' / 'India Specific' / 'Advanced' -- categories that
// never actually existed on any guides row (all 9 pre-migration rows are
// 'lego-101'; confirmed live via information_schema before writing this).
// Every filter returned zero results. Rebuilt to the real category set:
// the original 'lego-101' plus the 4 categories migrated in from
// blog_posts (§2) — Buying Guides, How-To, Gift Guides, Value Picks.
const GUIDE_CATEGORIES = ['lego-101', 'Buying Guides', 'How-To', 'Gift Guides', 'Value Picks'];
const GUIDE_CATEGORY_LABELS: Record<string, string> = { 'lego-101': 'LEGO 101' };
const guideCategoryLabel = (cat: string) => GUIDE_CATEGORY_LABELS[cat] ?? cat;

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
              {guideCategoryLabel(cat)}
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
                          {guideCategoryLabel(guide.category)}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
                    <div className="absolute inset-0 flex flex-col items-center justify-center"
                      style={{
                        background: guide.category === 'Buying Guides'
                          ? 'linear-gradient(135deg, #F7A800 0%, #e09600 100%)'
                          : guide.category === 'How-To'
                          ? 'linear-gradient(135deg, #138808 0%, #0d6b06 100%)'
                          : guide.category === 'Gift Guides'
                          ? 'linear-gradient(135deg, #E3000B 0%, #b80009 100%)'
                          : guide.category === 'Value Picks'
                          ? 'linear-gradient(135deg, #7C3AED 0%, #5b21b6 100%)'
                          : 'linear-gradient(135deg, #006CB7 0%, #005a99 100%)'
                      }}>
                      {/* BOI stud pattern — decorative */}
                      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-20 absolute">
                        {[0,1,2,3].map(row => [0,1,2,3].map(col => (
                          <circle key={`${row}-${col}`} cx={10 + col * 20} cy={10 + row * 20} r="7" fill="white"/>
                        )))}
                      </svg>
                      {/* Logo */}
                      <div className="relative z-10 flex flex-col items-center gap-2 px-4 text-center">
                        <span className="text-white font-black text-lg tracking-tight leading-none">BRICKS</span>
                        <span className="text-white/80 font-bold text-xs tracking-widest uppercase">OF INDIA</span>
                      </div>
                    </div>
                    {guide.category && (
                      <span className="absolute top-3 left-3 z-20 text-xs font-semibold px-3 py-1 rounded-full bg-white/90 text-gray-800 shadow-sm">
                        {guideCategoryLabel(guide.category)}
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
