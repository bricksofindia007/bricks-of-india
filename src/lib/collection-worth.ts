import { PRICE_READ_CAP } from './my-collection';

// My Collection: what each set is worth, and the line that says how the total is made up.
// Pure functions. The exchange rate and the retired status come in through interfaces and are
// supplied by the caller.

/** An estimate needs a rate stored at most this many days ago; older, estimates are hidden. */
export const RATE_MAX_AGE_DAYS = 5;

/** The stored rate: rupees per US dollar, and the date it was stored (YYYY-MM-DD). */
export type StoredRate = { rate: number; asOf: string };

/** Reads the stored rate. Returns null when there is none. Never fetches per visitor. */
export interface RateSource {
  getRate(): StoredRate | null;
}

/** Whether a set is retired. null means unknown: never treated as retired. */
export interface RetiredSource {
  isRetired(setNumber: string): boolean | null;
}

/** Added to the total when the price read left some collection sets out (the read is capped). */
export const CAP_SENTENCE = `Worth counts your newest ${PRICE_READ_CAP} sets.`;

export const RETIRED_LINE =
  'Retired and sought after. Resellers know what this is worth. Check the secondary market before you sell.';
export const ESTIMATE_NOTE =
  'Estimates convert the US price and can differ from what Indian shops charge. Not a valuation.';
export const WORTH_UNKNOWN_LINE = 'Worth not known yet';
export const WISHLIST_NO_PRICE_LINE = 'No Indian price yet';

export type WorthRule = 'indian' | 'estimate' | 'retired' | 'unknown';

export type WorthItem = {
  set: string;
  /** Verified, fresh, in-stock Indian price today, or null. */
  indianPriceInr: number | null;
  /** US retail price in dollars, or null when none is known. */
  usPriceUsd: number | null;
  /** Copies owned. Used for the money total; the set counts are per set. */
  qty: number;
};

export type WorthResult = {
  rule: WorthRule;
  /** Rupees for one copy under rules 1 and 2; null under rules 3 and 4. */
  inr: number | null;
  line: string;
  note: string | null;
};

/** Indian digit grouping (12,34,567) without a locale call (Netlify's ICU lacks en-IN). */
export function formatRs(n: number): string {
  const s = String(Math.round(n));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** The stored rate is usable only if it is present and no older than RATE_MAX_AGE_DAYS. */
export function usableRate(stored: StoredRate | null, now: Date): StoredRate | null {
  if (!stored || !Number.isFinite(stored.rate) || stored.rate <= 0) return null;
  const asOf = Date.parse(`${stored.asOf}T00:00:00Z`);
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(asOf)) return null;
  // Whole calendar days: a rate stored three days ago is still usable.
  const ageDays = Math.round((today - asOf) / 86_400_000);
  return ageDays <= RATE_MAX_AGE_DAYS ? stored : null;
}

/**
 * Worth of one set, by the four rules in order:
 *  1. Verified, fresh Indian price: shown plain.
 *  2. No Indian price, set not known to be retired, US price and a usable rate: an estimate.
 *  3. Retired (known): no figure at all.
 *  4. Anything else: not known yet; counted but not valued.
 * A set whose retired status is unknown never gets rule 3.
 */
export function worthOf(item: WorthItem, rate: StoredRate | null, retired: boolean | null): WorthResult {
  if (item.indianPriceInr != null) {
    return { rule: 'indian', inr: item.indianPriceInr, line: `₹${formatRs(item.indianPriceInr)}`, note: null };
  }
  if (retired !== true && item.usPriceUsd != null && rate) {
    const inr = Math.round(item.usPriceUsd * rate.rate);
    return {
      rule: 'estimate',
      inr,
      line: `About ₹${formatRs(inr)}, worked out from the US price`,
      note: ESTIMATE_NOTE,
    };
  }
  if (retired === true) return { rule: 'retired', inr: null, line: RETIRED_LINE, note: null };
  return { rule: 'unknown', inr: null, line: WORTH_UNKNOWN_LINE, note: null };
}

/**
 * The worth input for one collection set: the verified Indian price (when prices loaded) and the US price.
 * The stored rate and the retired status are not part of this input; the caller passes them to worthOf.
 */
export function worthInputFor(
  owned: { set: string; qty: number },
  price: { best_price_inr: number | null; us_price_usd: number | null } | undefined,
  pricesLoaded: boolean,
): WorthItem {
  return {
    set: owned.set,
    indianPriceInr: pricesLoaded ? (price?.best_price_inr ?? null) : null,
    usPriceUsd: pricesLoaded ? (price?.us_price_usd ?? null) : null,
    qty: owned.qty,
  };
}

export type WorthTotal = {
  /** Sum of rules 1 and 2, times copies owned. */
  inr: number;
  sets: number;
  counted: number;
  indian: number;
  estimate: number;
  retired: number;
  unknown: number;
  /** The sentence that says how the total is made up. */
  line: string;
};

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

/**
 * The total line. Total = rules 1 and 2 only. It always states how it is made up, e.g.
 * "Worth counts 14 of 17 sets: 9 at Indian prices, 5 estimated from US prices. 3 are retired and not counted."
 */
export function worthTotal(items: WorthItem[], rate: StoredRate | null, retiredOf: (set: string) => boolean | null, capped = false): WorthTotal {
  let inr = 0;
  let indian = 0;
  let estimate = 0;
  let retired = 0;
  let unknown = 0;
  for (const it of items) {
    const w = worthOf(it, rate, retiredOf(it.set));
    if (w.rule === 'indian') { indian++; inr += (w.inr ?? 0) * it.qty; }
    else if (w.rule === 'estimate') { estimate++; inr += (w.inr ?? 0) * it.qty; }
    else if (w.rule === 'retired') retired++;
    else unknown++;
  }
  const sets = items.length;
  const counted = indian + estimate;
  let line = `Worth counts ${counted} of ${sets} ${plural(sets, 'set', 'sets')}: ${indian} at Indian ${plural(indian, 'price', 'prices')}, ${estimate} estimated from US ${plural(estimate, 'price', 'prices')}.`;
  if (retired > 0) line += ` ${retired} ${plural(retired, 'is', 'are')} retired and not counted.`;
  if (unknown > 0) line += ` ${unknown} ${plural(unknown, 'has', 'have')} no price yet and not counted.`;
  if (capped) line += ` ${CAP_SENTENCE}`;
  return { inr, sets, counted, indian, estimate, retired, unknown, line };
}
