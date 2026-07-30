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

/**
 * Parse a Shopify product into our internal format. Returns null to skip.
 *
 * knownSetsByName: optional Map<lowercased set name, set_number>, used only
 * for the MyBrickHouse title-has-no-set-number fallback. Pass an empty Map
 * (or omit) if that fallback isn't needed by the caller.
 */
export function parseProduct(product, storeId, domain, knownSetsByName = new Map()) {
  const titleLower  = (product.title  ?? '').toLowerCase();
  const handleLower = (product.handle ?? '').toLowerCase();

  // Skip products that don't appear to be LEGO sets.
  // mybrickhouse is a LEGO-only domain — their titles/handles often omit "lego"
  // (e.g. "Icons Natural History Museum Set 10326"). Skip the string check for
  // that store; the knownSets filter downstream is the real guard.
  if (storeId !== 'mybrickhouse' && !titleLower.includes('lego') && !handleLower.includes('lego')) return null;

  let setNumber = extractSetNumber(product.title, product.handle);
  if (!setNumber && storeId === 'mybrickhouse') {
    // Fallback: match against set name when title/handle omit the set number
    const cleaned = (product.title ?? '').toLowerCase().replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim().replace(/^the\s+/, '');
    setNumber = knownSetsByName.get(cleaned) ?? null;
  }
  if (!setNumber) return null;

  if (!product.variants?.length) return null;

  // Use cheapest in-stock variant; fall back to cheapest overall
  const inStockVariants = product.variants.filter((v) => v.available);
  const variant = inStockVariants.length
    ? inStockVariants.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0]
    : product.variants.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];

  const priceInr = variant.price ? Math.round(parseFloat(variant.price)) : null;
  const inStock  = inStockVariants.length > 0;
  const productUrl = `https://${domain}/products/${product.handle}`;

  return { setNumber, storeId, priceInr, inStock, productUrl };
}
