// Fix D (2026-09-26): a do-nothing PostgREST stand-in for CI.
//
// ci.yml's `next build` + `next start` route scan used the PRODUCTION
// Supabase keys, so every PR push prerendered and rendered every static route
// against the live database -- hundreds of API requests per run, each writing
// a ~2.5 KB gateway log line (log ingest is over the Free quota). CI only
// needs the build to succeed and the rendered HTML to be scannable (email
// leak, <title>/description defects), not real data, so the job points
// NEXT_PUBLIC_SUPABASE_URL here instead.
//
// Behaves like PostgREST with zero matching rows:
//   GET/HEAD /rest/v1/<table>  -> 200 []  (Content-Range */0)
//   ...with Accept: application/vnd.pgrst.object+json (.single())
//                              -> 406 PGRST116, exactly what the real API returns
//   POST /rest/v1/rpc/<fn>     -> 200 null
//   anything else              -> 200 []
// No data, no network beyond 127.0.0.1.
//
// #220 exception: POST rpc/set_page_data for the three fixture sets in
// scripts/ci/jsonld-price-fixtures.mjs returns a synthetic page payload, so
// check-jsonld-price.mjs can compare each /sets/ page's JSON-LD lowPrice with
// the best in-stock price the page displays. Fixture set numbers (99xxx)
// don't exist in the real catalogue.
import http from 'node:http';
import { setPageData, fixtureStorePrices, fixtureSummary } from './jsonld-price-fixtures.mjs';

const STORES_FIXTURE = [
  { id: 'mybrickhouse', name: 'MyBrickHouse', site_url: 'https://lego.mybrickhouse.com', display_order: 10, affiliate_note: null, price_precision: 0 },
  { id: 'toycra', name: 'Toycra', site_url: 'https://www.toycra.com', display_order: 20, affiliate_note: 'ABHINAV12 gives 12% off at Toycra; we earn a commission.', price_precision: 0 },
];

const PORT = Number(process.env.SUPABASE_STUB_PORT ?? 54321);
let hits = 0;

http.createServer((req, res) => {
  hits++;
  const accept = String(req.headers.accept ?? '');
  const json = (status, body, extra = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Range': '*/0', ...extra });
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify(body));
  };
  if (req.method === 'POST' && req.url?.startsWith('/rest/v1/rpc/set_page_data')) {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      let setNumber = null;
      try { setNumber = JSON.parse(body || '{}').p_set_number ?? null; } catch {}
      json(200, setPageData(setNumber));
    });
    return;
  }
  req.resume();
  // FP5.1: pages name and list stores from the registry (src/lib/stores.ts).
  // Serve the two production rows so fixture set pages render store rows.
  if (req.method === 'GET' && req.url?.startsWith('/rest/v1/stores')) {
    return json(200, STORES_FIXTURE, { 'Content-Range': `0-${STORES_FIXTURE.length - 1}/*` });
  }
  // P10 revalidate audit: one content row per detail route, so the audit can
  // render /news|/reviews|/guides|/community/ci-fixture and read its revalidate.
  const content = req.method === 'GET' && /^\/rest\/v1\/(news_articles|reviews|guides|community_spotlights)\?/.exec(req.url ?? '');
  if (content && new URL(req.url, 'http://x').searchParams.get('slug') === 'eq.ci-fixture' && accept.includes('application/vnd.pgrst.object+json')) {
    return json(200, {
      id: '00000000-0000-0000-0000-000000000001', slug: 'ci-fixture', title: 'CI fixture article', content: 'CI fixture body.',
      excerpt: 'CI fixture excerpt for the revalidate audit.', published_at: '2026-09-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z', category: 'News', hero_image: null, featured_image_url: null, seo_title: 'CI fixture article',
      seo_description: 'CI fixture excerpt for the revalidate audit.', verdict: null, rating: null, set_id: null, set_number: null,
      sets: null, author: null, youtube_url: null, tags: [], image_url: null, source_url: null, name: 'CI fixture',
    });
  }
  // P10: the set page's separate 6 h offers read, for fixture sets.
  const fx = req.method === 'GET' && /^\/rest\/v1\/(store_prices|set_price_summary)\?/.exec(req.url ?? '');
  if (fx) {
    const setId = new URL(req.url, 'http://x').searchParams.get('set_id')?.replace(/^eq\./, '');
    if (fx[1] === 'store_prices' && fixtureStorePrices(setId)) return json(200, fixtureStorePrices(setId));
    if (fx[1] === 'set_price_summary' && fixtureSummary(setId)) {
      const s = fixtureSummary(setId);
      return accept.includes('application/vnd.pgrst.object+json') ? json(200, s) : json(200, [s]);
    }
  }
  if (req.url?.startsWith('/rest/v1/rpc/')) return json(200, null);
  if (accept.includes('application/vnd.pgrst.object+json')) {
    return json(406, { code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' });
  }
  return json(200, []);
}).listen(PORT, '127.0.0.1', () => console.log(`[supabase-stub] listening on 127.0.0.1:${PORT}`));

process.on('SIGTERM', () => { console.log(`[supabase-stub] served ${hits} request(s)`); process.exit(0); });
