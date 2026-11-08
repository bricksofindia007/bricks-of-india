// Order 0620 item 2: the /sets list is stored at the edge for anonymous visitors only when every query key and value is one
// the page accepts. Real header strings; the origin response carries the no-store headers the no-storage render sends.
import { describe, it, expect } from 'vitest';
import { handleWithEdgeCache, setsListQueryAllowed, storeRefusal, bypassReason, SETS_LIST_MAX_CACHED_PAGE, SET_PAGE_EDGE_TTL_SECONDS } from '../worker/edge-cache';
import { SETS_PRICE_BANDS } from '../src/lib/price-bands';

const ORIGIN_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate',
  vary: 'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch',
};

function fakeStore() {
  const puts: { key: string; cacheControl: string | null }[] = [];
  return {
    puts,
    store: {
      async match() { return undefined; },
      async put(key: Request, response: Response) { puts.push({ key: key.url, cacheControl: response.headers.get('cache-control') }); },
    },
  };
}

async function run(path: string, headers: Record<string, string> = {}) {
  const { store, puts } = fakeStore();
  let originCalls = 0;
  const origin = async () => { originCalls += 1; return new Response('<html>list</html>', { status: 200, headers: ORIGIN_HEADERS }); };
  const waits: Promise<unknown>[] = [];
  const response = await handleWithEdgeCache(
    new Request(`http://edge.test${path}`, { headers }),
    origin,
    store,
    (p) => waits.push(p),
    { enabled: true },
  );
  await Promise.all(waits);
  return { response, puts, originCalls };
}

describe('the /sets query allowlist', () => {
  it('accepts the list with every accepted key and value', () => {
    expect(setsListQueryAllowed(new URLSearchParams('page=2&sort=price_asc&price=10k&theme=star-wars&instock=1'))).toBe(true);
    expect(setsListQueryAllowed(new URLSearchParams('sort=price-desc'))).toBe(true);
    expect(setsListQueryAllowed(new URLSearchParams(''))).toBe(true);
  });
  it('ignores tracking parameters (they are left out of the key anyway)', () => {
    expect(setsListQueryAllowed(new URLSearchParams('utm_source=x&page=2&gclid=abc'))).toBe(true);
  });
  it('refuses an unknown key', () => {
    expect(setsListQueryAllowed(new URLSearchParams('foo=1'))).toBe(false);
    expect(setsListQueryAllowed(new URLSearchParams('page=2&q=lego'))).toBe(false);
  });
  it('refuses a bad value for each key', () => {
    for (const q of ['page=0', 'page=-1', 'page=abc', `page=${SETS_LIST_MAX_CACHED_PAGE + 1}`, 'page=', 'sort=evil', 'sort=', 'instock=0', 'instock=true', 'price=1k', 'theme=Star Wars', 'theme=Star%20Wars', 'theme=-bad']) {
      expect(setsListQueryAllowed(new URLSearchParams(q)), q).toBe(false);
    }
  });
  it('refuses a repeated key', () => {
    expect(setsListQueryAllowed(new URLSearchParams('page=1&page=2'))).toBe(false);
  });
  it('the price keys are exactly the page bands', () => {
    expect(Object.keys(SETS_PRICE_BANDS).sort()).toEqual(['10k', '2k5k', '5k10k', 'under2k']);
  });
});

describe('the /sets list at the edge', () => {
  it('stores the plain list for an anonymous visitor (origin no-store is ignored for this path only)', async () => {
    const { response, puts, originCalls } = await run('/sets');
    expect(originCalls).toBe(1);
    expect(puts.length).toBe(1);
    expect(puts[0].cacheControl).toBe(`public, s-maxage=${SET_PAGE_EDGE_TTL_SECONDS}, max-age=${SET_PAGE_EDGE_TTL_SECONDS}`);
    expect(response.headers.get('x-boi-edge-cache')).toBe('miss');
  });
  it('stores an allowlisted filtered list', async () => {
    const { response, puts } = await run('/sets?page=2&sort=price_asc&instock=1');
    expect(puts.length).toBe(1);
    expect(response.headers.get('x-boi-edge-cache')).toBe('miss');
  });
  it('bypasses a list with an unknown key (origin asked, nothing stored)', async () => {
    const { response, puts, originCalls } = await run('/sets?foo=1');
    expect(originCalls).toBe(1);
    expect(puts.length).toBe(0);
    expect(response.headers.get('x-boi-edge-cache')).toBe('bypass');
  });
  it('bypasses a list with a bad value', async () => {
    const { response, puts } = await run('/sets?sort=evil');
    expect(puts.length).toBe(0);
    expect(response.headers.get('x-boi-edge-cache')).toBe('bypass');
  });
  it('bypasses a signed-in visitor even on an allowed list', async () => {
    const { response, puts } = await run('/sets?page=2', { cookie: 'boi_account=abc' });
    expect(puts.length).toBe(0);
    expect(response.headers.get('x-boi-edge-cache')).toBe('bypass');
  });
  it('bypasses an RSC (client navigation) request on an allowed list', async () => {
    const { response, puts } = await run('/sets?page=2', { rsc: '1' });
    expect(puts.length).toBe(0);
    expect(response.headers.get('x-boi-edge-cache')).toBe('bypass');
  });
  it('set pages keep the old rule: origin no-store is still refused', () => {
    expect(storeRefusal('/sets/10305-x', 200, new Headers(ORIGIN_HEADERS))).toBe('private');
    expect(storeRefusal('/sets', 200, new Headers(ORIGIN_HEADERS), true)).toBeNull();
  });
  it('a set cookie is still refused on the list', () => {
    const h = new Headers({ ...ORIGIN_HEADERS, 'set-cookie': 'x=1' });
    expect(storeRefusal('/sets', 200, h, true)).toBe('set-cookie');
  });
  it('the signed-in bypass is unchanged', () => {
    expect(bypassReason('GET', '/sets', new Headers({ cookie: 'boi_admin=1' }))).toBe('signed-in');
  });
});
