// Price refresh timing and freshness: the one place these numbers live.
//
// Before this, refresh-time wording was written by hand in many places, and
// some price reads on the ISR routes had no bounded cache lifetime, so a page
// could show prices older than the refresh interval.

// Scraper interval: must match the scheduler's dispatch times (workers/boi-scheduler).
export const SCRAPE_INTERVAL_HOURS = 24;

// No public text states the refresh timing, so there is no text constant for it.

/** A price row older than this shows its real age and gets no badges. */
export const PRICE_STALE_HOURS = SCRAPE_INTERVAL_HOURS + 2; // one interval plus a margin; the health check uses the same window

/**
 * The no-storage build (staging, and production after cutover) sets BOI_STAGING=1 or BOI_PRODUCTION_NO_STORAGE=1 at build
 * time. Only that build changes the windows below (order 0620). The current production build keeps its values.
 */
// Must be a literal process.env.NEXT_PUBLIC_* expression: Next replaces it at build time. A plain BOI_* variable is read at
// run time from the Worker's own variables, where the build flag is absent (measured locally, order 0620, t2-r59).
// Set NEXT_PUBLIC_BOI_NO_STORAGE=1 in the no-storage build (staging, and production at cutover) with BOI_STAGING / BOI_PRODUCTION_NO_STORAGE.
export const NO_STORAGE_BUILD = process.env.NEXT_PUBLIC_BOI_NO_STORAGE === '1';

/**
 * The longest a price may sit in memory on the no-storage build. Worst case for a shown price: 1 h edge copy + 1 h in memory
 * + 24 h scrape = 26 h, under the 48 h limit (order 0620, Chat decision).
 */
// A local proof build may set NEXT_PUBLIC_BOI_PRICE_MEMORY_OVERRIDE_SECONDS (build time) to watch the expiry in minutes.
// Production builds never set it, so the value there is one hour (tests/price-memory-windows.test.ts pins that default).
const OVERRIDE_SECONDS = Number(process.env.NEXT_PUBLIC_BOI_PRICE_MEMORY_OVERRIDE_SECONDS);
/** Window for price reads on the page routes that show prices (home, deals, lab deals, reviews, sets list, price drops).
 * No-storage build: 0 = no data cache at all (the route also renders per request). Elsewhere: the normal read window. */
export const PRICE_READ_REVALIDATE_SECONDS = NO_STORAGE_BUILD ? 0 : 86400;

export const NO_STORAGE_PRICE_MEMORY_SECONDS = OVERRIDE_SECONDS > 0 ? OVERRIDE_SECONDS : 60 * 60;

/**
 * Data-cache lifetime for every Supabase read on an ISR route (per-read `next.revalidate`, see src/lib/supabase.ts).
 * Route-segment `revalidate` exports must be literals, so those keep their values (see the notes on each route).
 */
export const READ_REVALIDATE_SECONDS = NO_STORAGE_BUILD ? NO_STORAGE_PRICE_MEMORY_SECONDS : 86400;

/**
 * Set pages (/sets/[slug]): the price read is refreshed at most once per window. On the no-storage build the window is one
 * hour, so a price changed in the store shows within the edge copy time plus one hour.
 */
export const SET_PAGE_REVALIDATE_SECONDS = NO_STORAGE_BUILD ? NO_STORAGE_PRICE_MEMORY_SECONDS : 86400;

/**
 * Set data read (set_page_data, which also returns prices): 14 days on the current production build, so unpriced sets stay
 * cheap to render. On the no-storage build it is one hour, so a set that gains its first price shows within the same bound.
 */
export const UNPRICED_SET_REVALIDATE_SECONDS = NO_STORAGE_BUILD ? NO_STORAGE_PRICE_MEMORY_SECONDS : 1209600;

/** "28 Sep, 22:30 IST": the data time shown in "No listing found at {store} as of {time}". */
export function formatIst(iso: string): string {
  const ist = new Date(Date.parse(iso) + 330 * 60_000);
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][ist.getUTCMonth()];
  return `${ist.getUTCDate()} ${mon}, ${String(ist.getUTCHours()).padStart(2, '0')}:${String(ist.getUTCMinutes()).padStart(2, '0')} IST`;
}

export type PriceRow = {
  price_inr: number | null;
  in_stock: boolean | null;
  scraped_at: string | null;
};

export function priceAgeHours(scrapedAt: string | null | undefined, now = Date.now()): number | null {
  if (!scrapedAt) return null;
  const t = new Date(scrapedAt).getTime();
  return Number.isFinite(t) ? (now - t) / 3_600_000 : null;
}

/** Fresh = scraped within PRICE_STALE_HOURS. Unknown age is never fresh. */
export function isPriceFresh(scrapedAt: string | null | undefined, now = Date.now()): boolean {
  const h = priceAgeHours(scrapedAt, now);
  return h !== null && h <= PRICE_STALE_HOURS;
}

/** Cheapest IN-STOCK priced row, or null. Out-of-stock rows never win "best price". */
export function bestInStock<T extends PriceRow>(rows: readonly T[] | null | undefined): T | null {
  let best: T | null = null;
  for (const r of rows ?? []) {
    if (!r.in_stock || r.price_inr == null) continue;
    if (!best || r.price_inr < (best.price_inr as number)) best = r;
  }
  return best;
}

/** A best price may carry a badge only when it is in stock AND fresh. */
export function badgeEligible(row: PriceRow | null | undefined, now = Date.now()): boolean {
  return !!row && !!row.in_stock && row.price_inr != null && isPriceFresh(row.scraped_at, now);
}
