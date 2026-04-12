import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatDate, readingTime, whatsappShareUrl, twitterShareUrl } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { ToycraDiscountBanner } from '@/components/ui/ToycraDiscountBanner';
import { ArticleCard } from '@/components/content/ArticleCard';

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data: post } = await supabase.from('blog_posts').select('*').eq('slug', params.slug).single();
  if (!post) return { title: 'Post Not Found' };
  return {
    title: post.seo_title || `${post.title} | Bricks of India`,
    description: post.seo_description || post.excerpt,
    alternates: { canonical: `https://bricksofindia.com/blog/${params.slug}` },
    openGraph: { title: post.title, description: post.excerpt, images: post.hero_image ? [{ url: post.hero_image }] : [] },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { data: post } = await supabase.from('blog_posts').select('*').eq('slug', params.slug).single();
  if (!post) notFound();

  const { data: related } = await supabase.from('blog_posts').select('*').eq('category', post.category).neq('slug', params.slug).limit(3);

  const shareUrl = `https://bricksofindia.com/blog/${params.slug}`;
  const waText = `${post.title} — via Bricks of India. Use code ABHINAV12 for 12% off at Toycra!`;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.excerpt,
    "datePublished": post.published_at,
    "author": { "@type": "Organization", "name": "Bricks of India" },
    "publisher": { "@type": "Organization", "name": "Bricks of India", "url": "https://bricksofindia.com" },
  };

  return (
    <div className="bg-white min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <div className="max-w-site mx-auto px-4 py-6">
        <nav className="text-sm text-gray-400 flex items-center gap-2 mb-4">
          <Link href="/" className="hover:text-accent-blue">Home</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-accent-blue">Blog</Link>
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
          <Badge variant="blue">{post.category}</Badge>
          <span className="text-gray-400 text-sm">{formatDate(post.published_at)}</span>
          <span className="text-gray-400 text-sm">·</span>
          <span className="text-gray-400 text-sm">{readingTime(post.content)}</span>
        </div>

        <h1 className="font-heading text-dark text-5xl md:text-6xl mb-4">{post.title}</h1>
        <p className="text-gray-500 text-lg mb-6 font-body italic">{post.excerpt}</p>

        <div className="prose prose-gray max-w-none font-body leading-relaxed text-gray-700 whitespace-pre-wrap mb-8">
          {post.content}
        </div>

        {/* Share */}
        <div className="flex gap-3 mb-8 pb-8 border-b-2 border-border">
          <a href={whatsappShareUrl(waText, shareUrl)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#25D366] text-white font-bold px-4 py-2 rounded-lg text-sm">📱 WhatsApp</a>
          <a href={twitterShareUrl(post.title, shareUrl)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-dark text-white font-bold px-4 py-2 rounded-lg text-sm">🐦 Twitter</a>
        </div>

        <ToycraDiscountBanner variant="compact" />

        {/* FAQ — always minimum 5 */}
        <div className="mt-10">
          <h2 className="font-heading text-dark text-3xl mb-4">FREQUENTLY ASKED QUESTIONS</h2>
          <div className="space-y-3">
            {[
              { q: 'Where is the cheapest place to buy LEGO in India?', a: 'Toycra consistently offers competitive prices. Use exclusive code ABHINAV12 for an extra 12% off (min. ₹500). Also check MyBrickHouse, Amazon India, and Flipkart.' },
              { q: 'Are LEGO sets worth buying in India in 2026?', a: 'Absolutely — if you buy from the right stores at the right price. Use our price comparison tool to ensure you\'re not overpaying. The sets are genuine and the builds are genuinely enjoyable.' },
              { q: 'Is there a LEGO discount code for India?', a: 'Yes! Use code ABHINAV12 at Toycra for 12% off any LEGO set. Minimum purchase ₹500. No usage limits. This is an exclusive Bricks of India deal.' },
              { q: 'Can I trust the prices on Bricks of India?', a: 'Our prices are scraped every 6 hours from actual retailer websites. We always recommend verifying on the store website before purchase, as prices can change. We\'re accurate, not psychic.' },
              { q: 'How do I know if a LEGO set is genuine in India?', a: 'Buy from authorised retailers: Toycra, MyBrickHouse, Hamleys India, official LEGO stores, Amazon India, and Flipkart. If a price looks too good to be true, it probably is.' },
            ].map((faq, i) => (
              <details key={i} className="border-2 border-border rounded-xl overflow-hidden">
                <summary className="px-4 py-3 font-bold text-dark cursor-pointer hover:bg-light-grey transition-colors">{faq.q}</summary>
                <div className="px-4 py-3 bg-light-grey text-gray-600 font-body text-sm">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>

        {related && related.length > 0 && (
          <div className="mt-10">
            <h2 className="font-heading text-dark text-3xl mb-4">MORE GUIDES</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {related.map((p: any) => <ArticleCard key={p.id} article={p} type="blog" />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
