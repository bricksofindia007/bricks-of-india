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
 * Data-cache lifetime for every Supabase read on an ISR route (per-read
 * `next.revalidate`, see src/lib/supabase.ts). Route-segment `revalidate`
 * exports must be literals, so those say 3600 and point here.
 */
export const READ_REVALIDATE_SECONDS = 86400;

/**
 * Set pages only (/sets/[slug]): refreshed at most once per interval, the same
 * as the scrape interval above. Many set URLs are crawlable and each read is
 * billed, so a set page never refreshes more often than its data changes.
 * "Updated X ago" is computed from scraped_at in the browser, so a cached page
 * never claims to be fresher than its data.
 */
export const SET_PAGE_REVALIDATE_SECONDS = 86400;

/**
 * Unpriced set pages: the set_page_data read and the route segment live 14
 * days. A priced page makes a second small read of its offers on the interval
 * above, and Next takes the lowest revalidate in a render, so priced pages
 * still refresh on the interval above.
 */
export const UNPRICED_SET_REVALIDATE_SECONDS = 1209600;

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
