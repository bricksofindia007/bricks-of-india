// Worker entry: the edge page cache in front of the site's own handler.
// wrangler "main" points here (draft; not switched on). Requests the cache decision
// does not allow go straight to the site, unchanged.
//
// Stored copies: 200 responses only, never ones that set a cookie. Each stored
// copy carries a short max-age, so the cache drops it after MAX_AGE_SECONDS even
// if nothing refreshes it. A copy older than REFRESH_AFTER_MS is served once more
// while a background request fetches a fresh one.
//
// Failure: if the cache read or write throws, the request is answered by the
// site as normal (no cache, no error to the visitor).

import site from '../.open-next/worker.js';
import { cacheDecision, isFresh, MAX_AGE_SECONDS } from '../src/lib/page-cache';

const STORED_AT = 'x-boi-stored-at';

async function store(cache: Cache, key: string, res: Response): Promise<void> {
  const body = await res.arrayBuffer();
  const headers = new Headers(res.headers);
  headers.set('cache-control', `public, max-age=${MAX_AGE_SECONDS}`);
  headers.set(STORED_AT, String(Date.now()));
  headers.delete('set-cookie');
  await cache.put(new Request(key), new Response(body, { status: 200, headers }));
}

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
    const decision = cacheDecision(request.method, new URL(request.url), request.headers);
    if (!decision.cache) return site.fetch(request, env as never, ctx);

    try {
      const cache = caches.default;
      const hit = await cache.match(new Request(decision.key));
      if (hit) {
        const storedAt = Number(hit.headers.get(STORED_AT));
        if (!isFresh(storedAt, Date.now())) {
          ctx.waitUntil(
            (async () => {
              const fresh = await site.fetch(request, env as never, ctx);
              if (fresh.status === 200 && !fresh.headers.has('set-cookie')) await store(cache, decision.key, fresh.clone());
            })().catch(() => undefined),
          );
        }
        return hit;
      }

      const res = await site.fetch(request, env as never, ctx);
      if (res.status === 200 && !res.headers.has('set-cookie')) {
        ctx.waitUntil(store(cache, decision.key, res.clone()).catch(() => undefined));
      }
      return res;
    } catch {
      return site.fetch(request, env as never, ctx);
    }
  },
};
