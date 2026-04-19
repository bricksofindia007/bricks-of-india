import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SearchBar } from '@/components/ui/SearchBar';
import { ToycraDiscountBanner } from '@/components/ui/ToycraDiscountBanner';
import { NewsletterSignup } from '@/components/ui/NewsletterSignup';
import { YouTubeSection } from '@/components/ui/YouTubeSection';
import { SetCard } from '@/components/sets/SetCard';
import { ArticleCard, ReviewCard } from '@/components/content/ArticleCard';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import { TricolourStripe } from '@/components/ui/TricolourStripe';
import { BRAND, MASCOTS, THEMES } from '@/lib/brand';
import { supabase } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Bricks of India — LEGO Price Comparison & Reviews in India 2026',
  description:
    "Compare LEGO prices across India's top stores. Updated every 6 hours. Plus honest reviews and guides. More Bricks. Less Nonsense.",
  alternates: { canonical: 'https://bricksofindia.com' },
};

async function getHomepageData() {
  const [setsRes, reviewsRes, newsRes, blogRes, setsCountRes, newsCountRes, reviewsCountRes] = await Promise.allSettled([
    supabase
      .from('sets')
      .select('*, prices(*)')
      .not('lego_mrp_inr', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(8),
    supabase
      .from('reviews')
      .select('*, sets(name, image_url, rebrickable_id, set_number, theme)')
      .order('published_at', { ascending: false })
      .limit(3),
    supabase
      .from('news_articles')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(3),
    supabase
      .from('blog_posts')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(3),
    supabase.from('sets').select('*', { count: 'exact', head: true }),
    supabase.from('news_articles').select('*', { count: 'exact', head: true }),
    supabase.from('reviews').select('*', { count: 'exact', head: true }),
  ]);

  const setsCount = setsCountRes.status === 'fulfilled' ? (setsCountRes.value.count ?? 0) : 0;
  const newsCount = newsCountRes.status === 'fulfilled' ? (newsCountRes.value.count ?? 0) : 0;
  const reviewsCount = reviewsCountRes.status === 'fulfilled' ? (reviewsCountRes.value.count ?? 0) : 0;

  return {
    sets: setsRes.status === 'fulfilled' ? (setsRes.value.data || []) : [],
    reviews: reviewsRes.status === 'fulfilled' ? (reviewsRes.value.data || []) : [],
    news: newsRes.status === 'fulfilled' ? (newsRes.value.data || []) : [],
    blog: blogRes.status === 'fulfilled' ? (blogRes.value.data || []) : [],
    setsCount,
    newsCount,
    reviewsCount,
  };
}

export default async function HomePage() {
  const { sets, reviews, news, blog, setsCount, newsCount, reviewsCount } = await getHomepageData();

  return (
    <div className="bg-white">
      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, var(--boi-sky) 0%, var(--boi-sky-light) 100%)',
          minHeight: 'clamp(420px, 50vw, 560px)',
        }}
      >
        {/* Banner image — object-fit cover, anchored to top so logo text is always visible */}
        <div className="absolute inset-0">
          <Image
            src="/brand/hero-banner.png"
            alt="Bricks of India — LEGO price comparison India"
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: '50% 0%' }}
          />
        </div>

        {/* Bottom-fade overlay so navy text stays readable */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(168,216,237,0.92) 0%, rgba(168,216,237,0.55) 45%, transparent 75%)',
          }}
        />

        {/* Text + CTAs — anchored to bottom of section */}
        <div
          className="relative z-10 flex flex-col items-center justify-end px-4 pb-12 text-center w-full"
          style={{ minHeight: 'clamp(420px, 50vw, 560px)' }}
        >
          <h1
            className="mb-2 leading-tight"
            style={{
              fontFamily: 'var(--font-fredoka)',
              fontWeight: 700,
              fontSize: 'clamp(1.75rem, 5vw, 3rem)',
              color: 'var(--boi-navy)',
            }}
          >
            India&apos;s first LEGO® price comparison
          </h1>
          <p
            className="mb-6 font-body"
            style={{
              fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
              color: 'var(--boi-navy)',
              opacity: 0.85,
            }}
          >
            Every set. Every store. Updated daily.
          </p>

          {/* CTAs */}
          <div className="flex flex-col xs:flex-row gap-3 justify-center">
            <Link
              href="/compare"
              style={{
                background: 'var(--boi-red)',
                color: '#fff',
                boxShadow: '0 3px 0 var(--boi-red-dark)',
                fontFamily: 'var(--font-fredoka)',
                fontWeight: 700,
                fontSize: '1rem',
              }}
              className="px-7 py-3 rounded-xl transition-opacity hover:opacity-90 whitespace-nowrap"
            >
              Find cheapest price →
            </Link>
            <Link
              href="/compare"
              style={{
                background: '#fff',
                color: 'var(--boi-navy)',
                border: '2px solid var(--boi-navy)',
                boxShadow: '0 3px 0 var(--boi-navy)',
                fontFamily: 'var(--font-fredoka)',
                fontWeight: 700,
                fontSize: '1rem',
              }}
              className="px-7 py-3 rounded-xl transition-opacity hover:opacity-90 whitespace-nowrap"
            >
              Browse 2026 sets
            </Link>
          </div>
        </div>

        {/* Tricolour stripe — bottom edge of hero */}
        <TricolourStripe height={12} className="absolute bottom-0 left-0 right-0" />
      </section>

      {/* ── STATS BAND ───────────────────────────────────────────────────────── */}
      <section className="py-6 px-4 bg-white border-b border-border">
        <div className="max-w-site mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Live set count */}
            <Link
              href="/compare"
              className="rounded-xl px-4 py-4 text-center transition-opacity hover:opacity-80"
              style={{ border: '2px solid #FFC72C', background: 'rgba(255,199,44,0.12)' }}
            >
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--boi-navy)', fontFamily: 'var(--font-fredoka)', lineHeight: 1.2 }}>
                {setsCount > 0 ? setsCount.toLocaleString('en-IN') : '—'}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', fontFamily: 'var(--font-inter)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                Sets tracked
              </div>
            </Link>

            {/* Stores count — static */}
            <div
              className="rounded-xl px-4 py-4 text-center"
              style={{ border: '2px solid #E30613', background: 'rgba(227,6,19,0.10)' }}
            >
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--boi-navy)', fontFamily: 'var(--font-fredoka)', lineHeight: 1.2 }}>
                3
              </div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', fontFamily: 'var(--font-inter)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                Indian stores live
              </div>
            </div>

            {/* News — clickable */}
            <Link
              href="/news"
              className="rounded-xl px-4 py-4 text-center transition-opacity hover:opacity-80"
              style={{ border: '2px solid #138808', background: 'rgba(19,136,8,0.10)' }}
            >
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--boi-navy)', fontFamily: 'var(--font-fredoka)', lineHeight: 1.2 }}>
                {newsCount > 0 ? newsCount : 'News'}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', fontFamily: 'var(--font-inter)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                {newsCount > 0 ? 'News articles' : 'Latest news'}
              </div>
            </Link>

            {/* Reviews — clickable */}
            <Link
              href="/reviews"
              className="rounded-xl px-4 py-4 text-center transition-opacity hover:opacity-80"
              style={{ border: '2px solid #1a2332', background: 'rgba(26,35,50,0.10)' }}
            >
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--boi-navy)', fontFamily: 'var(--font-fredoka)', lineHeight: 1.2 }}>
                {reviewsCount > 0 ? reviewsCount : 'Reviews'}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', fontFamily: 'var(--font-inter)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>
                {reviewsCount > 0 ? 'Set reviews' : 'Read reviews'}
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* TOYCRA DEAL BANNER */}
      <ToycraDiscountBanner variant="full" />

      {/* PRICE COMPARISON SEARCH */}
      <section className="py-12 px-4 bg-primary-light">
        <div className="max-w-site mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 text-center md:text-left">
              <h2 className="font-heading text-dark text-5xl mb-3">FIND THE CHEAPEST PRICE IN INDIA</h2>
              <p className="text-text-secondary mb-6 font-body">
                Type a set name or number. We&apos;ll find it across Toycra, MyBrickHouse, Hamleys,
                and more. Updated every 6 hours. We never sleep. Unlike your wallet.
              </p>
              <div className="max-w-xl">
                <SearchBar size="lg" placeholder="Search by name or set number... go on then." />
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Prices may vary. Always verify on store website before purchase.
              </p>
            </div>
            <div className="shrink-0">
              <Image
                src={MASCOTS.blue.pointing}
                alt="Find the best LEGO price"
                width={200}
                height={200}
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      {/* LATEST DEALS */}
      {sets.length > 0 && (
        <section className="py-12 px-4">
          <div className="max-w-site mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-dark text-4xl">LATEST DEALS</h2>
              <Link href="/deals" className="text-primary font-bold hover:underline text-sm">
                See all deals →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {sets.slice(0, 8).map((set: any) => {
                const prices = set.prices || [];
                const activePrices = prices.filter((p: any) => p.is_active && p.price_inr);
                const bestPrice = activePrices.sort((a: any, b: any) => a.price_inr - b.price_inr)[0] || null;
                return (
                  <SetCard
                    key={set.id}
                    set={set}
                    bestPrice={bestPrice}
                    priceCount={activePrices.length}
                  />
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* BROWSE BY THEME */}
      <section className="py-12 px-4 bg-surface">
        <div className="max-w-site mx-auto">
          <h2 className="font-heading text-dark text-4xl mb-2">BROWSE BY THEME</h2>
          <p className="text-text-secondary mb-6">From Technic to Botanical — whatever destroys your wallet, we&apos;ve got it.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {THEMES.map((theme) => (
              <Link
                key={theme.slug}
                href={`/themes/${theme.slug}`}
                className="group block bg-white rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all duration-200"
                style={{ '--theme-accent': theme.accentColor } as React.CSSProperties}
              >
                {/* Cover image */}
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
                {/* Label */}
                <div className="px-3 py-2.5">
                  <span className="font-bold text-dark group-hover:text-primary text-sm transition-colors block truncate">
                    {theme.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* LATEST REVIEWS */}
      {reviews.length > 0 && (
        <section className="py-12 px-4">
          <div className="max-w-site mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-heading text-dark text-4xl">LATEST REVIEWS</h2>
                <p className="text-text-secondary text-sm mt-1">Honest. Opinionated. Wallet-aware.</p>
              </div>
              <Link href="/reviews" className="text-primary font-bold hover:underline text-sm">
                All reviews →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {reviews.map((review: any) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* LATEST NEWS */}
      {news.length > 0 && (
        <section className="py-12 px-4 bg-primary-light">
          <div className="max-w-site mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-dark text-4xl">LATEST NEWS</h2>
              <Link href="/news" className="text-primary font-bold hover:underline text-sm">
                All news →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {news.map((article: any) => (
                <ArticleCard key={article.id} article={article} type="news" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* LATEST BLOG */}
      {blog.length > 0 && (
        <section className="py-12 px-4">
          <div className="max-w-site mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-heading text-dark text-4xl">GUIDES &amp; OPINION</h2>
                <p className="text-text-secondary text-sm mt-1">Buying guides, hot takes, and LEGO wisdom.</p>
              </div>
              <Link href="/blog" className="text-primary font-bold hover:underline text-sm">
                All posts →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {blog.map((post: any) => (
                <ArticleCard key={post.id} article={post} type="blog" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* YOUTUBE */}
      <YouTubeSection />

      {/* INSTAGRAM */}
      <section className="py-10 px-4 bg-surface">
        <div className="max-w-site mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="font-heading text-dark text-4xl mb-2">FOLLOW ON INSTAGRAM</h2>
            <p className="text-text-secondary font-body">Set photos, building updates, and unhinged LEGO opinions at 2am.</p>
          </div>
          <a
            href={BRAND.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-3 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.2.1 4.7 1.7 4.8 4.8.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.1-1.6 4.7-4.8 4.8-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1C3.9 21.4 2.4 19.8 2.3 16.7 2.2 15.5 2.2 15.1 2.2 12s0-3.6.1-4.8C2.4 4.1 3.9 2.5 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9C23.7 2.7 21.3.3 16.9.1 15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 100 12.4A6.2 6.2 0 0012 5.8zm0 10.2a4 4 0 110-8 4 4 0 010 8zm6.4-11.8a1.4 1.4 0 100 2.8 1.4 1.4 0 000-2.8z"/>
            </svg>
            @bricksofindia
          </a>
        </div>
      </section>

      {/* NEWSLETTER */}
      <NewsletterSignup />
    </div>
  );
}
