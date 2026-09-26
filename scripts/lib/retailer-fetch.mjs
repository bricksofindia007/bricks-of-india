/**
 * Shared MyBrickHouse / Toycra Shopify product-feed fetch logic.
 *
 * Extracted from scripts/scrape-now.mjs (2026-07-30) so the reviews source
 * pipeline (scripts/lib/reviews-source.mjs) can reuse the exact same fetch
 * behavior scrape-now.mjs has run every 6h since 2026-05 — no behavior
 * change versus the pre-extraction inline version.
 */

// Toycra has a dedicated LEGO collection — avoids paging through thousands
// of non-LEGO toys. MyBrickHouse is LEGO-heavy so general path works.
export const STORES = [
  {
    id:     'toycra',
    name:   'Toycra',
    domain: 'www.toycra.com',
    path:   '/collections/lego/products.json',
  },
  {
    id:     'mybrickhouse',
    name:   'MyBrickHouse',
    domain: 'lego.mybrickhouse.com',
    path:   '/products.json',
  },
];

/** Exponential-backoff retry: 2 s, 4 s, 8 s */
export async function withRetry(fn, retries = 3, baseMs = 2000) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries - 1) throw err;
      const delay = baseMs * 2 ** attempt;
      console.warn(`    Retry ${attempt + 1}/${retries} in ${delay / 1000}s: ${err.message}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

/** Fetch all products from a Shopify store via paginated /products.json */
export async function fetchAllProducts(domain, path) {
  const products = [];
  let page = 1;

  while (true) {
    const url = `https://${domain}${path}?limit=250&page=${page}`;
    console.log(`    Page ${page}: ${url}`);

    const data = await withRetry(async () => {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'BricksOfIndia/1.0 (+https://bricksofindia.com)', Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      return res.json();
    });

    const batch = data.products ?? [];
    if (batch.length === 0) break;
    products.push(...batch);
    if (batch.length < 250) break;
    page++;
    await new Promise((r) => setTimeout(r, 400)); // be polite
  }

  return products;
}

/**
 * Extract a LEGO set number (4–6 digits) from product handle then title.
 *
 * Handles are more structured than titles and checked first.
 * Supported title formats:
 *   "LEGO Icons 10497 Galaxy Explorer"
 *   "LEGO 10497 - Galaxy Explorer"
 *   "Galaxy Explorer (10497)"
 *   "10497 Galaxy Explorer"
 *   "LEGO® 10497 Galaxy Explorer"
 *
 * Returns null if no plausible set number found.
 */
export function extractSetNumber(title, handle) {
  // Match standalone 4-6 digit sequences (not preceded/followed by another digit)
  const RE = /(?<!\d)(\d{4,6})(?!\d)/g;

  // Check handle FIRST — more structured and less likely to contain noise numbers
  const fromHandle = [...(handle ?? '').matchAll(RE)].map((m) => m[1]);
  const fromTitle  = [...(title  ?? '').matchAll(RE)].map((m) => m[1]);

  // Merge handle-first, deduplicated, return first candidate
  const candidates = [...new Set([...fromHandle, ...fromTitle])];
  return candidates[0] ?? null;
}

// Listing identity (Wave 1 PR-0, 2026-09-26). The product's own SKU is the
// most reliable set number: MyBrickHouse SKUs are the plain set number
// ("40912"), Toycra's are "Lego72537". Title/handle regex comes second -- on
// its own it took the FIRST 4-6 digit run, which mis-matched 11 live MBH
// listings to unrelated sets ("Unimog U 5023 with Crane" -> 5023 Fences,
// "Ferrari F2004" -> 2004 Jumbo Building Tub, "Spider-Man 2099" -> 2099 ...;
// every one carried the correct number in its SKU). The name map is last.
const SET_NUMBER_RE = /(?<!\d)(\d{4,7})(?!\d)/;
export const MATCH_RANK = { sku: 0, text: 1, name: 2 };

function skuSetNumber(product, knownSets) {
  for (const v of product.variants ?? []) {
    const m = String(v.sku ?? '').match(SET_NUMBER_RE);
    if (m && knownSets.has(m[1])) return m[1];
  }
  return null;
}

/**
 * Parse a Shopify product into our internal format. Returns null to skip.
 *
 * knownSetsByName: optional Map<lowercased set name, set_number>, used for
 * the MyBrickHouse title-has-no-set-number fallback. knownSets: optional
 * Set of catalogue set numbers used to validate a SKU match; defaults to the
 * name map's values so existing callers get SKU matching without changes.
 *
 * Returns matchMethod ('sku' | 'text' | 'name'), productId and
 * productCreatedAt so callers can pick a canonical listing when a store lists
 * one set more than once (see canonicalRank), and compareAtInr -- the
 * listing's displayed MRP / strike-through (Shopify compare_at_price) for the
 * chosen variant, null when the store sets none.
 */
export function parseProduct(product, storeId, domain, knownSetsByName = new Map(), knownSets = null) {
  const titleLower  = (product.title  ?? '').toLowerCase();
  const handleLower = (product.handle ?? '').toLowerCase();

  // Skip products that don't appear to be LEGO sets.
  // mybrickhouse is a LEGO-only domain — their titles/handles often omit "lego"
  // (e.g. "Icons Natural History Museum Set 10326"). Skip the string check for
  // that store; the knownSets filter downstream is the real guard.
  if (storeId !== 'mybrickhouse' && !titleLower.includes('lego') && !handleLower.includes('lego')) return null;
  if (!product.variants?.length) return null;

  const known = knownSets ?? new Set(knownSetsByName.values());
  let matchMethod = 'sku';
  let setNumber = skuSetNumber(product, known);
  if (!setNumber) {
    matchMethod = 'text';
    setNumber = extractSetNumber(product.title, product.handle);
  }
  if (!setNumber && storeId === 'mybrickhouse') {
    // Fallback: match against set name when title/handle omit the set number
    matchMethod = 'name';
    const cleaned = (product.title ?? '').toLowerCase().replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim().replace(/^the\s+/, '');
    setNumber = knownSetsByName.get(cleaned) ?? null;
  }
  if (!setNumber) return null;

  // Use cheapest in-stock variant; fall back to cheapest overall
  const inStockVariants = product.variants.filter((v) => v.available);
  const variant = inStockVariants.length
    ? inStockVariants.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0]
    : product.variants.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];

  const priceInr = variant.price ? Math.round(parseFloat(variant.price)) : null;
  const compareAtInr = variant.compare_at_price ? Math.round(parseFloat(variant.compare_at_price)) : null;
  const inStock  = inStockVariants.length > 0;
  const productUrl = `https://${domain}/products/${product.handle}`;

  return {
    setNumber, storeId, priceInr, compareAtInr, inStock, productUrl,
    matchMethod, productId: product.id ?? null, productCreatedAt: product.created_at ?? null,
  };
}

/**
 * Canonical-listing order when one store lists the same set more than once
 * (Abhinav, 2026-09-26): SKU match, then set number in title/URL, then name
 * map; ties go to the OLDEST listing (created_at, then product id). Never by
 * price or stock -- choosing the cheaper listing is price-based filtering
 * (locked pricing rule R1). Lower rank = more canonical.
 */
export function canonicalRank(parsed) {
  return [
    MATCH_RANK[parsed.matchMethod] ?? 9,
    parsed.productCreatedAt ? Date.parse(parsed.productCreatedAt) : Number.MAX_SAFE_INTEGER,
    Number(parsed.productId ?? Number.MAX_SAFE_INTEGER),
  ];
}

export function isMoreCanonical(a, b) {
  const ra = canonicalRank(a), rb = canonicalRank(b);
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] < rb[i];
  return false;
}
