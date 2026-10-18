// Staging Worker entry: the read-only guard in front of the site's handler.
// Used only by wrangler.staging.jsonc (staging branch; never merged to main).
// With STAGING_READONLY="1", writes get 405 and every response gets noindex.
// Failure: if the guard or the site throws, a write gets 503 and is never passed on;
// a read may still go to the site.

import site from '../.open-next/worker.js';
export { DOQueueHandler, DOShardedTagCache } from '../.open-next/worker.js';
import { failClosedResponse, isReadonly, readonlyGate, withNoindex } from '../src/lib/staging-readonly';

export default {
  async fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext): Promise<Response> {
    if (!isReadonly(env)) return site.fetch(request, env as never, ctx);
    try {
      const blocked = readonlyGate(request.method, new URL(request.url).pathname);
      if (blocked) return blocked;
      return withNoindex(await site.fetch(request, env as never, ctx));
    } catch {
      return failClosedResponse(request.method) ?? site.fetch(request, env as never, ctx);
    }
  },
};
