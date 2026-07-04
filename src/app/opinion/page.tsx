import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { MASCOTS } from '@/lib/brand';
import { TaglineWink } from '@/components/ui/Taglines';

export const metadata: Metadata = {
  title: 'LEGO Opinion & Hot Takes India 2026 | Bricks of India',
  description: 'Honest opinions on LEGO sets, pricing, and collecting in India. No PR fluff — just straight talk about what\'s worth your money and what isn\'t.',
  alternates: { canonical: 'https://bricksofindia.com/opinion' },
};

interface OpinionPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  hero_image: string | null;
  published_at: string;
}

export default async function OpinionPage() {
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('id, slug, title, excerpt, category, hero_image, published_at')
    .eq('category', 'Opinion')
    .order('published_at', { ascending: false });

  return (
    <div className="bg-white min-h-screen">
      {/* Hero */}
      <div className="py-12 px-4" style={{ background: 'var(--boi-sky)' }}>
        <div className="max-w-site mx-auto flex items-center gap-6">
          <div className="flex-1">
            <h1 className="font-heading text-6xl mb-2" style={{ color: 'var(--boi-navy)' }}>OPINION</h1>
            <p className="font-body text-lg mb-2" style={{ color: 'var(--boi-navy)', opacity: 0.75 }}>
              Honest takes on LEGO sets, Indian pricing, and the hobby. No fluff. No PR speak. Just whether it&apos;s worth your money.
            </p>
            <p className="mt-1">
              <TaglineWink />
            </p>
          </div>
          <Image src={MASCOTS.blue.pointing} alt="Opinion" width={160} height={160} className="object-contain shrink-0 hidden md:block" />
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-10">
        {!posts || posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 font-body text-lg">Opinion pieces are being written. Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post: OpinionPost) => (
              <Link
                key={post.id}
                href={`/opinion/${post.slug}`}
                className="group block bg-white rounded-xl border border-border hover:border-primary transition-all duration-200 hover:shadow-lg overflow-hidden"
              >
                {post.hero_image ? (
                  <div className="relative bg-surface overflow-hidden" style={{ aspectRatio: '16/9' }}>
                    <Image
                      src={post.hero_image}
                      alt={post.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      unoptimized
                    />
                    <div className="absolute top-3 left-3">
                      <span className="inline-block bg-white text-dark text-xs font-bold px-3 py-1 rounded-full border-2 border-dark">
                        Opinion
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-surface flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
                    <span className="inline-block bg-white text-dark text-xs font-bold px-3 py-1 rounded-full border-2 border-dark">
                      Opinion
                    </span>
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-bold text-dark text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors mb-2">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-text-secondary text-sm line-clamp-2 mb-3 font-body">{post.excerpt}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-text-secondary">
                    <span>{formatDate(post.published_at)}</span>
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
