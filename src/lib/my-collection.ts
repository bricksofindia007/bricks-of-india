// My Collection: the visitor's wishlist (hearts) and collection, kept in their own browser.
// Sets only. Nothing is sent to us except set numbers when the page asks for today's prices.
// Browser storage can be missing or refuse writes, so every read and write is guarded and the
// page still works without it.

export const MY_SETS_LIMIT = 500;
export const PAGE_SIZE = 50;
export const PRICE_READ_CAP = 150;
export const WISHLIST_KEY = 'boi_wishlist';
export const COLLECTION_KEY = 'boi_guest_collection';
export const CHANGED_EVENT = 'boi:my-collection';

// Voice lines. Exact wording; no others.
export const VOICE = {
  heartAdded: 'Saved. Your wallet has been notified.',
  heartRemoved: 'Removed. Your wallet is relieved.',
  ownedAdded: 'Yours now. Own it proudly.',
  wishlistEmpty: 'Nothing saved yet. Your wallet admires your patience.',
  collectionEmpty: 'No sets here yet. Tell us what you own and we will be impressed.',
  limitReached: 'That is a proper collection. Remove one to add another.',
  pricesUnavailable: 'Prices are unavailable right now. Names and pieces are still shown.',
} as const;

/** What the page knows about a set when the visitor taps. Names and pieces only; never a price history. */
export type SetRef = {
  set: string;
  name: string;
  image_url?: string | null;
  pieces?: number | null;
  theme?: string | null;
  year?: number | null;
};
export type WishItem = SetRef & { added_at: string };
export type OwnedItem = SetRef & { qty: number; added_at: string };

const SET_RE = /^[0-9]{3,7}(-[0-9]{1,2})?$/;
export const isSetNumber = (s: unknown): s is string => typeof s === 'string' && SET_RE.test(s);

const posInt = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null);
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const httpsUrl = (v: unknown) => (typeof v === 'string' && /^https:\/\//.test(v) ? v.slice(0, 500) : null);
const validDate = (v: unknown) => {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date(0).toISOString();
};

function cleanRef(r: any): SetRef {
  return {
    set: r.set,
    name: str(r.name, 200) ?? '',
    image_url: httpsUrl(r.image_url),
    pieces: posInt(r.pieces),
    theme: str(r.theme, 80),
    year: Number.isInteger(r.year) && r.year >= 1949 && r.year <= 2100 ? r.year : null,
  };
}

/** Keep well-formed rows only, one per set, capped at the limit. Anything else is dropped. */
export function cleanWishlist(raw: unknown): WishItem[] {
  const seen = new Set<string>();
  const out: WishItem[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!r || !isSetNumber(r.set) || seen.has(r.set)) continue;
    seen.add(r.set);
    out.push({ ...cleanRef(r), added_at: validDate(r.added_at) });
  }
  return out.slice(0, MY_SETS_LIMIT);
}

export function cleanCollection(raw: unknown): OwnedItem[] {
  const seen = new Set<string>();
  const out: OwnedItem[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!r || !isSetNumber(r.set) || seen.has(r.set)) continue;
    seen.add(r.set);
    const qty = Math.min(99, Math.max(1, Math.trunc(Number(r.qty) || 1)));
    out.push({ ...cleanRef(r), qty, added_at: validDate(r.added_at) });
  }
  return out.slice(0, MY_SETS_LIMIT);
}

export type AddResult<T> = { list: T[]; status: 'added' | 'present' | 'limit' };

/** Hearts: add a set to the wishlist, or report that it is there or that the list is full. */
export function addWish(list: WishItem[], ref: SetRef, now: string): AddResult<WishItem> {
  if (list.some((w) => w.set === ref.set)) return { list, status: 'present' };
  if (list.length >= MY_SETS_LIMIT) return { list, status: 'limit' };
  return { list: [{ ...cleanRef(ref), added_at: now }, ...list], status: 'added' };
}

export function removeWish(list: WishItem[], set: string): WishItem[] {
  return list.filter((w) => w.set !== set);
}

/** Add to My Collection with one copy. A set already there keeps its quantity. */
export function addOwned(list: OwnedItem[], ref: SetRef, now: string): AddResult<OwnedItem> {
  if (list.some((o) => o.set === ref.set)) return { list, status: 'present' };
  if (list.length >= MY_SETS_LIMIT) return { list, status: 'limit' };
  return { list: [{ ...cleanRef(ref), qty: 1, added_at: now }, ...list], status: 'added' };
}

/** Set the copies owned; 0 removes the set. */
export function setOwnedQty(list: OwnedItem[], set: string, qty: number): OwnedItem[] {
  const q = Math.min(99, Math.max(0, Math.trunc(qty)));
  if (q === 0) return list.filter((o) => o.set !== set);
  return list.map((o) => (o.set === set ? { ...o, qty: q } : o));
}

/**
 * The set numbers to price in one read: unique, newest added first, capped. Sets past the cap
 * are not priced, so they count as "not known yet" in the total.
 */
export function priceIds(wish: WishItem[], owned: OwnedItem[], cap: number = PRICE_READ_CAP): string[] {
  const all = [...wish, ...owned].sort((a, b) => (a.added_at < b.added_at ? 1 : a.added_at > b.added_at ? -1 : 0));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of all) {
    if (seen.has(x.set)) continue;
    seen.add(x.set);
    out.push(x.set);
    if (out.length >= cap) break;
  }
  return out;
}

export function pageOf<T>(list: T[], page: number, size: number = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const p = Math.min(Math.max(1, page), pages);
  return { rows: list.slice((p - 1) * size, p * size), page: p, pages };
}

// ── browser storage (guarded) ────────────────────────────────────────────────

export function readList(key: string): unknown {
  try {
    const s = window.localStorage.getItem(key);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

/** True when the write landed. False (storage missing or full) means nothing was saved. */
export function writeList(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export const loadWishlist = () => cleanWishlist(readList(WISHLIST_KEY));
export const loadCollection = () => cleanCollection(readList(COLLECTION_KEY));
