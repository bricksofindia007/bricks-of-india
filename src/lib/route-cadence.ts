// Intended revalidate for EVERY app route (P10 item 1). scripts/ci/revalidate-audit.ts
// compares each route's EFFECTIVE revalidate -- the lowest of its segment config
// and every data read in a render -- with the value here and fails CI on any
// difference. Found 29 Sep: a 1 h store-registry read (getStores) had silently
// made every /sets/ page regenerate hourly instead of every 6 h.
//
//   number     ISR seconds (must equal a cadence constant)
//   STATIC     built once per deploy, never revalidated (pages with no data reads)
//   DYNAMIC    rendered per request (searchParams, auth, route handlers)
//   {priced, unpriced}  /sets/[slug]: 6 h with offers, 72 h without (FP1.6 §2)
import { READ_REVALIDATE_SECONDS, SET_PAGE_REVALIDATE_SECONDS, UNPRICED_SET_REVALIDATE_SECONDS } from './price-freshness';

export const STATIC = 'static' as const;
export const DYNAMIC = 'dynamic' as const;
export const SITEMAP_REVALIDATE_SECONDS = 86400;
/** Theme pages list sets with prices and deal badges: the price cadence (6 h). */
export const THEME_PAGE_REVALIDATE_SECONDS = SET_PAGE_REVALIDATE_SECONDS;

export type Cadence = number | typeof STATIC | typeof DYNAMIC | { priced: number; unpriced: number };

export const ROUTE_CADENCE: Record<string, Cadence> = {
  '/': READ_REVALIDATE_SECONDS,
  '/_not-found': STATIC,
  '/about': STATIC,
  '/bot': STATIC,
  '/calendar': STATIC,
  '/contact': STATIC,
  '/lab': STATIC,
  '/lab/biryani-index': STATIC,
  '/legal/affiliate-disclosure': STATIC,
  '/legal/disclaimer': STATIC,
  '/legal/privacy': STATIC,
  '/legal/terms': STATIC,
  '/precision': STATIC,
  '/shareables': STATIC,
  '/themes': STATIC,
  '/sitemap.xml': SITEMAP_REVALIDATE_SECONDS,

  // listings and tools that read the database: hourly
  '/deals': READ_REVALIDATE_SECONDS,
  '/corrections': READ_REVALIDATE_SECONDS,
  '/lab/deals': READ_REVALIDATE_SECONDS,
  '/lab/cmf-tracker': READ_REVALIDATE_SECONDS,
  '/lab/retiring-soon': READ_REVALIDATE_SECONDS,
  '/lab/which-set': READ_REVALIDATE_SECONDS,
  '/minifig-hq': READ_REVALIDATE_SECONDS,
  '/reviews': READ_REVALIDATE_SECONDS,
  '/opinion': READ_REVALIDATE_SECONDS,
  '/community': READ_REVALIDATE_SECONDS,

  // detail pages
  '/sets/[slug]': { priced: SET_PAGE_REVALIDATE_SECONDS, unpriced: UNPRICED_SET_REVALIDATE_SECONDS },
  '/themes/[theme]': THEME_PAGE_REVALIDATE_SECONDS,
  '/news/[slug]': READ_REVALIDATE_SECONDS,
  '/reviews/[slug]': READ_REVALIDATE_SECONDS,
  '/guides/[slug]': READ_REVALIDATE_SECONDS,
  // retired: next.config.mjs 301s every /blog/:slug before the page is reached
  '/blog/[slug]': DYNAMIC,
  '/community/[slug]': READ_REVALIDATE_SECONDS,

  // per-request by design (searchParams filters / pagination, auth, handlers)
  '/admin/pending': DYNAMIC,
  '/admin/pending/growth/[[...path]]': DYNAMIC,
  '/admin/pending/newsletter': DYNAMIC,
  '/api/img': DYNAMIC,
  '/api/sets/search': DYNAMIC,
  '/blog': DYNAMIC,
  '/brick-rush': DYNAMIC, // sale-hub short URL: a route handler that redirects to the article
  '/compare': DYNAMIC,
  '/guides': DYNAMIC,
  '/lab/budget-calculator': DYNAMIC,
  '/lab/price-drops': DYNAMIC,
  '/news': DYNAMIC,
  '/opinion/[slug]': DYNAMIC,
  '/sets': DYNAMIC,
  '/sets/page/[page]': DYNAMIC,
};
