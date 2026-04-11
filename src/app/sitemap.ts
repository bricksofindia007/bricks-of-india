import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';
import { slugify } from '@/lib/utils';
import { THEMES } from '@/lib/brand';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://bricksofindia.com';

  const staticPages = [
    { url: base, priority: 1.0 },
    { url: `${base}/compare`, priority: 0.9 },
    { url: `${base}/deals`, priority: 0.9 },
    { url: `${base}/reviews`, priority: 0.8 },
    { url: `${base}/news`, priority: 0.8 },
    { url: `${base}/blog`, priority: 0.8 },
    { url: `${base}/calendar`, priority: 0.7 },
    { url: `${base}/about`, priority: 0.6 },
    { url: `${base}/contact`, priority: 0.5 },
    { url: `${base}/legal/disclaimer`, priority: 0.3 },
    { url: `${base}/legal/affiliate-disclosure`, priority: 0.3 },
    { url: `${base}/legal/privacy`, priority: 0.3 },
    { url: `${base}/legal/terms`, priority: 0.3 },
    ...THEMES.map((t) => ({ url: `${base}/themes/${t.slug}`, priority: 0.7 })),
  ].map((p) => ({
    url: p.url,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: p.priority,
  }));

  // Dynamic set pages
  const { data: sets } = await supabase.from('sets').select('set_number, name, updated_at').limit(10000);
  const setPages = (sets || []).map((s: any) => ({
    url: `${base}/sets/${s.set_number}-${slugify(s.name)}`,
    lastModified: new Date(s.updated_at),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // Blog posts
  const { data: posts } = await supabase.from('blog_posts').select('slug, published_at');
  const blogPages = (posts || []).map((p: any) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: new Date(p.published_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // News articles
  const { data: news } = await supabase.from('news_articles').select('slug, published_at');
  const newsPages = (news || []).map((n: any) => ({
    url: `${base}/news/${n.slug}`,
    lastModified: new Date(n.published_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Reviews
  const { data: reviews } = await supabase.from('reviews').select('slug, published_at');
  const reviewPages = (reviews || []).map((r: any) => ({
    url: `${base}/reviews/${r.slug}`,
    lastModified: new Date(r.published_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...setPages, ...blogPages, ...newsPages, ...reviewPages];
}
