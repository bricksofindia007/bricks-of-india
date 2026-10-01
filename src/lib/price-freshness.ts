// Price cadence + freshness: the one place these numbers live (PR-A, 2026-09-26).
//
// Before this, "Updated every 6 hours" / "Updated daily" were hand-written in
// ~25 places, and the ISR routes' Supabase reads were cached until the next
// deploy (fetchCache='default-cache' gives un-configured fetches
// revalidate=INFINITE_CACHE -- next/dist/server/lib/patch-fetch.js), so the
// site could show week-old prices under an "every 6 hours" promise.

// Scraper cadence -- must match .github/workflows/scrape-prices.yml (cron: every 6th hour, minute 0).
export const SCRAPE_INTERVAL_HOURS = 6;

// G19 (1 Oct 2026): no public text states the cadence, so there is no PRICE_CADENCE text constant.

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

/**
 * Unpriced set pages (FP1.6 design §2, 72 h APPROVED by Abhinav, P8 item 4):
 * the set_page_data read and the route segment live 72 h. A priced page makes
 * a second small read of its offers on the 6 h clock above, and Next takes the
 * lowest revalidate in a render, so priced pages still refresh every 6 h.
 */
export const UNPRICED_SET_REVALIDATE_SECONDS = 259200;

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
