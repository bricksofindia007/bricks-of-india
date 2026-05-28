import { MetadataRoute } from 'next';
import { createServerClient } from '@/lib/supabase';
import { slugify } from '@/lib/utils';
import { THEMES } from '@/lib/brand';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://bricksofindia.com';
  const supabase = createServerClient();

  const staticPages = [
    { url: base, priority: 1.0 },
    { url: `${base}/sets`, priority: 0.9 },
    { url: `${base}/deals`, priority: 0.9 },
    { url: `${base}/reviews`, priority: 0.8 },
    { url: `${base}/news`, priority: 0.8 },
    { url: `${base}/blog`, priority: 0.8 },
    { url: `${base}/lab`, priority: 0.8 },
    { url: `${base}/lab/biryani-index`, priority: 0.7 },
    { url: `${base}/lab/which-set`, priority: 0.7 },
    { url: `${base}/lab/heat-map`, priority: 0.7 },
    { url: `${base}/lab/deals`, priority: 0.7 },
    { url: `${base}/lab/budget-calculator`, priority: 0.7 },
    { url: `${base}/lab/retiring-soon`, priority: 0.7 },
    { url: `${base}/guides`, priority: 0.8 },
    { url: `${base}/opinion`, priority: 0.8 },
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

  // Dynamic set pages — paginate to bypass PostgREST 1000-row cap
  const PAGE = 1000;
  const allSets: { set_number: string; name: string; updated_at: string }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await supabase
      .from('sets')
      .select('set_number, name, updated_at')
      .order('year', { ascending: false })
      .order('set_number', { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    allSets.push(...data);
    if (data.length < PAGE) break;
  }
  const setPages = allSets.map((s) => ({
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

  // Guides
  const { data: guides } = await supabase.from('guides').select('slug, updated_at');
  const guidePages = (guides || []).map((g: any) => ({
    url: `${base}/guides/${g.slug}`,
    lastModified: new Date(g.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Opinion posts
  const { data: opinions } = await supabase
    .from('blog_posts')
    .select('slug, published_at')
    .eq('category', 'Opinion');
  const opinionPages = (opinions || []).map((p: any) => ({
    url: `${base}/opinion/${p.slug}`,
    lastModified: new Date(p.published_at),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...setPages, ...blogPages, ...newsPages, ...reviewPages, ...guidePages, ...opinionPages];
}
