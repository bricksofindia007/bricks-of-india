import Image from 'next/image';
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { ArticleCard } from '@/components/content/ArticleCard';
import { MASCOTS } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'LEGO Guides & Blog India 2026 | Bricks of India',
  description: 'Buying guides, opinion pieces, and honest advice for LEGO fans in India. Where to buy, what to get, and what to avoid. In plain English.',
  alternates: { canonical: 'https://bricksofindia.com/blog' },
};

const BLOG_CATEGORIES = ['Buying Guides', 'Opinion', 'How-To', 'Gift Guides', 'Value Picks'];

export default async function BlogPage({ searchParams }: { searchParams: { category?: string } }) {
  const category = searchParams.category || '';
  let query = supabase.from('blog_posts').select('*').order('published_at', { ascending: false });
  if (category) query = query.eq('category', category);
  const { data: posts } = await query;

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-light-grey py-12 px-4 border-b-2 border-dark">
        <div className="max-w-site mx-auto flex items-center gap-6">
          <div className="flex-1">
            <h1 className="font-heading text-dark text-6xl mb-2">GUIDES &amp; OPINION</h1>
            <p className="text-gray-500 font-body text-lg">
              Buying guides, hot takes, and LEGO wisdom for the Indian market.
              We&apos;ve spent the money so you can decide whether to spend yours.
            </p>
          </div>
          <Image src={MASCOTS.blue.pointing} alt="Blog" width={160} height={160} className="object-contain shrink-0 hidden md:block" />
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-8">
        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <a href="/blog" className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-colors ${!category ? 'bg-dark text-white border-dark' : 'bg-white text-dark border-border hover:border-dark'}`}>All</a>
          {BLOG_CATEGORIES.map((cat) => (
            <a key={cat} href={`/blog?category=${encodeURIComponent(cat)}`} className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-colors ${category === cat ? 'bg-dark text-white border-dark' : 'bg-white text-dark border-border hover:border-dark'}`}>{cat}</a>
          ))}
        </div>

        {!posts || posts.length === 0 ? (
          <div className="text-center py-20">
            <Image src={MASCOTS.blue.confused} alt="No posts" width={150} height={150} className="mx-auto mb-4 object-contain" />
            <h2 className="font-heading text-dark text-3xl mb-2">ARTICLES LOADING</h2>
            <p className="text-gray-400 font-body">Content incoming. We&apos;re typing as fast as we can.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post: any) => <ArticleCard key={post.id} article={post} type="blog" />)}
          </div>
        )}
      </div>
    </div>
  );
}
