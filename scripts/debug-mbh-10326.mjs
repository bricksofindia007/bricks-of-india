// Fetch MBH products.json and check how 10326 appears (title, handle, lego filter)
const domain = 'lego.mybrickhouse.com';
let page = 1, found = null, totalFetched = 0, legoFiltered = 0, noSetNum = 0;

outer: while (true) {
  const url = `https://${domain}/products.json?limit=250&page=${page}`;
  console.log(`Fetching page ${page}...`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'BricksOfIndia/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) { console.error(`HTTP ${res.status}`); break; }
  const { products } = await res.json();
  if (!products?.length) { console.log('No more products.'); break; }
  totalFetched += products.length;

  for (const p of products) {
    const title = (p.title ?? '').toLowerCase();
    const handle = (p.handle ?? '').toLowerCase();
    // Log the filter decision for products matching 10326
    if (handle.includes('10326') || title.includes('10326')) {
      found = p;
      console.log('\n=== FOUND 10326 product ===');
      console.log('Title:', p.title);
      console.log('Handle:', p.handle);
      console.log('Title includes "lego":', title.includes('lego'));
      console.log('Handle includes "lego":', handle.includes('lego'));
      console.log('Would be FILTERED OUT by lego check:', !title.includes('lego') && !handle.includes('lego'));
      console.log('Variants (first 2):', JSON.stringify(p.variants?.slice(0, 2).map(v => ({ price: v.price, available: v.available })), null, 2));
      break outer;
    }
    // Count how many get dropped by lego filter
    if (!title.includes('lego') && !handle.includes('lego')) legoFiltered++;
    // Count how many LEGO products have no set number
    else {
      const RE = /(?<!\d)(\d{4,6})(?!\d)/g;
      const fromHandle = [...handle.matchAll(RE)].map(m => m[1]);
      const fromTitle = [...title.matchAll(RE)].map(m => m[1]);
      const candidates = [...new Set([...fromHandle, ...fromTitle])];
      if (!candidates[0]) noSetNum++;
    }
  }

  if (products.length < 250) break;
  page++;
  await new Promise(r => setTimeout(r, 400));
}

console.log(`\nTotal products fetched: ${totalFetched}`);
console.log(`Dropped by "lego" filter: ${legoFiltered}`);
console.log(`LEGO products with no set number: ${noSetNum}`);
if (!found) console.log('\n10326 NOT FOUND in any page of products.json');
