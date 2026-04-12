/**
 * Bricks of India — Price Scraper
 * Runs every 6 hours on Render.com
 * Tests each store and scrapes prices where possible.
 * Falls back to "Check Price" link if blocked.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cheerio = require('cheerio');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL is not set');
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error(
    'ERROR: SUPABASE_SERVICE_ROLE_KEY is not set\n' +
    'Get it from: Supabase dashboard → Settings → API → service_role secret key',
  );
  process.exit(1);
}

// Service role key bypasses RLS — required for price upserts
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Store configs
const STORES = [
  {
    name: 'Toycra',
    baseUrl: 'https://www.toycra.com',
    searchUrl: (setNumber) => `https://www.toycra.com/search?q=lego+${setNumber}`,
    buyUrl: (setNumber) => `https://www.toycra.com/search?q=lego+${setNumber}`,
    scrapeEnabled: true,
  },
  {
    name: 'MyBrickHouse',
    baseUrl: 'https://mybrickhouse.in',
    searchUrl: (setNumber) => `https://mybrickhouse.in/search?q=${setNumber}`,
    buyUrl: (setNumber) => `https://mybrickhouse.in/search?q=${setNumber}`,
    scrapeEnabled: true,
  },
  {
    name: 'Hamleys India',
    baseUrl: 'https://hamleys.in',
    searchUrl: (setNumber) => `https://www.hamleys.in/search.req?searchTerm=${setNumber}`,
    buyUrl: (setNumber) => `https://www.hamleys.in/search.req?searchTerm=lego+${setNumber}`,
    scrapeEnabled: false, // Test and enable if unblocked
  },
  {
    name: 'FirstCry',
    baseUrl: 'https://www.firstcry.com',
    searchUrl: (setNumber) => `https://www.firstcry.com/toys/lego/${setNumber}`,
    buyUrl: (setNumber) => `https://www.firstcry.com/search?q=lego+${setNumber}`,
    scrapeEnabled: false,
  },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

async function testScrapability(store) {
  try {
    const res = await axios.get(store.searchUrl('75192'), {
      headers: HEADERS,
      timeout: 10000,
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function scrapeToycra(setNumber) {
  try {
    const url = `https://www.toycra.com/search?q=lego+${setNumber}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);

    // Look for price in search results
    let price = null;
    let productUrl = url;

    // Common Shopify price selectors
    const priceEl = $('[class*="price"]:first, .price, .product-price').first();
    const priceText = priceEl.text().trim();
    const match = priceText.match(/[\d,]+/);
    if (match) {
      price = parseInt(match[0].replace(/,/g, ''));
    }

    // Get first product link
    const firstLink = $('a[href*="/products/"]').first();
    if (firstLink.length) {
      productUrl = 'https://www.toycra.com' + firstLink.attr('href');
    }

    return {
      price_inr: price,
      availability: price ? 'in_stock' : 'unknown',
      buy_url: productUrl,
    };
  } catch {
    return null;
  }
}

async function scrapeMyBrickHouse(setNumber) {
  try {
    const url = `https://mybrickhouse.in/search?q=${setNumber}`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(res.data);

    let price = null;
    let productUrl = url;

    const priceEl = $('[class*="price"]:first, .price').first();
    const priceText = priceEl.text().trim();
    const match = priceText.match(/[\d,]+/);
    if (match) {
      price = parseInt(match[0].replace(/,/g, ''));
    }

    const firstLink = $('a[href*="/products/"]').first();
    if (firstLink.length) {
      productUrl = 'https://mybrickhouse.in' + firstLink.attr('href');
    }

    return {
      price_inr: price,
      availability: price ? 'in_stock' : 'unknown',
      buy_url: productUrl,
    };
  } catch {
    return null;
  }
}

async function upsertPrice(setId, storeName, storeUrl, priceData) {
  const { error } = await supabase.from('prices').upsert({
    set_id: setId,
    store_name: storeName,
    store_url: storeUrl,
    price_inr: priceData.price_inr,
    availability: priceData.availability,
    buy_url: priceData.buy_url,
    scraped_at: new Date().toISOString(),
    is_active: true,
  }, {
    onConflict: 'set_id,store_name',
  });
  if (error) console.error(`Error upserting price for ${storeName}:`, error.message);
}

async function runScraper() {
  console.log('🔍 Bricks of India Price Scraper starting...');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // Get all sets from Supabase
  const { data: sets, error } = await supabase
    .from('sets')
    .select('id, set_number, name')
    .limit(500); // Process in batches

  if (error) {
    console.error('Failed to fetch sets:', error.message);
    process.exit(1);
  }

  console.log(`Processing ${sets.length} sets...`);

  for (const set of sets) {
    console.log(`Scraping ${set.set_number} — ${set.name}`);

    // Toycra
    const toycraData = await scrapeToycra(set.set_number);
    if (toycraData) {
      await upsertPrice(set.id, 'Toycra', 'https://www.toycra.com', toycraData);
    } else {
      // Fallback — show check price link
      await upsertPrice(set.id, 'Toycra', 'https://www.toycra.com', {
        price_inr: null,
        availability: 'unknown',
        buy_url: `https://www.toycra.com/search?q=lego+${set.set_number}`,
      });
    }

    // MyBrickHouse
    const mbhData = await scrapeMyBrickHouse(set.set_number);
    if (mbhData) {
      await upsertPrice(set.id, 'MyBrickHouse', 'https://mybrickhouse.in', mbhData);
    } else {
      await upsertPrice(set.id, 'MyBrickHouse', 'https://mybrickhouse.in', {
        price_inr: null,
        availability: 'unknown',
        buy_url: `https://mybrickhouse.in/search?q=${set.set_number}`,
      });
    }

    // Other stores — add as search links only if scraping blocked
    for (const store of STORES.slice(2)) {
      await upsertPrice(set.id, store.name, store.baseUrl, {
        price_inr: null,
        availability: 'unknown',
        buy_url: store.buyUrl(set.set_number),
      });
    }

    // Throttle to avoid rate limiting
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('✅ Scraper complete!');
}

runScraper().catch(console.error);
