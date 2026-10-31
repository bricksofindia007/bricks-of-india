import { PRICE_READ_CAP } from './my-collection';

// My Collection: what each set is worth, and the line that says how the total is made up.
// Pure functions. The exchange rate and the retired status come in through interfaces and are
// supplied by the caller.

/** An estimate needs a rate stored at most this many days ago; older, estimates are hidden. */
export const RATE_MAX_AGE_DAYS = 5;

/** A rate outside this band (rupees per dollar) is never used. Same band as the job that stores the rate. */
export const RATE_BAND_MIN = 70;
export const RATE_BAND_MAX = 110;

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

// The owner's approved lines (D-2026-10-30-04 and -05). One constant each; copied, not retyped.
/** Line 3: a retired set with no value. Replaces the 27 Oct retired line (owner, 30 Oct). */
export const RETIRED_LINE = 'Priceless. You could make a mini fortune on the secondary market.';
/** The estimate line (D-2026-10-30-05): shown only on sets whose price is an estimate from the US price. */
export const ESTIMATE_NOTE = 'Not sold in India through regular retailers. This is an estimated price based on US prices, so your actual buying price may vary. Customs may have opinions, which might make your wallet teary eyed.';
/** Line 4: no price yet. Used on owned rows and on wishlist rows. */
export const WISHLIST_NO_PRICE_LINE = 'No Indian price yet. We\'re watching the shelves.';
export const WORTH_UNKNOWN_LINE = WISHLIST_NO_PRICE_LINE;

/** 'last-seen': a retired set with a last seen Indian price; counted in the total at that price (decision D-2026-10-30-01). */
/** 'list-price': the LEGO India list price (lego_mrp_inr), counted at its rupee value (D-2026-10-30-03). */
/** 'pre-2020': a set from before the cutoff year with no rupee value; shows line 3, not counted (D-2026-10-30-09). */
export type WorthRule = 'indian' | 'list-price' | 'estimate' | 'stored-estimate' | 'retired' | 'last-seen' | 'pre-2020' | 'unknown';

/** Sets released before this year get no US price pull, and with no rupee value they show line 3 (D-2026-10-30-09). One place for the year test. */
export const PRE_2020_CUTOFF_YEAR = 2020;
export function isPre2020Set(year: number | null | undefined): boolean {
  return year != null && Number.isFinite(year) && year < PRE_2020_CUTOFF_YEAR;
}


export type WorthItem = {
  set: string;
  /** Verified, fresh, in-stock Indian price today, or null. */
  indianPriceInr: number | null;
  /** US retail price in dollars, or null when none is known. */
  usPriceUsd: number | null;
  /** Copies owned. Used for the money total; the set counts are per set. */
  qty: number;
  /** The stored rupee estimate for the set, used only when there is no US price. Optional; null when none. */
  storedEstimateInr?: number | null;
  /** The LEGO India list price (lego_mrp_inr), used when there is no store price and the set is not retired. Optional. */
  listPriceInr?: number | null;
  /** The set's release year, or null when unknown. Used only for the pre-2020 rule. */
  year?: number | null;
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
  if (!stored || !Number.isFinite(stored.rate) || stored.rate < RATE_BAND_MIN || stored.rate > RATE_BAND_MAX) return null;
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
/** Our own observed Indian price for a set: the most recent one, with its time. Null when we have none. */
export type LastSeen = { priceInr: number; observedAt: string } | null;

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A stored rate date as the page shows it: "18 Oct 2026". Built from the parts, so it does not depend on the locale. */
export function rateDateLabel(asOf: string): string {
  const [y, m, d] = asOf.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
}

/**
 * The line for a retired set. With our own observed Indian price, a factual line: "Last seen in India at ₹X (month, year)".
 * Without one, only the approved line: no rupee figure, and no claim that it was launched.
 */
export function retiredLine(lastSeen: LastSeen): string {
  if (!lastSeen) return RETIRED_LINE;
  const d = new Date(lastSeen.observedAt);
  if (!Number.isFinite(d.getTime()) || !Number.isFinite(lastSeen.priceInr) || lastSeen.priceInr <= 0) return RETIRED_LINE;
  // Line 2 (D-2026-10-30-04): the retired line with a last seen price.
  return `Retired. Last seen in India at ₹${formatRs(lastSeen.priceInr)} (${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}). Good luck finding one.`;
}

export function worthOf(item: WorthItem, rate: StoredRate | null, retired: boolean | null, lastSeen: LastSeen = null): WorthResult {
  if (item.indianPriceInr != null) {
    return { rule: 'indian', inr: item.indianPriceInr, line: `₹${formatRs(item.indianPriceInr)}`, note: null };
  }
  // Order of value (D-2026-10-30-03): store price, else LEGO India list price, else US price, else no value.
  // A retired set never uses the list price: it shows its last seen price, or Priceless.
  if (retired !== true && item.listPriceInr != null && item.listPriceInr > 0) {
    const inr = Math.round(item.listPriceInr);
    return { rule: 'list-price', inr, line: `₹${formatRs(inr)}`, note: null };
  }
  if (retired !== true && item.usPriceUsd != null && rate) {
    const inr = Math.round(item.usPriceUsd * rate.rate);
    // The word About stays before an estimated figure; the approved estimate line goes under it (note).
    return { rule: 'estimate', inr, line: `About ₹${formatRs(inr)}`, note: ESTIMATE_NOTE };
  }
  if (retired !== true && item.storedEstimateInr != null && item.storedEstimateInr > 0) {
    const inr = Math.round(item.storedEstimateInr);
    return { rule: 'stored-estimate', inr, line: `About ₹${formatRs(inr)}`, note: null };
  }
  if (retired === true && lastSeen && Number.isFinite(lastSeen.priceInr) && lastSeen.priceInr > 0) {
    return { rule: 'last-seen', inr: lastSeen.priceInr, line: retiredLine(lastSeen), note: null };
  }
  if (retired === true) return { rule: 'retired', inr: null, line: retiredLine(lastSeen), note: null };
  if (isPre2020Set(item.year)) return { rule: 'pre-2020', inr: null, line: RETIRED_LINE, note: null };
  return { rule: 'unknown', inr: null, line: WORTH_UNKNOWN_LINE, note: null };
}

/**
 * The worth input for one collection set: the verified Indian price (when prices loaded) and the US price.
 * The stored rate and the retired status are not part of this input; the caller passes them to worthOf.
 */
export function worthInputFor(
  owned: { set: string; qty: number },
  price: { best_price_inr: number | null; us_price_usd: number | null; stored_estimate_inr?: number | null; list_price_inr?: number | null; year?: number | null } | undefined,
  pricesLoaded: boolean,
): WorthItem {
  return {
    set: owned.set,
    indianPriceInr: pricesLoaded ? (price?.best_price_inr ?? null) : null,
    usPriceUsd: pricesLoaded ? (price?.us_price_usd ?? null) : null,
    qty: owned.qty,
    storedEstimateInr: pricesLoaded ? (price?.stored_estimate_inr ?? null) : null,
    listPriceInr: pricesLoaded ? (price?.list_price_inr ?? null) : null,
    // Only with prices loaded: a pre-2020 set is shown as Priceless only once its price read is known.
    year: pricesLoaded ? (price?.year ?? null) : null,
  };
}

export type WorthTotal = {
  /** Sum of rules 1 and 2, times copies owned. */
  inr: number;
  sets: number;
  counted: number;
  indian: number;
  estimate: number;
  /** Retired sets with no rupee value: the only retired sets the total line and the tile count. */
  retired: number;
  /** Sets before the cutoff year with no rupee value: line 3, not counted, not in the retired count. */
  pre2020: number;
  /** How many of the Indian prices above are last seen prices of retired sets (already in indian). */
  lastSeen: number;
  unknown: number;
  /** Sets whose only figure is the stored estimate: shown, not counted. */
  storedEstimate: number;
  /** The sentence that says how the total is made up. */
  line: string;
  /** The rate date and estimate note, next to the sentence. Empty when no estimate is counted. */
  rateNote: string;
};

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

/**
 * The total line. Total = rules 1 and 2 only. It always states how it is made up, e.g.
 * "Worth counts 14 of 17 sets: 9 at Indian prices, 5 estimated from US prices. 3 are retired and not counted."
 */
export function worthTotal(
  items: WorthItem[],
  rate: StoredRate | null,
  retiredOf: (set: string) => boolean | null,
  capped = false,
  lastSeenOf: (set: string) => LastSeen = () => null,
): WorthTotal {
  let inr = 0;
  let indianNow = 0;
  let lastSeenCount = 0;
  let estimate = 0;
  let retired = 0;
  let unknown = 0;
  let storedEstimate = 0;
  let pre2020 = 0;
  for (const it of items) {
    const w = worthOf(it, rate, retiredOf(it.set), lastSeenOf(it.set));
    if (w.rule === 'indian' || w.rule === 'list-price') { indianNow++; inr += (w.inr ?? 0) * it.qty; }
    else if (w.rule === 'last-seen') { lastSeenCount++; inr += (w.inr ?? 0) * it.qty; }
    else if (w.rule === 'estimate') { estimate++; inr += (w.inr ?? 0) * it.qty; }
    else if (w.rule === 'retired') retired++;
    else if (w.rule === 'pre-2020') pre2020++;
    else if (w.rule === 'stored-estimate') storedEstimate++;
    else unknown++;
  }
  // A last seen Indian price is a rupee price, so it is counted with the Indian prices (the sentence keeps its words).
  const indian = indianNow + lastSeenCount;
  const sets = items.length;
  const counted = indian + estimate;
  // Line 1 (D-2026-10-30-04): the total. Its tails (retired, worked out, not known) are gone; the approved estimate line
  // sits on the rows, not here. The cap sentence stays as it is (R1) and follows line 1.
  let line = `${sets} sets on your shelf. Worth about ₹${formatRs(inr)}. Your wallet has questions.`;
  if (capped) line += ` ${CAP_SENTENCE}`;
  const rateNote = '';
  return { inr, sets, counted, indian, lastSeen: lastSeenCount, estimate, retired, pre2020, unknown, storedEstimate, line, rateNote };
}
