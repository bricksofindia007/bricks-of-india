// Worker entry (order 0520, option C). Wrangler deploys this file. It runs the generated OpenNext worker and puts the edge
// cache (worker/edge-cache.ts) in front of it, switched on only by the BOI_EDGE_CACHE variable.
// The Durable Object classes are re-exported because the bindings in wrangler.jsonc still name them.
// @ts-ignore: .open-next/worker.js is produced by `opennextjs-cloudflare build` before wrangler runs
import generated from "../.open-next/worker.js";
// @ts-ignore: same generated file as above
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "../.open-next/worker.js";
import { EDGE_CACHE_VAR, EDGE_TTL_OVERRIDE_VAR, handleWithEdgeCache, type EdgeStore } from "./edge-cache";

type Env = Record<string, string | undefined>;
type Ctx = { waitUntil(p: Promise<unknown>): void };

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    // The Workers Cache API (caches.default). Typed loosely here because this site's TypeScript libraries omit Workers types.
    const store = (globalThis as unknown as { caches: { default: EdgeStore } }).caches.default;
    // Only the local proof sets the override (wrangler dev --var); production leaves it unset, so the default TTLs apply.
    const override = Number(env[EDGE_TTL_OVERRIDE_VAR]);
    return handleWithEdgeCache(
      request,
      (r) => generated.fetch(r, env, ctx),
      store,
      (p) => ctx.waitUntil(p),
      {
        enabled: env[EDGE_CACHE_VAR] === "1",
        ttlOverride: Number.isFinite(override) && override > 0 ? override : undefined,
      },
    );
  },
};
