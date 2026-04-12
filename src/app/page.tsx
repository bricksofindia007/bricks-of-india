import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SearchBar } from '@/components/ui/SearchBar';
import { ToycraDiscountBanner } from '@/components/ui/ToycraDiscountBanner';
import { NewsletterSignup } from '@/components/ui/NewsletterSignup';
import { SetCard } from '@/components/sets/SetCard';
import { ArticleCard, ReviewCard } from '@/components/content/ArticleCard';
import { BRAND, MASCOTS, THEMES } from '@/lib/brand';
import { supabase } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Bricks of India — LEGO® Price Comparison & Reviews in India 2026',
  description:
    "Compare LEGO® prices across India's top stores. Updated every 6 hours. Plus honest reviews and guides. More Bricks. Less Nonsense.",
  alternates: { canonical: 'https://bricksofindia.com' },
};

async function getHomepageData() {
  const [setsRes, reviewsRes, newsRes, blogRes] = await Promise.allSettled([
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
  ]);

  return {
    sets: setsRes.status === 'fulfilled' ? (setsRes.value.data || []) : [],
    reviews: reviewsRes.status === 'fulfilled' ? (reviewsRes.value.data || []) : [],
    news: newsRes.status === 'fulfilled' ? (newsRes.value.data || []) : [],
    blog: blogRes.status === 'fulfilled' ? (blogRes.value.data || []) : [],
  };
}

export default async function HomePage() {
  const { sets, reviews, news, blog } = await getHomepageData();

  return (
    <div className="bg-white">
      {/* HERO */}
      <section className="relative bg-dark overflow-hidden min-h-[500px] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-dark via-gray-900 to-dark" />
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle, #FFD700 1px, transparent 1px)', backgroundSize: '30px 30px' }}
        />
        <div className="relative z-10 max-w-site mx-auto px-4 py-16 w-full">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary rounded-full px-4 py-1.5 mb-4">
                <span className="text-primary text-sm font-bold">India&apos;s #1 LEGO® Price Comparison</span>
              </div>
              <h1 className="font-heading text-white text-6xl md:text-7xl lg:text-8xl leading-none mb-4">
                MORE BRICKS.<br />
                <span className="text-primary">LESS NONSENSE.</span>
              </h1>
              <p className="text-gray-300 text-lg md:text-xl mb-8 max-w-xl font-body">
                India&apos;s Honest Guide to LEGO® — Prices, Reviews &amp; Where to Buy.
                Updated every 6 hours because your wallet deserves the truth.
              </p>
              <div className="max-w-xl">
                <SearchBar size="lg" />
                <p className="text-gray-400 text-sm mt-2 text-center lg:text-left">
                  Search 50,000+ LEGO® sets. Compare prices across 8 Indian stores.
                </p>
              </div>
            </div>
            <div className="shrink-0 lg:w-80">
              <Image
                src={MASCOTS.both.hero}
                alt="Bricks of India mascots"
                width={320}
                height={320}
                className="object-contain drop-shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* TOYCRA DEAL BANNER */}
      <ToycraDiscountBanner variant="full" />

      {/* PRICE COMPARISON SEARCH */}
      <section className="py-12 px-4 bg-light-grey">
        <div className="max-w-site mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 text-center md:text-left">
              <h2 className="font-heading text-dark text-5xl mb-3">FIND THE CHEAPEST PRICE IN INDIA</h2>
              <p className="text-gray-500 mb-6 font-body">
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
              <Link href="/deals" className="text-accent-blue font-bold hover:underline text-sm">
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
      <section className="py-12 px-4 bg-light-grey">
        <div className="max-w-site mx-auto">
          <h2 className="font-heading text-dark text-4xl mb-2">BROWSE BY THEME</h2>
          <p className="text-gray-500 mb-6">From Technic to Botanical — whatever destroys your wallet, we&apos;ve got it.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {THEMES.map((theme) => (
              <Link
                key={theme.slug}
                href={`/themes/${theme.slug}`}
                className="flex flex-col items-center gap-2 bg-white rounded-xl border-2 border-border hover:border-primary hover:shadow-md transition-all p-4 text-center group"
              >
                <span className="text-4xl">{theme.emoji}</span>
                <span className="font-bold text-dark group-hover:text-accent-blue text-sm">{theme.name}</span>
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
                <p className="text-gray-500 text-sm mt-1">Honest. Opinionated. Wallet-aware.</p>
              </div>
              <Link href="/reviews" className="text-accent-blue font-bold hover:underline text-sm">
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
        <section className="py-12 px-4 bg-light-grey">
          <div className="max-w-site mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-dark text-4xl">LATEST NEWS</h2>
              <Link href="/news" className="text-accent-blue font-bold hover:underline text-sm">
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
                <p className="text-gray-500 text-sm mt-1">Buying guides, hot takes, and LEGO® wisdom.</p>
              </div>
              <Link href="/blog" className="text-accent-blue font-bold hover:underline text-sm">
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
      <section className="py-12 px-4 bg-dark">
        <div className="max-w-site mx-auto text-center">
          <h2 className="font-heading text-primary text-5xl mb-3">WATCH ON YOUTUBE</h2>
          <p className="text-gray-300 mb-8 max-w-xl mx-auto font-body">
            Set reviews, unboxings, and the occasional breakdown about LEGO® pricing in India.
            Subscribe if you haven&apos;t. Your algorithm will thank you.
          </p>
          <a
            href={BRAND.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-secondary text-white font-bold px-8 py-4 rounded-xl hover:bg-red-700 transition-colors text-lg"
          >
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.5 6.2c-.3-1-1-1.8-2-2.1C19.7 3.7 12 3.7 12 3.7s-7.7 0-9.5.4c-1 .3-1.7 1.1-2 2.1C0 8 0 12 0 12s0 4 .5 5.8c.3 1 1 1.8 2 2.1C4.3 20.3 12 20.3 12 20.3s7.7 0 9.5-.4c1-.3 1.7-1.1 2-2.1C24 16 24 12 24 12s0-4-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/>
            </svg>
            Subscribe to @BricksofIndia
          </a>
        </div>
      </section>

      {/* INSTAGRAM */}
      <section className="py-10 px-4 bg-light-grey">
        <div className="max-w-site mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="font-heading text-dark text-4xl mb-2">FOLLOW ON INSTAGRAM</h2>
            <p className="text-gray-500 font-body">Set photos, building updates, and unhinged LEGO® opinions at 2am.</p>
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
