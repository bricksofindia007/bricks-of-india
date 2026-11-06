// Edge cache for rendered pages (order 0520, option C; fixes from order 0540, Phase 1 of order 0560).
// The Worker keeps the rendered page of anonymous visitors in the Workers Cache API for a short time, so a page is rendered
// again only after that time. No R2 copies, no queue. Pure logic: worker/entry.ts passes in the origin and the cache.
// Tested with real header strings in tests/edge-cache.test.ts.
//
// Cost note: the Cache API has no per-operation charge. Each cache miss is one extra render (Workers CPU, database reads).
// Off unless the Worker variable BOI_EDGE_CACHE is "1". Production sets "0" until cutover (order 0560 Phase 3).

export const EDGE_CACHE_VAR = 'BOI_EDGE_CACHE';
/** Local proof only (wrangler dev): a short TTL in seconds, so expiry can be seen. Never set in production. */
export const EDGE_TTL_OVERRIDE_VAR = 'BOI_EDGE_TTL_OVERRIDE_SECONDS';

/** Edge time (s-maxage of the stored copy). Set pages: a price is at most this old plus the 24 h scrape, far under 48 h. */
export const SET_PAGE_EDGE_TTL_SECONDS = 60 * 60;
/** Edge time for pages where a publish or a deal must show quickly. */
export const PUBLISH_SENSITIVE_TTL_SECONDS = 5 * 60;
/** Edge time for every other HTML page, sitemap and robots. */
export const DEFAULT_EDGE_TTL_SECONDS = 60 * 60;

/** Browser max-age sent to visitors (the copy the browser keeps). Publish pages 60 s; other pages 300 s. */
export const BROWSER_MAX_AGE_PUBLISH_SECONDS = 60;
export const BROWSER_MAX_AGE_OTHER_SECONDS = 300;

/**
 * Vary tokens that Next.js sends on its HTML responses (real values, read from wrangler dev on the no-storage build:
 * "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch"; the adapter's own list also has next-url).
 * Safe because a request that carries any of these request headers is bypassed (RSC_HEADERS), so the only variant stored
 * under a page address is the HTML one. The stored copy is saved without Vary.
 */
export const ALLOWED_VARY_TOKENS = new Set(['accept-encoding', 'rsc', 'next-router-state-tree', 'next-router-prefetch', 'next-router-segment-prefetch', 'next-url']);

/** Non-HTML paths that may be stored, with the content types they may use. Nothing else non-HTML is stored. */
const NON_HTML_ALLOWED: Record<string, string[]> = {
  '/sitemap.xml': ['application/xml', 'text/xml'],
  '/robots.txt': ['text/plain'],
};

/** Query parameters that only track where a visit came from. They do not change the page, so they are left out of the key. */
const TRACKING_PARAM = /^(utm_[a-z0-9_]+|gclid|fbclid|msclkid|dclid|mc_cid|mc_eid|_ga)$/i;

/** Session cookies of a signed-in visitor or an admin. Their responses are never read from or written to the cache. */
const PRIVATE_COOKIE = /(^|;\s*)(boi_account|boi_admin)=/;

/** Request headers that mark a client-side navigation or prefetch: those are never the HTML page, so they are bypassed. */
const RSC_HEADERS = ['rsc', 'next-router-state-tree', 'next-router-prefetch', 'next-router-segment-prefetch', 'next-action'];

export type RouteClass = { name: 'never' | 'set' | 'publish' | 'default'; ttl: number };

const NEVER = /^\/(admin|api|auth|account|_next|cdn-cgi)(\/|$)/;
const SET = /^\/sets(\/|$)/;
/** First path segments of pages where a publish or a deal must show quickly. '' is the home page. */
const PUBLISH_FIRST_SEGMENT = new Set(['', 'news', 'reviews', 'guides', 'community', 'blog', 'corrections', 'opinion', 'deals']);

export function routeClass(pathname: string): RouteClass {
  if (NEVER.test(pathname)) return { name: 'never', ttl: 0 };
  if (SET.test(pathname)) return { name: 'set', ttl: SET_PAGE_EDGE_TTL_SECONDS };
  const first = pathname.split('/')[1] ?? '';
  if (PUBLISH_FIRST_SEGMENT.has(first)) return { name: 'publish', ttl: PUBLISH_SENSITIVE_TTL_SECONDS };
  return { name: 'default', ttl: DEFAULT_EDGE_TTL_SECONDS };
}

/** The browser max-age for a route: 60 s on publish pages, 300 s otherwise. */
export function browserMaxAge(pathname: string): number {
  return routeClass(pathname).name === 'publish' ? BROWSER_MAX_AGE_PUBLISH_SECONDS : BROWSER_MAX_AGE_OTHER_SECONDS;
}

/** The cache key: the page address without tracking parameters, with the other parameters sorted. */
export function canonicalCacheUrl(input: string): string {
  const url = new URL(input);
  const kept = [...url.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAM.test(k))
    .sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0));
  const out = new URL(url.origin + url.pathname);
  for (const [k, v] of kept) out.searchParams.append(k, v);
  return out.toString();
}

/**
 * The /sets list (order 0620 item 2): stored for anonymous visitors only when every query key and value is one the page
 * accepts (src/app/sets/page.tsx). Anything else bypasses, as before. Values that are not in the list below are bypassed,
 * never guessed. Theme names are matched by slug format here; a theme name with spaces is bypassed (safe, not cached).
 */
export const SETS_LIST_PARAMS: Record<string, (value: string) => boolean> = {
  page: (v) => /^[1-9]\d*$/.test(v) && Number(v) <= SETS_LIST_MAX_CACHED_PAGE,
  theme: (v) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v),
  sort: (v) => ['newest', 'price_asc', 'price_desc', 'pieces', 'price-asc', 'price-desc'].includes(v),
  instock: (v) => v === '1',
  price: (v) => ['under2k', '2k5k', '5k10k', '10k'].includes(v),
};
/** Highest page number stored for the list (48 sets a page). Pages above it bypass. */
export const SETS_LIST_MAX_CACHED_PAGE = 50;

/** True when the /sets list query is one the page accepts: each key is known, appears once, and has an accepted value. */
export function setsListQueryAllowed(search: URLSearchParams): boolean {
  const seen = new Set<string>();
  for (const [key, value] of search.entries()) {
    if (TRACKING_PARAM.test(key)) continue;
    const check = SETS_LIST_PARAMS[key];
    if (!check || seen.has(key) || !check(value)) return false;
    seen.add(key);
  }
  return true;
}

/** Why this request must not use the cache, or null when it may. */
export function bypassReason(method: string, pathname: string, headers: Headers): string | null {
  if (method !== 'GET') return 'method';
  if (routeClass(pathname).name === 'never') return 'never-route';
  if (RSC_HEADERS.some((h) => headers.has(h))) return 'rsc';
  if (PRIVATE_COOKIE.test(headers.get('cookie') ?? '')) return 'signed-in';
  if (headers.has('authorization')) return 'auth-header';
  return null;
}

/** Why this response must not be stored, or null when it may. Only a 200 page with no cookie, not private, that is HTML
 *  (or the sitemap or robots file), and whose Vary holds only the tokens above. */
export function storeRefusal(pathname: string, status: number, headers: Headers, ignoreOriginNoStore = false): string | null {
  if (status !== 200) return 'status';
  if (headers.has('set-cookie')) return 'set-cookie';
  const type = (headers.get('content-type') ?? '').toLowerCase();
  const allowedNonHtml = NON_HTML_ALLOWED[pathname] ?? [];
  const typeOk = type.startsWith('text/html') || allowedNonHtml.some((t) => type.startsWith(t));
  if (!typeOk) return 'not-html';
  const cacheControl = (headers.get('cache-control') ?? '').toLowerCase();
  // The /sets list is rendered per request on the no-storage build (its origin headers say private, no-store from
  // unstable_noStore). Its output does not depend on the visitor: signed-in requests bypass and set-cookie refuses.
  // So for an allowlisted list request those origin headers are ignored (order 0620 item 2).
  if (!ignoreOriginNoStore && (cacheControl.includes('private') || cacheControl.includes('no-store'))) return 'private';
  const vary = (headers.get('vary') ?? '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (vary.some((v) => v === '*' || !ALLOWED_VARY_TOKENS.has(v))) return 'vary';
  return null;
}

export type EdgeStore = {
  match(key: Request): Promise<Response | undefined>;
  put(key: Request, response: Response): Promise<void>;
};

export type Origin = (request: Request) => Promise<Response>;

/**
 * Worker variable (order 0720). Set only by the no-storage configs (wrangler.staging.jsonc now; wrangler.jsonc at cutover).
 * On those builds every route renders per request, so the origin answers private, no-store on pages that are the same for
 * every visitor. When "1", such an HTML 200 page is stored anyway. Every other refusal still applies.
 */
export const EDGE_IGNORE_ORIGIN_NO_STORE_VAR = 'BOI_EDGE_IGNORE_ORIGIN_NO_STORE';

export type EdgeOptions = { enabled: boolean; ttlOverride?: number; ignoreOriginNoStore?: boolean };

function withHeader(response: Response, name: string, value: string): Response {
  const copy = new Response(response.body, response);
  copy.headers.set(name, value);
  return copy;
}

/** The copy that is stored: edge time as s-maxage (and max-age for the cache store), no Vary, no cookie. */
function storedCopy(response: Response, ttl: number): Response {
  const headers = new Headers(response.headers);
  headers.delete('set-cookie');
  headers.delete('vary');
  headers.set('cache-control', `public, s-maxage=${ttl}, max-age=${ttl}`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/** The copy the visitor's browser receives: a short max-age, so the browser does not hold a page longer than the edge does. */
function visitorCopy(response: Response, pathname: string, debug: string): Response {
  const copy = new Response(response.body, response);
  copy.headers.set('cache-control', `public, max-age=${browserMaxAge(pathname)}`);
  copy.headers.set('x-boi-edge-cache', debug);
  return copy;
}

/**
 * Serves a page from the edge cache when it can, otherwise asks the origin (the generated OpenNext worker).
 * Adds one debug header, x-boi-edge-cache: hit, miss or bypass. Pages that are cached get the short browser max-age.
 */
export async function handleWithEdgeCache(
  request: Request,
  origin: Origin,
  store: EdgeStore,
  waitUntil: (p: Promise<unknown>) => void,
  options: EdgeOptions,
): Promise<Response> {
  if (!options.enabled) return origin(request);
  const url = new URL(request.url);
  const pathname = url.pathname;
  const isSetsList = pathname === '/sets';
  if (isSetsList && !setsListQueryAllowed(url.searchParams)) {
    return withHeader(await origin(request), 'x-boi-edge-cache', 'bypass');
  }
  if (bypassReason(request.method, pathname, request.headers)) {
    return withHeader(await origin(request), 'x-boi-edge-cache', 'bypass');
  }
  const ttl = options.ttlOverride ?? routeClass(pathname).ttl;
  const key = new Request(canonicalCacheUrl(request.url), { method: 'GET' });
  const hit = await store.match(key);
  if (hit) return visitorCopy(hit, pathname, 'hit');
  const response = await origin(request);
  if (storeRefusal(pathname, response.status, response.headers, isSetsList || options.ignoreOriginNoStore === true)) {
    return withHeader(response, 'x-boi-edge-cache', 'bypass');
  }
  waitUntil(store.put(key, storedCopy(response.clone(), ttl)));
  return visitorCopy(response, pathname, 'miss');
}
