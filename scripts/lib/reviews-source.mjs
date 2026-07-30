/**
 * Reviews source pipeline — live retailer listing fetch + eligibility.
 *
 * Built on top of ./retailer-fetch.mjs (the same MyBrickHouse/Toycra Shopify
 * feed logic scrape-now.mjs has used every 6h since 2026-05). Used by
 * scripts/reviews-source-refresh.mjs for both the weekly re-verification
 * pass (Pass 1) and discovery pass (Pass 2) from a single fetch — per spec,
 * the scan is not duplicated between passes.
 */

import { STORES, fetchAllProducts, parseProduct } from './retailer-fetch.mjs';
import { STORE_DISPLAY_NAME } from '../../src/lib/review-disclaimer.ts';

// Re-exported for convenience — callers of this module (discovery/
// re-verification scripts) commonly need both the fetch logic and the
// display-name lookup together. src/lib/review-disclaimer.ts is the single
// source of truth (also used by publish-draft.ts and content-linter.mjs)
// so this stays a re-export, not a second definition.
export { STORE_DISPLAY_NAME };

/**
 * Fetches every product from both stores once, keyed by extracted LEGO set
 * number. A set absent from the map, or present at only one store, is not
 * an error — it just means that store doesn't list it right now.
 *
 * knownSetsByName: the same Map scrape-now.mjs builds from the `sets` table
 * (lowercased name -> set_number), needed for MyBrickHouse's title-omits-
 * set-number fallback inside parseProduct(). Callers that already load
 * `sets` for their own set-number -> UUID matching should reuse that same
 * Map here rather than loading it twice.
 *
 * Returns { listings, failedStores }. failedStores lists any store whose
 * fetch failed entirely after retries (site down, etc.) — that store's
 * data is simply absent from every listings entry for this run, never
 * guessed at or carried over from a prior run.
 */
export async function fetchLiveListings(knownSetsByName = new Map()) {
  const listings = new Map(); // setNumber -> { toycra?: {...}, mybrickhouse?: {...} }
  const failedStores = [];

  for (const store of STORES) {
    let products;
    try {
      products = await fetchAllProducts(store.domain, store.path);
      console.log(`[reviews-source] ${store.name}: fetched ${products.length} products`);
    } catch (err) {
      console.error(`[reviews-source] FAILED to fetch ${store.name}: ${err.message}`);
      failedStores.push({ storeId: store.id, storeName: store.name, error: err.message });
      continue;
    }

    for (const product of products) {
      const parsed = parseProduct(product, store.id, store.domain, knownSetsByName);
      if (!parsed) continue;
      const entry = listings.get(parsed.setNumber) ?? {};
      entry[store.id] = { priceInr: parsed.priceInr, inStock: parsed.inStock, productUrl: parsed.productUrl };
      listings.set(parsed.setNumber, entry);
    }
  }

  return { listings, failedStores };
}

/**
 * Applies the eligibility rule (spec Section 3) to one set's listing entry.
 *
 * A store only counts if it returned BOTH a real numeric price (> 0, not
 * missing/zero) AND a clean stock reading. Shopify's `available` field on
 * each variant is already a clean boolean at the source, so there's no
 * free-text stock string to disambiguate here — the ambiguity this guards
 * against is a store simply being absent from `entry` (fetch failed, or
 * the set genuinely isn't listed there), which never upgrades to eligible.
 *
 * Returns null if neither store clears the bar (exclude this set from the
 * run, don't guess). Otherwise returns the resolved featured listing: when
 * both stores clear the bar, the lower price is featured (source_retailer
 * = 'both'), and the other store's price/url is returned alongside for an
 * inline mention, per the "extend schema OR mention inline — pick one"
 * choice in the spec (this pipeline mentions inline; no second price
 * column was added to `reviews`).
 */
export function resolveEligibleListing(entry) {
  if (!entry) return null;

  const clean = {};
  for (const storeId of ['toycra', 'mybrickhouse']) {
    const raw = entry[storeId];
    if (!raw) continue; // absent — store fetch failed, or set not listed there; never treated as eligible
    const priceOk = typeof raw.priceInr === 'number' && raw.priceInr > 0;
    const stockOk = typeof raw.inStock === 'boolean';
    if (priceOk && stockOk) clean[storeId] = raw;
  }

  const storeIds = Object.keys(clean);
  if (storeIds.length === 0) return null;

  // Prefer picking the featured store among ones actually in stock — an
  // out-of-stock listing is never "the better deal" just because its price
  // is lower; a reader can't act on it. Only fall back to an out-of-stock
  // store if NOTHING is in stock anywhere (Pass 1 needs that case to detect
  // "gone out of stock everywhere", not to feature a price from it).
  const inStockIds = storeIds.filter((id) => clean[id].inStock);
  const candidateIds = inStockIds.length > 0 ? inStockIds : storeIds;
  const featuredId = candidateIds.length === 1
    ? candidateIds[0]
    : candidateIds.reduce((a, b) => (clean[a].priceInr <= clean[b].priceInr ? a : b));
  const otherIds = storeIds.filter((id) => id !== featuredId);

  return {
    sourceRetailer:    storeIds.length > 1 ? 'both' : featuredId,
    sourcePriceInr:    clean[featuredId].priceInr,
    sourceStockStatus: clean[featuredId].inStock ? 'in_stock' : 'out_of_stock',
    sourceProductUrl:  clean[featuredId].productUrl,
    otherStore: otherIds.length > 0
      ? { storeId: otherIds[0], priceInr: clean[otherIds[0]].priceInr, productUrl: clean[otherIds[0]].productUrl, inStock: clean[otherIds[0]].inStock }
      : null,
  };
}
