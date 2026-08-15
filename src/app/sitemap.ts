import { MetadataRoute } from 'next';
import { createServerClient } from '@/lib/supabase';
import { slugify } from '@/lib/utils';
import { THEMES } from '@/lib/brand';

// Real bug, found in a Netlify credit-usage audit (2026-08-14): this route
// had no revalidate export at all, so it was purely build-time static --
// the only way it could ever pick up a newly-added set/guide/news/review
// was a full site rebuild (see the "Daily Cron Rebuild" investigation).
// The dynamic-rendering fixes in #30/#31 didn't touch this file at all; it
// was static before them and stays static after -- ISR here is additive,
// not a side effect of that work.
//
// 24h chosen from real evidence, not copied from /deals's 6h by
// assumption: content that actually changes this sitemap's set of URLs
// updates on a WEEKLY cadence, not continuously --
// .github/workflows/sync-catalogue.yml (new sets) runs Sunday 02:00 UTC,
// generate-guide-weekly.yml (new guides) runs Thursday 04:20 UTC. Queried
// live: real growth.sets insert timestamps land in weekly bursts exactly
// matching the Sunday sync (2026-08-09, -08-02, -07-26, -07-19, all ~7
// days apart -- 26 to 251 new rows per burst, zero on the days between).
// 24h keeps the sitemap within at most one day of whatever a given week's
// ingestion added, without revalidating far more often than the
// underlying data ever actually changes.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://bricksofindia.com';
  const supabase = createServerClient();

  const staticPages = [
    { url: base, priority: 1.0 },
    { url: `${base}/sets`, priority: 0.9 },
    { url: `${base}/deals`, priority: 0.9 },
    { url: `${base}/reviews`, priority: 0.8 },
    { url: `${base}/news`, priority: 0.8 },
    { url: `${base}/lab`, priority: 0.8 },
    { url: `${base}/lab/biryani-index`, priority: 0.7 },
    { url: `${base}/lab/which-set`, priority: 0.7 },
    { url: `${base}/lab/heat-map`, priority: 0.7 },
    { url: `${base}/lab/deals`, priority: 0.7 },
    { url: `${base}/lab/budget-calculator`, priority: 0.7 },
    { url: `${base}/lab/retiring-soon`, priority: 0.7 },
    { url: `${base}/lab/price-drops`, priority: 0.7 },
    { url: `${base}/minifig-hq`, priority: 0.8 }, // graduated to a top-nav page, 2026-08-11 — no longer a /lab tool
    { url: `${base}/compare`, priority: 0.9 },
    { url: `${base}/themes`, priority: 0.8 },
    { url: `${base}/guides`, priority: 0.8 },
    { url: `${base}/community`, priority: 0.8 },
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

  // Dynamic set pages — paginate to bypass PostgREST 1000-row cap.
  // GSC-01 Part A: Tier 3 (noindex candidates -- merch/parts/exclusives,
  // not real LEGO sets) is excluded from the sitemap entirely rather than
  // included with a low priority -- a noindexed page listed in a sitemap
  // sends Google a mixed signal. Tier 1 (recent + priced + core-retail
  // theme) gets priority 0.8, matching this file's existing top-level
  // section priority; Tier 2 (everything else that isn't excluded) gets
  // 0.5 -- lower than Tier 1 but still above the lowest static pages
  // (/legal/* at 0.3), since Tier 2 still includes plenty of real,
  // legitimately older sets.
  const PAGE = 1000;
  const allSets: { set_number: string; name: string; updated_at: string; index_tier: string }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data } = await supabase
      .from('sets')
      .select('set_number, name, updated_at, index_tier')
      .neq('index_tier', 'tier3')
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
    priority: s.index_tier === 'tier1' ? 0.8 : 0.5,
  }));

  // blog_posts is now dormant (Nav & Content Overhaul, 2026-08-09) — every
  // row was copied into guides or news_articles, and /blog + /opinion now
  // 301 to their new homes. Deliberately NOT sitemapped from here anymore:
  // listing a URL that permanently redirects is the exact "Page with
  // redirect" GSC issue this project already fixed once (see §GSC-02). The
  // migrated content is sitemapped below via guidePages/newsPages instead.

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

  // Opinion no longer has a dedicated section or listing page — pieces
  // publish into news_articles (category='Opinion') and are already
  // included via newsPages above.

  // Community spotlights
  const { data: spotlights } = await supabase
    .from('community_spotlights')
    .select('slug, published_at')
    .eq('published', true);
  const communityPages = (spotlights || []).map((s: any) => ({
    url: `${base}/community/${s.slug}`,
    lastModified: new Date(s.published_at),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...setPages, ...newsPages, ...reviewPages, ...guidePages, ...communityPages];
}
