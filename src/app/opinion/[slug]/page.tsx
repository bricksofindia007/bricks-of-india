import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import { formatDate, readingTime, whatsappShareUrl, twitterShareUrl } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { ToycraDiscountBanner } from '@/components/ui/ToycraDiscountBanner';
import { ArticleCard } from '@/components/content/ArticleCard';
import { Byline } from '@/components/content/Byline';
import { JsonLd } from '@/components/JsonLd';
import { buildArticleSchema } from '@/lib/schemas';

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data: post } = await supabase
    .from('blog_posts')
    .select('title, excerpt, hero_image, seo_title, seo_description, category')
    .eq('slug', params.slug)
    .eq('category', 'Opinion')
    .single();
  if (!post) return { title: 'Post Not Found' };
  return {
    title: post.seo_title || `${post.title} | Bricks of India`,
    description: post.seo_description || post.excerpt,
    alternates: { canonical: `https://bricksofindia.com/opinion/${params.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: post.hero_image ? [{ url: post.hero_image }] : [],
    },
  };
}

export default async function OpinionPostPage({ params }: Props) {
  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', params.slug)
    .eq('category', 'Opinion')
    .single();
  if (!post) notFound();

  const cleanContent = post.content
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^THE [A-Z\s]+$/gm, '')
    .trim();

  const { data: related } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('category', 'Opinion')
    .neq('slug', params.slug)
    .limit(3);

  const shareUrl = `https://bricksofindia.com/opinion/${params.slug}`;
  const waText = `${post.title} — via Bricks of India. Use code ABHINAV12 for 12% off at Toycra!`;

  return (
    <div className="bg-white min-h-screen">
      <JsonLd data={buildArticleSchema({ ...post, url: `https://bricksofindia.com/opinion/${params.slug}` }, 'Article')} />

      <div className="max-w-site mx-auto px-4 py-6">
        <nav className="text-sm text-gray-400 flex items-center gap-2 mb-4">
          <Link href="/" className="hover:text-accent-blue">Home</Link>
          <span>/</span>
          <Link href="/opinion" className="hover:text-accent-blue">Opinion</Link>
          <span>/</span>
          <span className="text-dark font-bold truncate">{post.title}</span>
        </nav>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-12">
        {post.hero_image && (
          <div className="relative h-64 md:h-96 rounded-2xl overflow-hidden mb-6">
            <Image src={post.hero_image} alt={post.title} fill className="object-cover" unoptimized />
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <Badge variant="blue">Opinion</Badge>
          <span className="text-gray-400 text-sm">{formatDate(post.published_at)}</span>
          <span className="text-gray-400 text-sm">·</span>
          <span className="text-gray-400 text-sm">{readingTime(post.content)}</span>
        </div>

        <h1 className="font-heading text-dark text-5xl md:text-6xl mb-3">{post.title}</h1>
        <Byline publishedAt={post.published_at} updatedAt={post.updated_at} />

        <div className="prose prose-gray max-w-none font-body leading-relaxed text-gray-700 mb-8 prose-p:mb-5 prose-p:leading-relaxed prose-headings:mt-8 prose-headings:mb-3 prose-h2:text-2xl prose-h3:text-xl">
          <ReactMarkdown>{cleanContent}</ReactMarkdown>
        </div>

        {/* Share */}
        <div className="flex gap-3 mb-8 pb-8 border-b-2 border-border">
          <a href={whatsappShareUrl(waText, shareUrl)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#25D366] text-white font-bold px-4 py-2 rounded-lg text-sm">📱 WhatsApp</a>
          <a href={twitterShareUrl(post.title, shareUrl)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-dark text-white font-bold px-4 py-2 rounded-lg text-sm">🐦 Twitter</a>
        </div>

        <ToycraDiscountBanner variant="compact" />

        {related && related.length > 0 && (
          <div className="mt-10">
            <h2 className="font-heading text-dark text-3xl mb-4">MORE OPINIONS</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {related.map((p: any) => <ArticleCard key={p.id} article={p} type="blog" />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
