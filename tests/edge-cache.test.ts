// Edge cache for rendered pages (order 0520 option C; fixes from order 0540; Phase 1 of order 0560).
// The header strings below are the REAL values from `wrangler dev` on the no-storage build (6 Nov 2026, local proof).
// They are copied as they came back, not written from memory. The tests prove: what is stored and what never is; the
// edge time and browser time; the Vary handling; a stored price is never older than the TTL plus the scrape interval.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  canonicalCacheUrl, routeClass, bypassReason, storeRefusal, handleWithEdgeCache, browserMaxAge,
  SET_PAGE_EDGE_TTL_SECONDS, PUBLISH_SENSITIVE_TTL_SECONDS, DEFAULT_EDGE_TTL_SECONDS,
  BROWSER_MAX_AGE_PUBLISH_SECONDS, BROWSER_MAX_AGE_OTHER_SECONDS, type EdgeStore,
} from '../worker/edge-cache';
import { SCRAPE_INTERVAL_HOURS } from '../src/lib/price-freshness';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

// ---- Real strings (wrangler dev, no-storage build, 6 Nov 2026) ----
const REAL = {
  // Vary on every HTML response from the origin (Next.js App Router).
  varyHtml: 'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch',
  // The adapter's own list (cacheInterceptor.js VARY_HEADER), which also names next-url.
  varyAdapter: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Next-Url',
  // Origin Cache-Control, read through a bypass (signed-in cookie), so it is the origin's own value.
  originSet: 's-maxage=86394, stale-while-revalidate=2592000',
  originNews: 's-maxage=2, stale-while-revalidate=2592000',
  originHome: 's-maxage=86334, stale-while-revalidate=2592000',
  // Dynamic and admin responses.
  dynamic: 'no-store, no-cache, must-revalidate, private',
  notFound: 'private, no-cache, no-store, max-age=0, must-revalidate',
  // Sitemap content type.
  sitemapType: 'application/xml',
};
const HTML = 'text/html; charset=utf-8';

function fakeStore() {
  const map = new Map<string, Response>();
  const log = { puts: [] as { url: string; cacheControl: string | null; vary: string | null }[], matches: 0 };
  const store: EdgeStore = {
    async match(key) { log.matches++; const r = map.get(key.url); return r ? new Response(r.body, r) : undefined; },
    async put(key, response) {
      log.puts.push({ url: key.url, cacheControl: response.headers.get('cache-control'), vary: response.headers.get('vary') });
      map.set(key.url, response);
    },
  };
  return { store, log, map };
}

/** A fake origin that returns the same real-looking response each time and counts renders. */
function origin(make: () => Response) {
  let calls = 0;
  return { fn: async (_r: Request) => { calls++; return make(); }, count: () => calls };
}

const pending: Promise<unknown>[] = [];
const waitUntil = (p: Promise<unknown>) => { pending.push(p); };
const flush = async () => { await Promise.all(pending.splice(0)); };
const req = (url: string, headers: Record<string, string> = {}, method = 'GET') => new Request(url, { headers, method });
const page = (cacheControl: string, vary: string | undefined = REAL.varyHtml, type = HTML) => {
  const h = new Headers({ 'content-type': type, 'cache-control': cacheControl });
  if (vary !== undefined) h.set('vary', vary);
  return new Response('<html>page</html>', { status: 200, headers: h });
};
const ON = { enabled: true };

describe('the Vary header Next.js really sends', () => {
  it('the real HTML Vary is accepted', () => {
    expect(storeRefusal('/sets/1', 200, new Headers({ 'content-type': HTML, 'cache-control': REAL.originSet, vary: REAL.varyHtml }))).toBeNull();
  });
  it('the adapter list, which also names Next-Url, is accepted', () => {
    expect(storeRefusal('/sets/1', 200, new Headers({ 'content-type': HTML, 'cache-control': REAL.originSet, vary: REAL.varyAdapter }))).toBeNull();
  });
  it('Vary: * is never stored, and an unknown token is never stored', () => {
    expect(storeRefusal('/sets/1', 200, new Headers({ 'content-type': HTML, vary: '*' }))).toBe('vary');
    expect(storeRefusal('/sets/1', 200, new Headers({ 'content-type': HTML, vary: 'cookie' }))).toBe('vary');
  });
});

describe('the origin Cache-Control: the public pages are stored, the private ones are not', () => {
  it('the real public values are stored (the edge time comes from the route class, not from the origin)', () => {
    for (const cc of [REAL.originSet, REAL.originNews, REAL.originHome]) {
      expect(storeRefusal('/x', 200, new Headers({ 'content-type': HTML, 'cache-control': cc, vary: REAL.varyHtml }))).toBeNull();
    }
  });
  it('the real dynamic and admin values are refused', () => {
    expect(storeRefusal('/admin/pending', 200, new Headers({ 'content-type': HTML, 'cache-control': REAL.dynamic, vary: REAL.varyHtml }))).toBe('private');
  });
  it('the real not-found value is refused (and a 404 is never stored by status)', () => {
    expect(storeRefusal('/my', 404, new Headers({ 'content-type': HTML, 'cache-control': REAL.notFound, vary: REAL.varyHtml }))).toBe('status');
  });
});

describe('the sitemap and robots file', () => {
  it('the real sitemap type is stored on the sitemap path only', () => {
    const h = new Headers({ 'content-type': REAL.sitemapType, 'cache-control': REAL.originSet, vary: REAL.varyHtml });
    expect(storeRefusal('/sitemap.xml', 200, h)).toBeNull();
    expect(storeRefusal('/news/a', 200, h)).toBe('not-html');
  });
  it('robots is stored as text on its path only', () => {
    const h = new Headers({ 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' });
    expect(storeRefusal('/robots.txt', 200, h)).toBeNull();
    expect(storeRefusal('/sets/1', 200, h)).toBe('not-html');
  });
  it('the sitemap is cached for an hour, and a second request is a hit', async () => {
    const { store } = fakeStore();
    const o = origin(() => page(REAL.originSet, REAL.varyHtml, REAL.sitemapType));
    const a = await handleWithEdgeCache(req('https://x.test/sitemap.xml'), o.fn, store, waitUntil, ON);
    expect(a.headers.get('x-boi-edge-cache')).toBe('miss');
    await flush();
    const b = await handleWithEdgeCache(req('https://x.test/sitemap.xml'), o.fn, store, waitUntil, ON);
    expect(b.headers.get('x-boi-edge-cache')).toBe('hit');
    expect(o.count()).toBe(1);
    expect(DEFAULT_EDGE_TTL_SECONDS).toBe(3600);
  });
});

describe('edge time and browser time', () => {
  it('the stored copy carries the edge time as s-maxage, and no Vary', async () => {
    const { store, log } = fakeStore();
    const o = origin(() => page(REAL.originSet));
    await handleWithEdgeCache(req('https://x.test/sets/1'), o.fn, store, waitUntil, ON);
    await flush();
    expect(log.puts[0].cacheControl).toBe(`public, s-maxage=${SET_PAGE_EDGE_TTL_SECONDS}, max-age=${SET_PAGE_EDGE_TTL_SECONDS}`);
    expect(log.puts[0].vary).toBeNull();
  });
  it('the visitor gets a short browser max-age: 300 s on a set page, 60 s on a publish page', async () => {
    const { store } = fakeStore();
    const set = origin(() => page(REAL.originSet));
    const s = await handleWithEdgeCache(req('https://x.test/sets/2'), set.fn, store, waitUntil, ON);
    expect(s.headers.get('cache-control')).toBe(`public, max-age=${BROWSER_MAX_AGE_OTHER_SECONDS}`);
    const news = origin(() => page(REAL.originNews));
    const n = await handleWithEdgeCache(req('https://x.test/news/3'), news.fn, store, waitUntil, ON);
    expect(n.headers.get('cache-control')).toBe(`public, max-age=${BROWSER_MAX_AGE_PUBLISH_SECONDS}`);
    expect(browserMaxAge('/news/3')).toBe(60);
    expect(browserMaxAge('/sets/2')).toBe(300);
  });
  it('a hit is served with the same short browser max-age, not the stored copy header', async () => {
    const { store } = fakeStore();
    const o = origin(() => page(REAL.originSet));
    await handleWithEdgeCache(req('https://x.test/sets/4'), o.fn, store, waitUntil, ON);
    await flush();
    const hit = await handleWithEdgeCache(req('https://x.test/sets/4'), o.fn, store, waitUntil, ON);
    expect(hit.headers.get('x-boi-edge-cache')).toBe('hit');
    expect(hit.headers.get('cache-control')).toBe(`public, max-age=${BROWSER_MAX_AGE_OTHER_SECONDS}`);
    expect(hit.headers.get('cache-control')).not.toMatch(/s-maxage/);
  });
  it('the stored copy edge time is at most 48 hours and the price rule holds for every route class', () => {
    expect((SET_PAGE_EDGE_TTL_SECONDS / 3600) + SCRAPE_INTERVAL_HOURS).toBeLessThanOrEqual(48);
    expect((DEFAULT_EDGE_TTL_SECONDS / 3600) + SCRAPE_INTERVAL_HOURS).toBeLessThanOrEqual(48);
    expect((PUBLISH_SENSITIVE_TTL_SECONDS / 3600) + SCRAPE_INTERVAL_HOURS).toBeLessThanOrEqual(48);
  });
});

describe('miss, hit, and expiry', () => {
  it('first view is a miss and stores; second view is a hit and does not render', async () => {
    const { store } = fakeStore();
    const o = origin(() => page(REAL.originSet));
    const a = await handleWithEdgeCache(req('https://x.test/sets/5'), o.fn, store, waitUntil, ON);
    expect(a.headers.get('x-boi-edge-cache')).toBe('miss');
    await flush();
    const b = await handleWithEdgeCache(req('https://x.test/sets/5'), o.fn, store, waitUntil, ON);
    expect(b.headers.get('x-boi-edge-cache')).toBe('hit');
    expect(o.count()).toBe(1);
  });
  it('a short test TTL is stored as the edge time (the wrangler dev proof uses 5 s and watches it expire)', async () => {
    const { store, log } = fakeStore();
    const o = origin(() => page(REAL.originSet));
    await handleWithEdgeCache(req('https://x.test/sets/6'), o.fn, store, waitUntil, { enabled: true, ttlOverride: 5 });
    await flush();
    expect(log.puts[0].cacheControl).toBe('public, s-maxage=5, max-age=5');
  });
  it('without an override the route TTL applies', async () => {
    const { store, log } = fakeStore();
    const o = origin(() => page(REAL.originNews));
    await handleWithEdgeCache(req('https://x.test/news/7'), o.fn, store, waitUntil, ON);
    await flush();
    expect(log.puts[0].cacheControl).toBe(`public, s-maxage=${PUBLISH_SENSITIVE_TTL_SECONDS}, max-age=${PUBLISH_SENSITIVE_TTL_SECONDS}`);
  });
});

describe('bypass: these are never read from or written to the cache', () => {
  it('admin, API, auth, account and framework paths', () => {
    for (const p of ['/admin/pending', '/api/saved-sets', '/auth/code', '/account/delete/request', '/_next/static/x.js', '/cdn-cgi/x']) {
      expect(bypassReason('GET', p, new Headers())).toBe('never-route');
    }
  });
  it('a signed-in visitor (account or admin cookie), with or without other cookies', () => {
    expect(bypassReason('GET', '/sets/1', new Headers({ cookie: 'boi_account=abc' }))).toBe('signed-in');
    expect(bypassReason('GET', '/sets/1', new Headers({ cookie: 'theme=x; boi_admin=abc' }))).toBe('signed-in');
  });
  it('a visitor with only other cookies is cached as anonymous', () => {
    expect(bypassReason('GET', '/sets/1', new Headers({ cookie: 'analytics=1' }))).toBeNull();
  });
  it('RSC and prefetch requests (client navigation), non-GET, and authorised requests', () => {
    expect(bypassReason('GET', '/sets/1', new Headers({ rsc: '1' }))).toBe('rsc');
    expect(bypassReason('GET', '/sets/1', new Headers({ 'next-router-prefetch': '1' }))).toBe('rsc');
    expect(bypassReason('POST', '/sets/1', new Headers())).toBe('method');
    expect(bypassReason('GET', '/sets/1', new Headers({ authorization: 'Bearer x' }))).toBe('auth-header');
  });
  it('through the flow: signed-in visitors always reach the origin and write nothing', async () => {
    const { store, log } = fakeStore();
    const o = origin(() => page(REAL.originSet));
    const a = await handleWithEdgeCache(req('https://x.test/sets/8', { cookie: 'boi_account=a' }), o.fn, store, waitUntil, ON);
    const b = await handleWithEdgeCache(req('https://x.test/sets/8', { cookie: 'boi_account=a' }), o.fn, store, waitUntil, ON);
    expect(a.headers.get('x-boi-edge-cache')).toBe('bypass');
    expect(b.headers.get('x-boi-edge-cache')).toBe('bypass');
    expect(o.count()).toBe(2);
    expect(log.matches).toBe(0);
    expect(log.puts).toEqual([]);
  });
  it('an RSC request through the flow is bypassed and nothing is stored', async () => {
    const { store, log } = fakeStore();
    const o = origin(() => page(REAL.originSet));
    const r = await handleWithEdgeCache(req('https://x.test/sets/9', { rsc: '1' }), o.fn, store, waitUntil, ON);
    expect(r.headers.get('x-boi-edge-cache')).toBe('bypass');
    expect(log.puts).toEqual([]);
  });
  it('a response that sets a cookie is never stored', async () => {
    const { store, log } = fakeStore();
    const o = origin(() => new Response('<html/>', { status: 200, headers: { 'content-type': HTML, 'cache-control': REAL.originSet, vary: REAL.varyHtml, 'set-cookie': 'x=1' } }));
    const r = await handleWithEdgeCache(req('https://x.test/sets/10'), o.fn, store, waitUntil, ON);
    expect(r.headers.get('x-boi-edge-cache')).toBe('bypass');
    expect(log.puts).toEqual([]);
  });
  it('an error (500) and a not-found (404) are never stored, and the next view renders again', async () => {
    const { store, log } = fakeStore();
    const bad = origin(() => new Response('boom', { status: 500, headers: { 'content-type': HTML, 'cache-control': REAL.dynamic } }));
    const r = await handleWithEdgeCache(req('https://x.test/sets/11'), bad.fn, store, waitUntil, ON);
    expect(r.headers.get('x-boi-edge-cache')).toBe('bypass');
    const missing = origin(() => new Response('nope', { status: 404, headers: { 'content-type': HTML, 'cache-control': REAL.notFound, vary: REAL.varyHtml } }));
    await handleWithEdgeCache(req('https://x.test/sets/12'), missing.fn, store, waitUntil, ON);
    expect(log.puts).toEqual([]);
    await handleWithEdgeCache(req('https://x.test/sets/11'), bad.fn, store, waitUntil, ON);
    expect(bad.count()).toBe(2);
  });
  it('the admin page is bypassed through the flow even when the origin sends a page', async () => {
    const { store, log } = fakeStore();
    const o = origin(() => page(REAL.dynamic));
    const r = await handleWithEdgeCache(req('https://x.test/admin/pending'), o.fn, store, waitUntil, ON);
    expect(r.headers.get('x-boi-edge-cache')).toBe('bypass');
    expect(log.puts).toEqual([]);
  });
  it('a dynamic response with the real private value is not stored even on a public path', async () => {
    const { store, log } = fakeStore();
    const o = origin(() => page(REAL.dynamic));
    await handleWithEdgeCache(req('https://x.test/sets/13'), o.fn, store, waitUntil, ON);
    expect(log.puts).toEqual([]);
  });
  it('when the switch is off, nothing is read, stored, or marked', async () => {
    const { store, log } = fakeStore();
    const o = origin(() => page(REAL.originSet));
    const r = await handleWithEdgeCache(req('https://x.test/sets/14'), o.fn, store, waitUntil, { enabled: false });
    expect(r.headers.get('x-boi-edge-cache')).toBeNull();
    expect(log.matches).toBe(0);
    expect(log.puts).toEqual([]);
  });
});

describe('the cache key', () => {
  it('ignores tracking parameters', () => {
    expect(canonicalCacheUrl('https://x.test/sets/1?utm_source=a&gclid=9')).toBe(canonicalCacheUrl('https://x.test/sets/1'));
  });
  it('keeps other parameters, sorted; different values are different pages', () => {
    expect(canonicalCacheUrl('https://x.test/sets?b=2&a=1')).toBe('https://x.test/sets?a=1&b=2');
    expect(canonicalCacheUrl('https://x.test/sets?page=2')).not.toBe(canonicalCacheUrl('https://x.test/sets?page=3'));
  });
  it('a tracking parameter visit shares the cached page', async () => {
    const { store } = fakeStore();
    const o = origin(() => page(REAL.originSet));
    await handleWithEdgeCache(req('https://x.test/sets/15?utm_source=a'), o.fn, store, waitUntil, ON);
    await flush();
    const b = await handleWithEdgeCache(req('https://x.test/sets/15?fbclid=zz'), o.fn, store, waitUntil, ON);
    expect(b.headers.get('x-boi-edge-cache')).toBe('hit');
  });
});

describe('a publish still refreshes the page it should', () => {
  it('the admin publish and approve actions still call the path refresh', () => {
    const actions = read('src/app/admin/pending/actions.ts');
    expect(actions).toMatch(/revalidatePath\('\/admin\/pending'\)/);
    expect(actions).toMatch(/onPublished: \(publishedPath\) => revalidatePath\(publishedPath\)/);
  });
  it('a published article is in the five-minute class', () => {
    expect(routeClass('/reviews/new-review').ttl).toBeLessThanOrEqual(5 * 60);
    expect(routeClass('/news/new-article').ttl).toBeLessThanOrEqual(5 * 60);
  });
});

describe('production is off, and the build flag for the no-storage build exists', () => {
  it('the production Worker variable is "0"; staging turns the cache on', () => {
    // Cutover (order 0570 item 2): production is switched on together with the build flag in deploy-cloudflare.yml.
    expect(read('wrangler.jsonc')).toMatch(/"BOI_EDGE_CACHE": "1"/);
    expect(read('wrangler.staging.jsonc')).toMatch(/"BOI_EDGE_CACHE": "1"/);
  });
  it('both configs point at the wrapper entry', () => {
    expect(read('wrangler.jsonc')).toMatch(/"main": "worker\/entry\.ts"/);
    expect(read('wrangler.staging.jsonc')).toMatch(/"main": "worker\/entry\.ts"/);
  });
  it('the no-storage build flag is read at build time, and production keeps storage unless it is set', () => {
    const cfg = read('open-next.config.ts');
    expect(cfg).toMatch(/process\.env\.BOI_PRODUCTION_NO_STORAGE === "1"/);
    expect(cfg).toMatch(/process\.env\.BOI_STAGING === "1"/);
    expect(cfg).toMatch(/incrementalCache: r2IncrementalCache/);
  });
  it('the Worker entry wraps the generated worker and no longer exports the Durable Object classes (cleanup, order 0600)', () => {
    const entry = read('worker/entry.ts');
    expect(entry).toMatch(/import generated from "\.\.\/\.open-next\/worker\.js"/);
    expect(entry).not.toMatch(/DOQueueHandler|DOShardedTagCache|BucketCachePurge/);
    expect(entry).toMatch(/env\[EDGE_CACHE_VAR\] === "1"/);
  });
  it('both configs have no Durable Object or R2 bindings, and a migration deletes the two classes', () => {
    for (const f of ['wrangler.jsonc', 'wrangler.staging.jsonc']) {
      const cfg = read(f);
      expect(cfg).not.toMatch(/"durable_objects"/);
      expect(cfg).not.toMatch(/"r2_buckets"/);
      expect(cfg).toMatch(/"tag": "v2",\s*"deleted_classes": \["DOQueueHandler", "DOShardedTagCache"\]/);
      expect(cfg).toMatch(/"tag": "v1",\s*"new_sqlite_classes": \["DOQueueHandler", "DOShardedTagCache"\]/);
    }
  });
});
