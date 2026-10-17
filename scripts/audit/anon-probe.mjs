// Read-only probe of the database as an anonymous visitor (the public key only).
// Prints one line per check: object, method, HTTP status, row count, and PASS or FAIL against
// the expectation for that object. Never prints the URL, the key, or row content.
// Writes are probed with an empty body that the table rejects, so nothing is stored either way.
//
// Env: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (GitHub secrets in the workflow).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.log('probe: the public URL or key is not set in this run');
  process.exit(2);
}

// Expectations. "open" = a normal answer is expected. "refused" = 401 or 403 is expected.
const READS = [
  ['sets', 'open'], ['reviews', 'open'], ['news_articles', 'open'], ['guides', 'open'],
  ['blog_posts', 'open'], ['community_spotlights', 'open'], ['cmf_figures', 'open'],
  ['featured_videos', 'open'], ['stores', 'refused'], ['set_price_summary', 'refused'],
  ['raw_signals', 'refused'], ['pending_drafts', 'refused'], ['newsletter_subscribers', 'refused'],
  ['generator_runs', 'refused'], ['posted_sets', 'refused'],
  // The two price tables: direct reads must be refused. The functions below answer instead.
  ['store_prices', 'refused'], ['price_history', 'refused'],
];
const RPCS = [
  { name: 'get_set_prices', body: { p_set_number: '75419' }, expect: 'open' },
  { name: 'get_prices_for_sets', body: { p_set_numbers: ['75419', '10305'] }, expect: 'open' },
  { name: 'get_price_history', body: { p_set_number: '75419', p_limit: 10 }, expect: 'open' },
];
// Insert probes: an empty object violates NOT NULL, so nothing is written. The anonymous role must not insert.
const INSERTS = ['newsletter_subscribers', 'community_spotlights'];

const headers = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
let failures = 0;

function verdict(expect, status) {
  const refused = status === '401' || status === '403';
  const open = status === '200';
  const ok = expect === 'refused' ? refused : open;
  if (!ok) failures++;
  return ok ? 'PASS' : 'FAIL';
}

async function check(label, expect, method, path, body) {
  let status = 'error';
  let rows = '-';
  try {
    const r = await fetch(`${url}/rest/v1/${path}`, {
      method,
      headers: method === 'GET' ? { apikey: key, authorization: `Bearer ${key}` } : headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    status = String(r.status);
    if (method === 'GET' || (method === 'POST' && r.ok)) {
      const j = await r.json().catch(() => null);
      rows = Array.isArray(j) ? String(j.length) : '-';
    }
  } catch {
    status = 'network-error';
  }
  console.log(`${label} | expect ${expect} | ${method} | ${status} | rows:${rows} | ${verdict(expect, status)}`);
}

for (const [t, expect] of READS) await check(`read ${t}`, expect, 'GET', `${t}?select=*&limit=1`);
for (const f of RPCS) await check(`rpc ${f.name}`, f.expect, 'POST', f.name, f.body);
for (const t of INSERTS) await check(`insert-probe ${t}`, 'refused', 'POST', t, {});

console.log(`probe summary: ${failures === 0 ? 'all expectations met' : failures + ' expectation(s) not met'}`);
if (failures > 0) process.exitCode = 1;
