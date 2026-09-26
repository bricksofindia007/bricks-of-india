// Price cadence + freshness: the one place these numbers live (PR-A, 2026-09-26).
//
// Before this, "Updated every 6 hours" / "Updated daily" were hand-written in
// ~25 places, and the ISR routes' Supabase reads were cached until the next
// deploy (fetchCache='default-cache' gives un-configured fetches
// revalidate=INFINITE_CACHE -- next/dist/server/lib/patch-fetch.js), so the
// site could show week-old prices under an "every 6 hours" promise.

// Scraper cadence -- must match .github/workflows/scrape-prices.yml (cron: every 6th hour, minute 0).
export const SCRAPE_INTERVAL_HOURS = 6;

/** Human text for the cadence, used by every page that states it. */
export const PRICE_CADENCE = `every ${SCRAPE_INTERVAL_HOURS} hours`;

/** A price row older than this (two missed scrapes) shows its real age and gets no badges. */
export const PRICE_STALE_HOURS = 2 * SCRAPE_INTERVAL_HOURS;

/**
 * Data-cache lifetime for every Supabase read on an ISR route (per-read
 * `next.revalidate`, see src/lib/supabase.ts). Route-segment `revalidate`
 * exports must be literals, so those say 3600 and point here.
 */
export const READ_REVALIDATE_SECONDS = 3600;

/**
 * Set pages only (/sets/[slug]): 6h, matching the scrape cadence. Operator
 * decision 2026-09-26 -- 26k crawlable set URLs, and Supabase egress is the
 * binding Free-plan quota, so each set page refreshes its data at most 4x/day.
 * "Updated X ago" is computed from scraped_at in the browser, so a cached page
 * never claims to be fresher than its data.
 */
export const SET_PAGE_REVALIDATE_SECONDS = 21600;

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
