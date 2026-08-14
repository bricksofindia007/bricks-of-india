import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { JsonLd } from '@/components/JsonLd';
import { buildArticleSchema } from '@/lib/schemas';
import { ToycraDiscountBanner } from '@/components/ui/ToycraDiscountBanner';

interface Props { params: { slug: string } }

export async function generateStaticParams() {
  const { data } = await supabase.from('guides').select('slug');
  return (data ?? []).map((g: { slug: string }) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data: guide } = await supabase.from('guides').select('title, excerpt, featured_image_url').eq('slug', params.slug).single();
  if (!guide) return { title: 'Guide Not Found' };
  return {
    title: `${guide.title} | Bricks of India`,
    description: guide.excerpt || undefined,
    alternates: { canonical: `https://bricksofindia.com/guides/${params.slug}` },
    openGraph: {
      title: guide.title,
      description: guide.excerpt || undefined,
      images: guide.featured_image_url ? [{ url: guide.featured_image_url }] : [],
    },
  };
}

export default async function GuideArticlePage({ params }: Props) {
  const { data: guide } = await supabase.from('guides').select('*').eq('slug', params.slug).single();
  if (!guide) notFound();

  const { data: related } = await supabase
    .from('guides')
    .select('id, slug, title, excerpt, category, read_time_minutes, published_at')
    .eq('category', guide.category)
    .neq('slug', params.slug)
    .limit(3);

  return (
    <div className="bg-white min-h-screen">
      <JsonLd data={buildArticleSchema({ title: guide.title, excerpt: guide.excerpt, published_at: guide.published_at, updated_at: guide.updated_at, hero_image: guide.featured_image_url, url: `https://bricksofindia.com/guides/${params.slug}` }, 'Article')} />

      {/* Breadcrumb */}
      <div className="max-w-site mx-auto px-4 py-6">
        <nav className="text-sm text-gray-400 flex items-center gap-2 mb-4">
          <Link href="/" className="hover:text-accent-blue">Home</Link>
          <span>/</span>
          <Link href="/guides" className="hover:text-accent-blue">Guides</Link>
          <span>/</span>
          <span className="text-dark font-bold truncate">{guide.title}</span>
        </nav>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-12">
        {guide.featured_image_url && (
          <div className="relative h-64 md:h-96 rounded-2xl overflow-hidden mb-6">
            <Image src={guide.featured_image_url} alt={guide.title} fill className="object-cover" unoptimized />
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          {guide.category && (
            <span className="inline-block bg-white text-dark text-xs font-bold px-3 py-1 rounded-full border-2 border-dark">
              {guide.category}
            </span>
          )}
          <span className="text-gray-400 text-sm">{formatDate(guide.published_at)}</span>
          {guide.read_time_minutes && (
            <span className="text-gray-400 text-sm">{guide.read_time_minutes} min read</span>
          )}
        </div>

        <h1 className="font-heading text-dark text-5xl md:text-6xl mb-6">{guide.title}</h1>

        <div className="prose prose-gray max-w-none font-body leading-relaxed text-gray-700 mb-8 prose-p:mb-5 prose-p:leading-relaxed prose-headings:mt-8 prose-headings:mb-3 prose-h2:text-2xl prose-h3:text-xl">
          <ReactMarkdown>{guide.content}</ReactMarkdown>
        </div>

        <ToycraDiscountBanner variant="compact" />

        {/* Related guides */}
        {related && related.length > 0 && (
          <div className="mt-10">
            <h2 className="font-heading text-dark text-3xl mb-4">MORE GUIDES</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {related.map((g: any) => (
                <Link
                  key={g.id}
                  href={`/guides/${g.slug}`}
                  className="block p-4 rounded-xl border border-border hover:border-primary transition-all hover:shadow-md"
                >
                  {g.category && (
                    <span className="inline-block text-xs font-bold text-primary mb-2">{g.category}</span>
                  )}
                  <h3 className="font-bold text-dark text-sm leading-tight line-clamp-2 mb-1">{g.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{formatDate(g.published_at)}</span>
                    {g.read_time_minutes && <span>· {g.read_time_minutes} min</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
