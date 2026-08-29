import Image from 'next/image';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { ArticleCard } from '@/components/content/ArticleCard';
import { Badge } from '@/components/ui/Badge';
import { MASCOTS } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'LEGO News India 2026 — New Sets, Deals & Launches | Bricks of India',
  description: 'Latest LEGO news for Indian buyers. New set releases, India price updates, deals, and everything happening in the LEGO world in 2026.',
  alternates: { canonical: 'https://bricksofindia.com/news' },
};

const NEWS_CATEGORIES = ['New Sets', 'Deals', 'India Launches', 'Rumours', 'Community'];

// Netlify credit audit (2026-08-29): this page read `searchParams.category`
// directly in the Server Component and ran a fresh Supabase query per
// category click — reading searchParams here is a Next.js Dynamic API,
// which opts the ENTIRE route out of static/ISR rendering regardless of
// any revalidate export (confirmed via a real production build: `ƒ` full
// SSR per request, the only content-listing page in the app without a
// revalidate export at all). Same root pattern already fixed once on this
// site for /lab/price-drops (2026-08-15): the category filter only ever
// sliced an already-fully-fetched result, so the fetch itself is decoupled
// from searchParams and cached here instead. Revalidate window matches
// next.config.mjs's own already-declared Cache-Control intent for this
// exact route (`Content listing pages — 5min fresh`), not copied from an
// unrelated page.
const getAllNewsArticles = unstable_cache(
  async () => {
    const { data } = await supabase
      .from('news_articles')
      .select('*')
      .order('published_at', { ascending: false });
    return data ?? [];
  },
  ['news-page-all-articles'],
  { revalidate: 300 },
);

export default async function NewsPage({ searchParams }: { searchParams: { category?: string } }) {
  const category = searchParams.category || '';
  const allArticles = await getAllNewsArticles();
  const articles = category ? allArticles.filter((a: any) => a.category === category) : allArticles;

  return (
    <div className="bg-white min-h-screen">
      <div className="py-12 px-4" style={{ background: "var(--boi-sky)" }}>
        <div className="max-w-site mx-auto flex items-center gap-6">
          <div className="flex-1">
            <h1 className="font-heading text-6xl mb-2" style={{ color: "var(--boi-navy)" }}>LEGO NEWS</h1>
            <p className="font-body text-lg" style={{ color: "var(--boi-navy)", opacity: 0.75 }}>
              New sets, India launches, deals, and everything happening in the LEGO world.
              Filtered for what actually matters to Indian buyers.
            </p>
          </div>
          <Image src={MASCOTS.red.reading} alt="News" width={160} height={160} className="object-contain shrink-0 hidden md:block" />
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-10">
        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <a
            href="/news"
            className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-colors ${!category ? 'bg-dark text-white border-dark' : 'bg-white text-dark border-border hover:border-dark'}`}
          >
            All
          </a>
          {NEWS_CATEGORIES.map((cat) => (
            <a
              key={cat}
              href={`/news?category=${encodeURIComponent(cat)}`}
              className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-colors ${category === cat ? 'bg-dark text-white border-dark' : 'bg-white text-dark border-border hover:border-dark'}`}
            >
              {cat}
            </a>
          ))}
        </div>

        {!articles || articles.length === 0 ? (
          <div className="text-center py-20">
            <Image src={MASCOTS.blue.confused} alt="No articles" width={150} height={150} className="mx-auto mb-4 object-contain" />
            <h2 className="font-heading text-dark text-3xl mb-2">NEWS LOADING</h2>
            <p className="text-gray-400 font-body">Articles are on their way. Faster than LEGO shipping, hopefully.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article: any) => <ArticleCard key={article.id} article={article} type="news" />)}
          </div>
        )}
      </div>
    </div>
  );
}
