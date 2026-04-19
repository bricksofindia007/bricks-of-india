import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatDate, whatsappShareUrl, twitterShareUrl } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { ToycraDiscountBanner } from '@/components/ui/ToycraDiscountBanner';
import { ArticleCard } from '@/components/content/ArticleCard';

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data: article } = await supabase.from('news_articles').select('*').eq('slug', params.slug).single();
  if (!article) return { title: 'Article Not Found' };
  return {
    title: article.seo_title || article.title,
    description: article.seo_description || article.excerpt,
    alternates: { canonical: `https://bricksofindia.com/news/${params.slug}` },
    openGraph: { title: article.title, description: article.excerpt, images: article.hero_image ? [{ url: article.hero_image }] : [] },
  };
}

export default async function NewsArticlePage({ params }: Props) {
  const { data: article } = await supabase.from('news_articles').select('*').eq('slug', params.slug).single();
  if (!article) notFound();

  const { data: related } = await supabase.from('news_articles').select('*').eq('category', article.category).neq('slug', params.slug).limit(3);

  const shareUrl = `https://bricksofindia.com/news/${params.slug}`;
  const waText = `${article.title} — via Bricks of India. Use code ABHINAV12 for 12% off at Toycra!`;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    datePublished: article.published_at,
    dateModified: article.updated_at || article.published_at,
    author: {
      '@type': 'Person',
      name: 'Abhinav Bhargav',
      jobTitle: 'Founder, Bricks of India',
      url: 'https://www.bricksofindia.com/about',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Bricks of India',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.bricksofindia.com/brand/hero-banner.png',
      },
    },
  };

  return (
    <div className="bg-white min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <div className="max-w-site mx-auto px-4 py-6">
        <nav className="text-sm text-gray-400 flex items-center gap-2 mb-4">
          <Link href="/" className="hover:text-accent-blue">Home</Link>
          <span>/</span>
          <Link href="/news" className="hover:text-accent-blue">News</Link>
          <span>/</span>
          <span className="text-dark font-bold truncate">{article.title}</span>
        </nav>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-12">
        {article.hero_image && (
          <div className="relative h-64 md:h-96 rounded-2xl overflow-hidden mb-6">
            <Image src={article.hero_image} alt={article.title} fill className="object-cover" unoptimized />
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <Badge variant="secondary">{article.category}</Badge>
          <span className="text-gray-400 text-sm">{formatDate(article.published_at)}</span>
        </div>

        <h1 className="font-heading text-dark text-5xl md:text-6xl mb-4">{article.title}</h1>
        <p className="text-gray-500 text-lg mb-6 font-body">{article.excerpt}</p>

        <div className="prose prose-gray max-w-none font-body leading-relaxed text-gray-700 whitespace-pre-wrap mb-8">
          {article.content}
        </div>

        {/* Share */}
        <div className="flex gap-3 mb-8 pb-8 border-b-2 border-border">
          <a href={whatsappShareUrl(waText, shareUrl)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#25D366] text-white font-bold px-4 py-2 rounded-lg text-sm">📱 WhatsApp</a>
          <a href={twitterShareUrl(article.title, shareUrl)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-dark text-white font-bold px-4 py-2 rounded-lg text-sm">🐦 Twitter</a>
          <button onClick={() => navigator.clipboard.writeText(shareUrl)}
            className="flex items-center gap-2 border-2 border-dark text-dark font-bold px-4 py-2 rounded-lg text-sm hover:bg-dark hover:text-white transition-colors">🔗 Copy Link</button>
        </div>

        <ToycraDiscountBanner variant="compact" />

        {/* FAQ */}
        <div className="mt-10">
          <h2 className="font-heading text-dark text-3xl mb-4">FREQUENTLY ASKED QUESTIONS</h2>
          <div className="space-y-3">
            {[
              { q: 'Where can I buy the latest LEGO sets in India?', a: 'Toycra, MyBrickHouse, Hamleys India, and Amazon India are the most reliable sources. Use code ABHINAV12 at Toycra for 12% off.' },
              { q: 'What is the best LEGO deal in India right now?', a: 'Check our deals page for the current best prices updated every 6 hours. Use code ABHINAV12 at Toycra for an exclusive 12% discount.' },
              { q: 'Are LEGO sets available in India?', a: 'Yes — most major LEGO sets are available in India through stores like Toycra, MyBrickHouse, Hamleys, Amazon India, and Flipkart.' },
              { q: 'Why are LEGO sets expensive in India?', a: 'Import duties, GST, and currency conversion all contribute to LEGO prices in India being higher than in the US or UK. We cover this in detail in our guide on why Indian LEGO prices are what they are.' },
              { q: 'Is there a discount code for LEGO in India?', a: 'Yes! Use code ABHINAV12 at Toycra for 12% off any LEGO set. Minimum purchase ₹500. No usage limits. This is an exclusive Bricks of India deal.' },
            ].map((faq, i) => (
              <details key={i} className="border-2 border-border rounded-xl overflow-hidden">
                <summary className="px-4 py-3 font-bold text-dark cursor-pointer hover:bg-light-grey transition-colors">{faq.q}</summary>
                <div className="px-4 py-3 bg-light-grey text-gray-600 font-body text-sm">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>

        {/* Related */}
        {related && related.length > 0 && (
          <div className="mt-10">
            <h2 className="font-heading text-dark text-3xl mb-4">MORE NEWS</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {related.map((a: any) => <ArticleCard key={a.id} article={a} type="news" />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
