// Order 0720: on the no-storage build the origin answers private, no-store on every per-request page. With
// BOI_EDGE_IGNORE_ORIGIN_NO_STORE "1" such an HTML 200 page is stored; every other refusal still applies. Real header strings.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { handleWithEdgeCache, EDGE_IGNORE_ORIGIN_NO_STORE_VAR, type EdgeOptions } from '../worker/edge-cache';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

const DYNAMIC_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate',
  vary: 'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch',
};

function fakeStore() {
  const puts: string[] = [];
  return {
    puts,
    store: {
      async match() { return undefined; },
      async put(key: Request) { puts.push(key.url); },
    },
  };
}

async function run(
  path: string,
  options: EdgeOptions,
  opts: { method?: string; headers?: Record<string, string>; origin?: Partial<{ status: number; headers: Record<string, string>; body: string }> } = {},
) {
  const { store, puts } = fakeStore();
  let originCalls = 0;
  const origin = async () => {
    originCalls += 1;
    return new Response(opts.origin?.body ?? '<html>page</html>', {
      status: opts.origin?.status ?? 200,
      headers: opts.origin?.headers ?? DYNAMIC_HEADERS,
    });
  };
  const waits: Promise<unknown>[] = [];
  const response = await handleWithEdgeCache(
    new Request(`http://edge.test${path}`, { method: opts.method ?? 'GET', headers: opts.headers ?? {} }),
    origin,
    store,
    (p) => waits.push(p),
    options,
  );
  await Promise.all(waits);
  return { response, puts, originCalls };
}

const ON: EdgeOptions = { enabled: true, ignoreOriginNoStore: true };
const OFF: EdgeOptions = { enabled: true, ignoreOriginNoStore: false };

describe('dynamic HTML pages on the no-storage build (switch on)', () => {
  it('stores a dynamic 200 HTML page the origin marked private, no-store (home, deals, theme)', async () => {
    for (const path of ['/', '/deals', '/themes/star-wars', '/lab/price-drops']) {
      const { response, puts } = await run(path, ON);
      expect(puts.length, path).toBe(1);
      expect(response.headers.get('x-boi-edge-cache'), path).toBe('miss');
    }
  });
  it('a second request is a hit from the edge, and the origin is asked once', async () => {
    const kept = new Map<string, Response>();
    const cache = {
      async match(key: Request) { const r = kept.get(key.url); return r ? r.clone() : undefined; },
      async put(key: Request, r: Response) { kept.set(key.url, r); },
    };
    let originCalls = 0;
    const origin = async () => { originCalls += 1; return new Response('<html>page</html>', { status: 200, headers: DYNAMIC_HEADERS }); };
    const waits: Promise<unknown>[] = [];
    const first = await handleWithEdgeCache(new Request('http://edge.test/'), origin, cache, (p) => waits.push(p), ON);
    await Promise.all(waits);
    const second = await handleWithEdgeCache(new Request('http://edge.test/'), origin, cache, (p) => waits.push(p), ON);
    expect(first.headers.get('x-boi-edge-cache')).toBe('miss');
    expect(second.headers.get('x-boi-edge-cache')).toBe('hit');
    expect(originCalls).toBe(1);
  });
});

describe('every other refusal still applies with the switch on', () => {
  it('set-cookie on the response is still refused', async () => {
    const { response, puts } = await run('/', ON, { origin: { headers: { ...DYNAMIC_HEADERS, 'set-cookie': 'x=1; Path=/' } } });
    expect(puts.length).toBe(0);
    expect(response.headers.get('x-boi-edge-cache')).toBe('bypass');
  });
  it('a non-200 page is still refused', async () => {
    const { response, puts } = await run('/', ON, { origin: { status: 500 } });
    expect(puts.length).toBe(0);
    expect(response.headers.get('x-boi-edge-cache')).toBe('bypass');
  });
  it('a non-HTML response is still refused', async () => {
    const { puts } = await run('/', ON, { origin: { headers: { ...DYNAMIC_HEADERS, 'content-type': 'application/json' } } });
    expect(puts.length).toBe(0);
  });
  it('a Vary token outside the allowlist is still refused', async () => {
    const { puts } = await run('/', ON, { origin: { headers: { ...DYNAMIC_HEADERS, vary: 'cookie' } } });
    expect(puts.length).toBe(0);
  });
  it('a signed-in visitor (boi_account cookie) is still bypassed', async () => {
    const { response, puts, originCalls } = await run('/', ON, { headers: { cookie: 'boi_account=abc' } });
    expect(puts.length).toBe(0);
    expect(originCalls).toBe(1);
    expect(response.headers.get('x-boi-edge-cache')).toBe('bypass');
  });
  it('an admin signed-in visitor (boi_admin cookie) is still bypassed', async () => {
    const { response, puts } = await run('/', ON, { headers: { cookie: 'boi_admin=1' } });
    expect(puts.length).toBe(0);
    expect(response.headers.get('x-boi-edge-cache')).toBe('bypass');
  });
  it('the never-cache paths are still bypassed', async () => {
    for (const path of ['/admin/pending', '/api/saved-sets?ids=99001', '/auth/verify', '/account/delete/request', '/_next/static/x.js', '/cdn-cgi/x']) {
      const { response, puts } = await run(path, ON);
      expect(puts.length, path).toBe(0);
      expect(response.headers.get('x-boi-edge-cache'), path).toBe('bypass');
    }
  });
  it('RSC and prefetch requests are still bypassed', async () => {
    const { response, puts } = await run('/', ON, { headers: { rsc: '1' } });
    expect(puts.length).toBe(0);
    expect(response.headers.get('x-boi-edge-cache')).toBe('bypass');
  });
  it('non-GET and an authorization header are still bypassed', async () => {
    expect((await run('/', ON, { method: 'POST' })).puts.length).toBe(0);
    expect((await run('/', ON, { headers: { authorization: 'Bearer x' } })).puts.length).toBe(0);
  });
});

describe('the switch off keeps today\'s behaviour', () => {
  it('a dynamic private/no-store page is bypassed and not stored when the switch is off', async () => {
    for (const path of ['/', '/deals']) {
      const { response, puts } = await run(path, OFF);
      expect(puts.length, path).toBe(0);
      expect(response.headers.get('x-boi-edge-cache'), path).toBe('bypass');
    }
  });
  it('an unset switch is the same as off', async () => {
    const { puts } = await run('/', { enabled: true });
    expect(puts.length).toBe(0);
  });
});

describe('the variable is set only by the no-storage staging config (order 0720)', () => {
  it('entry.ts reads the variable into ignoreOriginNoStore', () => {
    expect(read('worker/entry.ts')).toContain('ignoreOriginNoStore: env[EDGE_IGNORE_ORIGIN_NO_STORE_VAR] === "1"');
    expect(EDGE_IGNORE_ORIGIN_NO_STORE_VAR).toBe('BOI_EDGE_IGNORE_ORIGIN_NO_STORE');
  });
  it('wrangler.staging.jsonc sets it to "1"', () => {
    expect(read('wrangler.staging.jsonc')).toMatch(/"BOI_EDGE_IGNORE_ORIGIN_NO_STORE": "1"/);
  });
  it('wrangler.jsonc (production) does not set it on this branch (added at cutover, PR 895)', () => {
    expect(read('wrangler.jsonc')).not.toMatch(/BOI_EDGE_IGNORE_ORIGIN_NO_STORE/);
  });
});
