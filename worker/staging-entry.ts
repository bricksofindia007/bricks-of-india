// Staging Worker entry: the read-only guard in front of the site's handler.
// Used only by wrangler.staging.jsonc (staging branch; never merged to main).
// With STAGING_READONLY="1", writes get 405 and every response gets noindex.
// Failure: if the guard throws, the request goes to the site unchanged.

import site from '../.open-next/worker.js';
import { isReadonly, readonlyGate, withNoindex } from '../src/lib/staging-readonly';

export default {
  async fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext): Promise<Response> {
    if (!isReadonly(env)) return site.fetch(request, env as never, ctx);
    try {
      const blocked = readonlyGate(request.method, new URL(request.url).pathname);
      if (blocked) return blocked;
      return withNoindex(await site.fetch(request, env as never, ctx));
    } catch {
      return site.fetch(request, env as never, ctx);
    }
  },
};
