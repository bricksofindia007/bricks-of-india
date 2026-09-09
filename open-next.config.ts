import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// R2-backed incremental cache for ISR -- backs the 8 ISR routes (/, /deals,
// /sitemap.xml, /sets/[slug], /news/[slug], /reviews/[slug],
// /community/[slug], /blog/[slug]) via the bricksofindia-next-cache bucket
// declared in wrangler.jsonc's r2_buckets (binding: NEXT_INC_CACHE_R2_BUCKET
// -- OpenNext's fixed convention, matched there).
//
// Nothing else customized here -- no prior audit flagged anything beyond
// the R2 cache as needing non-default config for this repo.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
