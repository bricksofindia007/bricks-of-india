// Analytics events (GA4). One helper, closed parameter sets, no personal data.
//
// Rules:
// - The store value is the store's id from the registry (public.stores), passed in
//   by the caller from the data it already has. Nothing here lists stores, so adding
//   a store needs no change in this file.
// - Links that are not registry stores (search pages on other sites) send the
//   destination host, taken from the URL, not a typed name.
// - Search sends the length of the query, never the text.
// - Each user action fires once: attach trackEvent to one handler per control.
// - Page views and in-site page changes are already sent by the GA snippet in the
//   root layout; nothing here sends them.
//
// Key-event candidates (marked in GA admin, not here): click_store_listing,
// submit_newsletter_signup, submit_budget_calculator.

export const PAGE_TYPES = [
  'home', 'set', 'review', 'news', 'guide', 'opinion', 'blog', 'deals', 'lab_deals',
  'compare', 'sets_list', 'themes', 'theme', 'lab', 'budget_calculator', 'price_drops',
  'which_set', 'retiring_soon', 'biryani_index', 'cmf_tracker', 'minifig_hq',
  'shareables', 'precision', 'calendar', 'about', 'contact', 'corrections',
  'community', 'legal', 'other',
] as const;
export type PageType = (typeof PAGE_TYPES)[number];

export const BUDGET_BANDS = ['under_2000', '2000_5000', '5000_10000', 'over_10000'] as const;
export type BudgetBand = (typeof BUDGET_BANDS)[number];

// Event name -> parameters it may carry. Anything else is dropped.
const ALLOWED: Record<string, readonly string[]> = {
  click_store_listing: ['page_type', 'store', 'store_name', 'set_number', 'position'],
  click_outbound_search: ['page_type', 'destination_host', 'set_number'],
  click_related_set: ['page_type', 'store', 'store_name', 'set_number', 'position'],
  submit_budget_calculator: ['page_type', 'budget_band', 'result_count'],
  submit_newsletter_signup: ['page_type'],
  search_submit: ['page_type', 'search_length'],
  // Stubs for the wishlist feature. Defined here, not called anywhere yet.
  add_wishlist: ['page_type', 'set_number'],
  remove_wishlist: ['page_type', 'set_number'],
  mark_owned: ['page_type', 'set_number'],
  unmark_owned: ['page_type', 'set_number'],
  // My Collection (Bundle 2), sets only.
  heart_add: ['page_type', 'set_number'],
  heart_remove: ['page_type', 'set_number'],
  owned_add: ['page_type', 'set_number'],
  my_sets_view: ['page_type'],
};

const STORE_ID = /^[a-z0-9_]{1,40}$/;
const STORE_NAME = /^[\p{L}\p{N} .&'-]{1,60}$/u;
const SET_NUMBER = /^[0-9]{3,7}(-[0-9]{1,2})?$/;

/** Keep only allowed parameters, with values that match their rule. */
export function sanitizeParams(name: string, raw: Record<string, unknown>): Record<string, string | number> {
  const allowed = ALLOWED[name];
  if (!allowed) return {};
  const out: Record<string, string | number> = {};
  for (const key of allowed) {
    const v = raw[key];
    if (v === undefined || v === null || v === '') continue;
    if (key === 'page_type') {
      if ((PAGE_TYPES as readonly string[]).includes(String(v))) out[key] = String(v);
    } else if (key === 'store') {
      if (typeof v === 'string' && STORE_ID.test(v)) out[key] = v;
    } else if (key === 'store_name') {
      if (typeof v === 'string' && STORE_NAME.test(v)) out[key] = v;
    } else if (key === 'set_number') {
      if (typeof v === 'string' && SET_NUMBER.test(v)) out[key] = v;
    } else if (key === 'budget_band') {
      if ((BUDGET_BANDS as readonly string[]).includes(String(v))) out[key] = String(v);
    } else if (key === 'destination_host') {
      if (typeof v === 'string' && /^[a-z0-9.-]{1,120}$/.test(v)) out[key] = v;
    } else if (key === 'position' || key === 'result_count' || key === 'search_length') {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 0 && n <= 100000) out[key] = n;
    }
  }
  return out;
}

/** Host of a URL, for outbound links that are not registry stores. */
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

type GtagFn = (...args: unknown[]) => void;

/** Send one event. No-op on the server or when GA is not loaded. */
export function trackEvent(name: string, raw: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  const gtag = (window as unknown as { gtag?: GtagFn }).gtag;
  if (typeof gtag !== 'function') return;
  if (!ALLOWED[name]) return;
  gtag('event', name, sanitizeParams(name, raw));
}
