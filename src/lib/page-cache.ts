// Edge page cache: which requests may be answered from the cache, and for how long.
// Pure functions only (the Worker entry in worker/entry.ts uses them).
//
// Cached: anonymous GET requests for the listing routes below, plus the first
// page of set listings. Every other request goes straight to the site.
// The cache key is the full URL with its query, after sorting the parameters.
// Query strings with unknown keys, or too many keys, are not cached (so crawlers
// cannot fill the cache with junk URLs).

/** Listing routes (exact paths). Article and set detail pages are cached already. */
export const CACHED_ROUTES: readonly string[] = [
  '/compare',
  '/deals',
  '/news',
  '/sets',
  '/guides',
  '/blog',
  '/contact',
  '/lab/budget-calculator',
  '/lab/price-drops',
];

/** Paged set listings: /sets/page/2 and so on. */
const PAGED = /^\/sets\/page\/[0-9]{1,3}$/;

/** Query keys the listing pages use. Anything else is not cached. */
export const CACHED_QUERY_KEYS: readonly string[] = ['q', 'theme', 'price', 'noPrice', 'page', 'min', 'max'];
const MAX_QUERY_KEYS = 4;

/** Freshness: a stored copy is served for this long, then refreshed in the background. */
export const REFRESH_AFTER_MS = 240_000;
/** The cache drops a copy after this long, whatever happens. */
export const MAX_AGE_SECONDS = 300;

/** Cookies that mean a signed-in visitor. Analytics cookies do not count. */
const SESSION_COOKIE = /(^|;\s*)(boi_admin|sb-[^=]*|supabase[^=]*|session[^=]*)=/i;

export type CacheDecision =
  | { cache: true; key: string; reason: 'listing' }
  | { cache: false; reason: string };

export function cacheDecision(method: string, url: URL, headers: Headers): CacheDecision {
  if (method !== 'GET') return { cache: false, reason: 'not GET' };
  if (headers.has('authorization')) return { cache: false, reason: 'authorization header' };
  const cookie = headers.get('cookie') ?? '';
  if (SESSION_COOKIE.test(cookie)) return { cache: false, reason: 'signed-in cookie' };
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (!(CACHED_ROUTES.includes(path) || PAGED.test(path))) return { cache: false, reason: 'route not cached' };

  const keys = [...new Set([...url.searchParams.keys()])];
  if (keys.length > MAX_QUERY_KEYS) return { cache: false, reason: 'too many query keys' };
  if (keys.some((k) => !CACHED_QUERY_KEYS.includes(k))) return { cache: false, reason: 'unknown query key' };

  // Sorted parameters, so the same page always has the same key.
  const sorted = new URLSearchParams([...url.searchParams.entries()].sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : 1) : a < b ? -1 : 1)));
  const qs = sorted.toString();
  const key = `${url.origin}${path}${qs ? `?${qs}` : ''}`;
  return { cache: true, key, reason: 'listing' };
}

/** True while a stored copy is young enough to serve without a background refresh. */
export function isFresh(storedAtMs: number, nowMs: number): boolean {
  return Number.isFinite(storedAtMs) && nowMs - storedAtMs < REFRESH_AFTER_MS;
}
