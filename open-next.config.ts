import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import doShardedTagCache from "@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache";
import { purgeCache } from "@opennextjs/cloudflare/overrides/cache-purge/index";

// R2-backed incremental cache for ISR -- backs the 8 ISR routes (/, /deals,
// /sitemap.xml, /sets/[slug], /news/[slug], /reviews/[slug],
// /community/[slug], /blog/[slug]) via the bricksofindia-next-cache bucket
// declared in wrangler.jsonc's r2_buckets (binding: NEXT_INC_CACHE_R2_BUCKET
// -- OpenNext's fixed convention, matched there).
//
// queue/tagCache/cachePurge added together, not incrementally, per
// opennext.js.org/cloudflare/caching:
//   - queue (doQueue): required for Time-Based (ISR) revalidation. Without
//     it OpenNext defaults to a no-op DummyQueue that throws `FatalError:
//     Dummy queue is not implemented` on the first real background
//     revalidation attempt -- confirmed live via wrangler tail against the
//     first preview deploy, this is the bug this config fixes.
//   - tagCache (doShardedTagCache): required for On-Demand revalidation
//     (revalidateTag/revalidatePath/res.revalidate) per the docs -- this
//     site uses BOTH revalidation modes (ISR above, plus
//     admin/pending/actions.ts's revalidatePath() on every publish/approve
//     action), so both queue and tagCache are needed, not just one.
//     baseShardSize: 12 is the docs' own example value; nothing in this
//     site's scale suggested a different number.
//   - cachePurge (purgeCache): also On-Demand-revalidation-only -- "Cache
//     purge are only called when you call revalidateTag, revalidatePath or
//     res.revalidate... not called for ISR revalidation" (same docs page).
//     type: "direct" calls the Cache API purge directly with no extra
//     binding; the alternative `durableObject` type only helps at traffic
//     high enough to hit Cache-API rate limits, which doesn't apply here
//     (see wrangler.jsonc's matching comment for why NEXT_CACHE_DO_PURGE/
//     BucketCachePurge was deliberately not added).
// Build-time switch for the no-storage build (order 0560 Phase 1). It is read when the build runs, not at run time.
//   - BOI_STAGING=1: the staging build (deploy-cloudflare-staging.yml).
//   - BOI_PRODUCTION_NO_STORAGE=1: the production build. Not set by the production deploy until cutover (Phase 3),
//     so merging this file changes nothing live.
// No-storage build: no R2 page copies, no revalidation queue, no tag cache, no purge storage (OpenNext's "dummy"
// defaults, which write nothing). Pages render per request; the edge cache in worker/ keeps them for a short time.
const NO_STORAGE = process.env.BOI_STAGING === "1" || process.env.BOI_PRODUCTION_NO_STORAGE === "1";

export default NO_STORAGE
  ? defineCloudflareConfig({
      // No stored pages, so there is nothing for cache interception to serve. Off.
      enableCacheInterception: false,
    })
  : defineCloudflareConfig({
      incrementalCache: r2IncrementalCache,
      queue: doQueue,
      tagCache: doShardedTagCache({ baseShardSize: 12 }),
      cachePurge: purgeCache({ type: "direct" }),
      // Serve cached pages straight from the cache with the refresh time stored alongside each
      // page (3 Oct 2026). Without this, pages made on demand were marked stale almost at once
      // and rebuilt on nearly every visit.
      enableCacheInterception: true,
    });
