// Order 0620: prices on the no-storage build come from the database on each render, with no data cache in between.
//
// Why: on that build the data cache (unstable_cache, and the Supabase fetch cache) keeps a read until its window passes, and
// then tries a background refresh through the revalidation queue. That queue is OpenNext's dummy on the no-storage build and
// always fails, so the stored price is served again and again in that Worker and never refreshed (measured locally, t2-r59).
// The edge copy (worker/edge-cache.ts) is the only cache on that build: a price is then at most the edge copy time plus one
// hour of any in-memory window, which is what the bound needs.
//
// The current production build is unchanged: storedCache() there is unstable_cache with the same arguments.
import { unstable_cache } from 'next/cache';
import { unstable_noStore } from 'next/cache';
import { NO_STORAGE_BUILD } from './price-freshness';

/** Renders the page on each request on the no-storage build (the edge copy is the only cache). A no-op elsewhere. */
export function renderPerRequestOnNoStorageBuild(): void {
  if (NO_STORAGE_BUILD) unstable_noStore();
}

/**
 * Wraps a price read. On the no-storage build the read runs every time. Elsewhere it is unstable_cache with the given keys
 * and options, exactly as before.
 */
export function storedCache<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyParts: string[],
  options: { revalidate: number; tags?: string[] },
): (...args: A) => Promise<R> {
  if (NO_STORAGE_BUILD) return fn;
  return unstable_cache(fn, keyParts, options);
}

/**
 * Order 0710: generateStaticParams for a route. On the no-storage build it returns one probe param and nothing else, so no
 * page is prerendered (build-time data is never served) and the build marks the route dynamic. Elsewhere: the real list.
 */
export function staticParamsForBuild<T>(real: T[], probe: T): T[] {
  return NO_STORAGE_BUILD ? [probe] : real;
}
