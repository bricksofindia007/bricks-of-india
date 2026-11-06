// Edge cache for rendered pages (order 0520, option C). Proves: what is stored and what never is; a stored price is never
// older than its TTL plus the scrape interval; an error is never stored; a publish still refreshes (by the path calls, and
// the short TTL on publish pages); the switch off passes everything through.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  canonicalCacheUrl, routeClass, bypassReason, storeRefusal, handleWithEdgeCache,
  SET_PAGE_EDGE_TTL_SECONDS, PUBLISH_SENSITIVE_TTL_SECONDS, DEFAULT_EDGE_TTL_SECONDS, type EdgeStore,
} from '../worker/edge-cache';
import { SCRAPE_INTERVAL_HOURS } from '../src/lib/price-freshness';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const HTML = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-cache, no-store' };

function fakeStore() {
  const map = new Map<string, Response>();
  const log = { puts: [] as string[], matches: 0 };
  const store: EdgeStore = {
    async match(key) { log.matches++; const r = map.get(key.url); return r ? new Response(r.body, r) : undefined; },
    async put(key, response) { log.puts.push(key.url); map.set(key.url, response); },
  };
  return { store, log, map };
}

function origin(make: (n: number) => Response) {
  let calls = 0;
  const fn = async (_r: Request) => make(++calls);
  return { fn, count: () => calls };
}

const waits: Promise<unknown>[] = [];
const waitUntil = (p: Promise<unknown>) => { waits.push(p); };
const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });
// A page that may be stored: ISR-style cache header from the framework, no private marker.
const CACHEABLE = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 's-maxage=86400, stale-while-revalidate=2592000' };
const html = () => new Response('<html>ok</html>', { status: 200, headers: CACHEABLE });

describe('which pages are cached, and for how long', () => {
  it('set pages: one hour', () => {
    expect(routeClass('/sets/90001-x')).toEqual({ name: 'set', ttl: SET_PAGE_EDGE_TTL_SECONDS });
    expect(SET_PAGE_EDGE_TTL_SECONDS).toBe(3600);
  });
  it('publish-sensitive pages: five minutes (home, news, reviews, guides, community, blog, corrections, opinion, deals)', () => {
    for (const p of ['/', '/news/x', '/reviews/x', '/guides/x', '/community/x', '/blog/x', '/corrections', '/opinion', '/deals']) {
      expect(routeClass(p)).toEqual({ name: 'publish', ttl: PUBLISH_SENSITIVE_TTL_SECONDS });
    }
    expect(PUBLISH_SENSITIVE_TTL_SECONDS).toBe(300);
  });
  it('other HTML pages: one hour', () => {
    expect(routeClass('/themes/x')).toEqual({ name: 'default', ttl: DEFAULT_EDGE_TTL_SECONDS });
    expect(routeClass('/newsletter')).toEqual({ name: 'default', ttl: DEFAULT_EDGE_TTL_SECONDS });
  });
  it('a stored price is never older than the TTL plus the scrape interval, far under 48 hours', () => {
    const worstSetPageHours = SET_PAGE_EDGE_TTL_SECONDS / 3600 + SCRAPE_INTERVAL_HOURS;
    expect(worstSetPageHours).toBeLessThanOrEqual(48);
    const worstOtherHours = DEFAULT_EDGE_TTL_SECONDS / 3600 + SCRAPE_INTERVAL_HOURS;
    expect(worstOtherHours).toBeLessThanOrEqual(48);
  });
});

describe('pages that must never be cached', () => {
  it('admin, API, auth, account and framework routes', () => {
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
  it('client navigation and prefetch responses (RSC), non-GET requests, and authorised requests', () => {
    expect(bypassReason('GET', '/sets/1', new Headers({ rsc: '1' }))).toBe('rsc');
    expect(bypassReason('GET', '/sets/1', new Headers({ 'next-router-prefetch': '1' }))).toBe('rsc');
    expect(bypassReason('POST', '/sets/1', new Headers())).toBe('method');
    expect(bypassReason('GET', '/sets/1', new Headers({ authorization: 'Bearer x' }))).toBe('auth-header');
  });
  it('an error (any status other than 200) is never stored', () => {
    expect(storeRefusal(500, new Headers(HTML))).toBe('status');
    expect(storeRefusal(404, new Headers(HTML))).toBe('status');
    expect(storeRefusal(302, new Headers(HTML))).toBe('status');
  });
  it('a response that sets a cookie, is not HTML, is private, or varies on another header is never stored', () => {
    expect(storeRefusal(200, new Headers({ ...HTML, 'set-cookie': 'x=1' }))).toBe('set-cookie');
    expect(storeRefusal(200, new Headers({ 'content-type': 'application/json' }))).toBe('not-html');
    expect(storeRefusal(200, new Headers({ 'content-type': 'text/html', 'cache-control': 'private' }))).toBe('private');
    expect(storeRefusal(200, new Headers({ 'content-type': 'text/html', vary: 'RSC' }))).toBe('vary');
    expect(storeRefusal(200, new Headers({ 'content-type': 'text/html', vary: 'Accept-Encoding' }))).toBeNull();
  });
});

describe('the cache key', () => {
  it('ignores tracking parameters', () => {
    expect(canonicalCacheUrl('https://x.test/sets/1?utm_source=a&gclid=9')).toBe(canonicalCacheUrl('https://x.test/sets/1'));
  });
  it('keeps other parameters, and sorts them', () => {
    expect(canonicalCacheUrl('https://x.test/sets?b=2&a=1')).toBe('https://x.test/sets?a=1&b=2');
    expect(canonicalCacheUrl('https://x.test/sets?page=2')).not.toBe(canonicalCacheUrl('https://x.test/sets?page=3'));
  });
});

describe('the flow', () => {
  it('switch off: everything passes through, nothing is read or stored, no debug header', async () => {
    const { store, log } = fakeStore();
    const o = origin(() => html());
    const res = await handleWithEdgeCache(req('https://x.test/sets/1'), o.fn, store, waitUntil, false);
    expect(res.headers.has('x-boi-edge-cache')).toBe(false);
    expect(o.count()).toBe(1);
    expect(log.matches).toBe(0);
    expect(log.puts).toEqual([]);
  });

  it('switch on: the first view is a miss and stores the page; the next view is a hit and does not render', async () => {
    const { store, log } = fakeStore();
    const o = origin(() => html());
    const a = await handleWithEdgeCache(req('https://x.test/sets/1'), o.fn, store, waitUntil, true);
    expect(a.headers.get('x-boi-edge-cache')).toBe('miss');
    await Promise.all(waits.splice(0));
    const b = await handleWithEdgeCache(req('https://x.test/sets/1'), o.fn, store, waitUntil, true);
    expect(b.headers.get('x-boi-edge-cache')).toBe('hit');
    expect(o.count()).toBe(1);
    expect(log.puts.length).toBe(1);
    expect(await b.text()).toBe('<html>ok</html>');
  });

  it('the stored copy carries the route TTL as its max-age, and no cookie', async () => {
    const { store, map } = fakeStore();
    const o = origin(() => new Response('x', { status: 200, headers: { ...HTML, 'set-cookie': 'z=1' } }));
    await handleWithEdgeCache(req('https://x.test/news/a'), o.fn, store, waitUntil, true);
    await Promise.all(waits.splice(0));
    const stored = map.get('https://x.test/news/a');
    expect(stored).toBeUndefined(); // set-cookie response is never stored
    const ok = origin(() => html());
    await handleWithEdgeCache(req('https://x.test/news/a'), ok.fn, store, waitUntil, true);
    await Promise.all(waits.splice(0));
    expect(map.get('https://x.test/news/a')?.headers.get('cache-control')).toBe(`public, max-age=${PUBLISH_SENSITIVE_TTL_SECONDS}`);
  });

  it('a signed-in visitor is never served from the cache and never writes to it', async () => {
    const { store, log } = fakeStore();
    const o = origin(() => html());
    const r1 = await handleWithEdgeCache(req('https://x.test/sets/1', { cookie: 'boi_account=a' }), o.fn, store, waitUntil, true);
    const r2 = await handleWithEdgeCache(req('https://x.test/sets/1', { cookie: 'boi_account=a' }), o.fn, store, waitUntil, true);
    expect(r1.headers.get('x-boi-edge-cache')).toBe('bypass');
    expect(r2.headers.get('x-boi-edge-cache')).toBe('bypass');
    expect(o.count()).toBe(2);
    expect(log.matches).toBe(0);
    expect(log.puts).toEqual([]);
  });

  it('an error is never stored: the next view renders again', async () => {
    const { store, log } = fakeStore();
    const o = origin(() => new Response('boom', { status: 500, headers: HTML }));
    const r = await handleWithEdgeCache(req('https://x.test/sets/2'), o.fn, store, waitUntil, true);
    expect(r.headers.get('x-boi-edge-cache')).toBe('bypass');
    expect(log.puts).toEqual([]);
    await handleWithEdgeCache(req('https://x.test/sets/2'), o.fn, store, waitUntil, true);
    expect(o.count()).toBe(2);
  });

  it('tracking parameters share one cached page', async () => {
    const { store } = fakeStore();
    const o = origin(() => html());
    await handleWithEdgeCache(req('https://x.test/sets/3?utm_source=a'), o.fn, store, waitUntil, true);
    await Promise.all(waits.splice(0));
    const b = await handleWithEdgeCache(req('https://x.test/sets/3?fbclid=zz'), o.fn, store, waitUntil, true);
    expect(b.headers.get('x-boi-edge-cache')).toBe('hit');
    expect(o.count()).toBe(1);
  });
});

describe('a publish still refreshes the page it should', () => {
  it('the admin publish and approve actions still call the path refresh', () => {
    const actions = read('src/app/admin/pending/actions.ts');
    expect(actions).toMatch(/revalidatePath\('\/admin\/pending'\)/);
    expect(actions).toMatch(/onPublished: \(publishedPath\) => revalidatePath\(publishedPath\)/);
  });
  it('a published article page is in the five-minute class, so a publish shows within five minutes', () => {
    expect(routeClass('/reviews/new-review').ttl).toBeLessThanOrEqual(5 * 60);
    expect(routeClass('/news/new-article').ttl).toBeLessThanOrEqual(5 * 60);
  });
});

describe('wiring', () => {
  it('the Worker entry wraps the generated worker and re-exports the Durable Object classes the bindings name', () => {
    const entry = read('worker/entry.ts');
    expect(entry).toMatch(/import generated from "\.\.\/\.open-next\/worker\.js"/);
    expect(entry).toMatch(/export \{ DOQueueHandler, DOShardedTagCache, BucketCachePurge \}/);
    expect(entry).toMatch(/env\[EDGE_CACHE_VAR\] === "1"/);
  });
  it('production is off by default; staging turns it on', () => {
    expect(read('wrangler.jsonc')).toMatch(/"BOI_EDGE_CACHE": "0"/);
    expect(read('wrangler.staging.jsonc')).toMatch(/"BOI_EDGE_CACHE": "1"/);
  });
  it('both configs point at the wrapper entry', () => {
    expect(read('wrangler.jsonc')).toMatch(/"main": "worker\/entry\.ts"/);
    expect(read('wrangler.staging.jsonc')).toMatch(/"main": "worker\/entry\.ts"/);
  });
});
