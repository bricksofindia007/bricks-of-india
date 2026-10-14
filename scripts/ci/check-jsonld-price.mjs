// #220 CI crawl check: on each fixture /sets/ page, the JSON-LD
// AggregateOffer.lowPrice must equal the best in-stock price the page
// displays (the element carrying data-best-price). A page with nothing
// buyable must carry neither. Usage: node scripts/ci/check-jsonld-price.mjs [baseUrl]
import { FIXTURES } from './jsonld-price-fixtures.mjs';

const base = process.argv[2] ?? 'http://localhost:3000';
let fail = 0;

function lowPrices(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    let data;
    try { data = JSON.parse(m[1]); } catch { continue; }
    const walk = (n) => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (n && typeof n === 'object') {
        if (n['@type'] === 'AggregateOffer') out.push(Number(n.lowPrice));
        Object.values(n).forEach(walk);
      }
    };
    walk(data);
  }
  return out;
}

for (const [setNumber, f] of Object.entries(FIXTURES)) {
  const url = `${base}/sets/${setNumber}-ci-fixture`;
  const res = await fetch(url, { headers: { 'x-forwarded-proto': 'https' } });
  const html = await res.text();
  const lows = lowPrices(html);
  const shown = [...html.matchAll(/data-best-price="(\d+)"/g)].map((m) => Number(m[1]));
  const shownBest = shown.length ? Math.min(...shown) : null;
  const low = lows.length ? lows[0] : null;
  const ok = res.status === 200 && lows.length <= 1 && low === f.expectLow && shownBest === f.expectLow;
  console.log(`${ok ? 'PASS' : 'FAIL'} /sets/${setNumber}: status=${res.status} jsonld.lowPrice=${low} displayed.best=${shownBest} expected=${f.expectLow}`);
  if (!ok) { fail = 1; console.log(`::error::JSON-LD lowPrice (${low}) vs displayed best in-stock price (${shownBest}) mismatch at /sets/${setNumber}, expected ${f.expectLow}`); }
}
process.exit(fail);
