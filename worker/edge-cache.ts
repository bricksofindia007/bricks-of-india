// Edge cache for rendered pages (order 0520, option C). The Worker keeps the HTML of anonymous visitors' page views in the
// Workers Cache API for a short time, so the page is rendered again only after that time. No R2 copies and no queue.
// Pure logic: the Worker entry (worker/entry.ts) passes in the origin and the cache. Tested in tests/edge-cache.test.ts.
//
// Cost note: the Cache API has no per-operation charge. Each cache miss is one extra render (Workers CPU, database reads).
// Off unless the Worker variable BOI_EDGE_CACHE is "1" (set in wrangler.staging.jsonc only, in this draft).

export const EDGE_CACHE_VAR = 'BOI_EDGE_CACHE';

/** Set pages: a price is at most this old plus the scrape interval (price-freshness: 24 h), far under 48 h. */
export const SET_PAGE_EDGE_TTL_SECONDS = 60 * 60;
/** Pages where a publish or a deal must show quickly. */
export const PUBLISH_SENSITIVE_TTL_SECONDS = 5 * 60;
/** Every other HTML page: one hour (kept short so prices stay inside the 48 h rule with margin). */
export const DEFAULT_EDGE_TTL_SECONDS = 60 * 60;

/** Query parameters that only track where a visit came from. They do not change the page, so they are left out of the key. */
const TRACKING_PARAM = /^(utm_[a-z0-9_]+|gclid|fbclid|msclkid|dclid|mc_cid|mc_eid|_ga)$/i;

/** Session cookies of a signed-in visitor or an admin. Their responses are never read from or written to the cache. */
const PRIVATE_COOKIE = /(^|;\s*)(boi_account|boi_admin)=/;

/** Headers that mark a client-side navigation or prefetch: those responses are not HTML pages and are never cached here. */
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

/** Why this request must not use the cache, or null when it may. */
export function bypassReason(method: string, pathname: string, headers: Headers): string | null {
  if (method !== 'GET') return 'method';
  if (routeClass(pathname).name === 'never') return 'never-route';
  if (RSC_HEADERS.some((h) => headers.has(h))) return 'rsc';
  if (PRIVATE_COOKIE.test(headers.get('cookie') ?? '')) return 'signed-in';
  if (headers.has('authorization')) return 'auth-header';
  return null;
}

/** Why this response must not be stored, or null when it may. Only a plain 200 HTML page with no cookie is stored. */
export function storeRefusal(status: number, headers: Headers): string | null {
  if (status !== 200) return 'status';
  if (headers.has('set-cookie')) return 'set-cookie';
  const type = headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('text/html')) return 'not-html';
  const cacheControl = (headers.get('cache-control') ?? '').toLowerCase();
  if (cacheControl.includes('private') || cacheControl.includes('no-store')) return 'private';
  const vary = (headers.get('vary') ?? '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (vary.some((v) => v !== 'accept-encoding')) return 'vary';
  return null;
}

export type EdgeStore = {
  match(key: Request): Promise<Response | undefined>;
  put(key: Request, response: Response): Promise<void>;
};

export type Origin = (request: Request) => Promise<Response>;

function withHeader(response: Response, name: string, value: string): Response {
  const copy = new Response(response.body, response);
  copy.headers.set(name, value);
  return copy;
}

/** The copy that is stored: the same page, a fresh max-age, and no cookie. */
function storedCopy(response: Response, ttl: number): Response {
  const headers = new Headers(response.headers);
  headers.delete('set-cookie');
  headers.set('cache-control', `public, max-age=${ttl}`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

/**
 * Serves a page from the edge cache when it can, otherwise asks the origin (the generated OpenNext worker).
 * Adds one debug header, x-boi-edge-cache: hit, miss or bypass. Nothing else the visitor sees changes.
 */
export async function handleWithEdgeCache(
  request: Request,
  origin: Origin,
  store: EdgeStore,
  waitUntil: (p: Promise<unknown>) => void,
  enabled: boolean,
): Promise<Response> {
  if (!enabled) return origin(request);
  const url = new URL(request.url);
  if (bypassReason(request.method, url.pathname, request.headers)) {
    return withHeader(await origin(request), 'x-boi-edge-cache', 'bypass');
  }
  const ttl = routeClass(url.pathname).ttl;
  const key = new Request(canonicalCacheUrl(request.url), { method: 'GET' });
  const hit = await store.match(key);
  if (hit) return withHeader(hit, 'x-boi-edge-cache', 'hit');
  const response = await origin(request);
  if (storeRefusal(response.status, response.headers)) {
    return withHeader(response, 'x-boi-edge-cache', 'bypass');
  }
  waitUntil(store.put(key, storedCopy(response.clone(), ttl)));
  return withHeader(response, 'x-boi-edge-cache', 'miss');
}
