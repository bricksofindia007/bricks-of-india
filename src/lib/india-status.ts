// Item 0 (P14 round 8, Abhinav's India-only availability rule, 1 Oct 2026).
// The ONE input for any public availability wording: review verdict boxes,
// FAQ answers, badges, and every content/video/social/newsletter generator.
// The global `sets.retired` flag (LEGO discontinued it somewhere) stays
// internal: it only matters once no Indian store has had the set in stock
// for RETIRED_IN_INDIA_DAYS consecutive days.
//
//   available     >= 1 Indian store lists it in stock -> no "retired" anywhere
//   out_of_stock  listed, all sold out -> "Out of stock at X"
//   retired       LEGO-discontinued AND no in-stock listing for 14 days
//   not_listed    no Indian store lists it, not retired (e.g. not launched)
//
// "Retired" is never a review verdict; verdicts are buying calls.

export const RETIRED_IN_INDIA_DAYS = 14;

/** Shown exactly, when a set is retired in India and has no price anywhere. */
export const RETIRED_NO_PRICE_LINE = 'Retired — Price not available. Your wallet is silently thanking you for it.';

export interface IndiaListing {
  storeName: string;
  inStock: boolean;
}

/** Approx. resale value for sets retired in India (item 8; null until built). */
export interface ApproxResale {
  inr: number;
  usd: number;
  rate: number;
  asOf: string; // display date, e.g. "2 Oct 2026"
}

export interface IndiaStatusInput {
  /** sets.retired: LEGO has discontinued the set (internal flag). */
  legoRetired: boolean;
  /** Current listings at Indian stores shown on the site. */
  listings: IndiaListing[];
  /**
   * recorded_at of every price_history row at those stores within the last
   * RETIRED_IN_INDIA_DAYS days. History rows are written when stock or price
   * changes, so any row in the window may mean the set was in stock inside it.
   * Treated conservatively: any row in the window means "not retired yet".
   */
  recentStockEventsAt: Array<string | Date>;
  approxResale?: ApproxResale | null;
  now?: Date;
}

export type IndiaStatus =
  | { kind: 'available'; inStockAt: string[] }
  | { kind: 'out_of_stock'; listedAt: string[] }
  | { kind: 'retired'; approxResale: ApproxResale | null }
  | { kind: 'not_listed' };

export function computeIndiaStatus(input: IndiaStatusInput): IndiaStatus {
  const inStockAt = input.listings.filter((l) => l.inStock).map((l) => l.storeName);
  if (inStockAt.length > 0) return { kind: 'available', inStockAt };

  const now = (input.now ?? new Date()).getTime();
  const windowStart = now - RETIRED_IN_INDIA_DAYS * 864e5;
  const recentActivity = input.recentStockEventsAt.some((t) => new Date(t).getTime() >= windowStart);
  if (input.legoRetired && !recentActivity) return { kind: 'retired', approxResale: input.approxResale ?? null };

  if (input.listings.length > 0) return { kind: 'out_of_stock', listedAt: input.listings.map((l) => l.storeName) };
  return { kind: 'not_listed' };
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * Public availability sentence, or null when there is nothing to say about
 * availability (in stock, or simply not listed yet). Never says "retired"
 * unless the status is retired in India.
 */
export function indiaStatusLine(status: IndiaStatus): string | null {
  switch (status.kind) {
    case 'available':
    case 'not_listed':
      return null;
    case 'out_of_stock':
      return `Out of stock at ${status.listedAt.join(' and ')}.`;
    case 'retired': {
      const v = status.approxResale;
      if (!v) return RETIRED_NO_PRICE_LINE;
      return `Retired — approx. resale value ≈ ${inr(v.inr)} (US$${v.usd.toLocaleString('en-US')} × today's rate ₹${v.rate.toFixed(2)}, ${v.asOf}).`;
    }
  }
}

/** True only when public wording may say the set is retired. */
export function mayCallRetired(status: IndiaStatus): boolean {
  return status.kind === 'retired';
}

/** Matches availability claims that only an India status of `retired` can support. */
export const RETIRED_WORDING = /\b(retired|discontinued|no longer (available|sold|on sale)|nothing left to buy)\b/i;
