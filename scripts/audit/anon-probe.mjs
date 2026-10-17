// Read-only probe of the database as an anonymous visitor (the public key only).
// Prints one line per check: table or function, method, HTTP status, and a row count.
// Never prints the URL, the key, or any row content. Writes are probed with an empty body
// that the table's constraints reject, so nothing is stored either way.
//
// Env: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (GitHub secrets in the workflow).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.log('probe: the public URL or key is not set in this run');
  process.exit(2);
}

const READS = [
  'sets', 'store_prices', 'set_price_summary', 'price_history', 'stores', 'reviews', 'news_articles',
  'guides', 'blog_posts', 'community_spotlights', 'cmf_figures', 'featured_videos', 'raw_signals',
  'newsletter_subscribers', 'newsletter_drafts', 'pending_drafts', 'generator_runs', 'data_fix_log',
  'set_name_aliases', 'posted_sets', 'prices',
];
const RPCS = ['get_distinct_themes', 'set_page_data'];
// Insert probes: an empty object violates NOT NULL, so nothing is written. The status shows
// whether the anonymous role may insert at all (401/403 = no; 400/409 = allowed but the row is rejected).
const INSERTS = ['newsletter_subscribers', 'community_spotlights'];

const headers = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };

async function check(label, method, path, body) {
  let status = 'error';
  let rows = '-';
  try {
    const r = await fetch(`${url}/rest/v1/${path}`, {
      method,
      headers: method === 'GET' ? { apikey: key, authorization: `Bearer ${key}` } : headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    status = String(r.status);
    if (method === 'GET' && r.ok) {
      const j = await r.json().catch(() => null);
      rows = Array.isArray(j) ? String(j.length) : '-';
    }
  } catch (e) {
    status = 'network-error';
  }
  console.log(`${label} | ${method} | ${status} | rows:${rows}`);
}

for (const t of READS) await check(`read ${t}`, 'GET', `${t}?select=*&limit=1`);
for (const f of RPCS) await check(`rpc ${f}`, 'POST', f, {});
for (const t of INSERTS) await check(`insert-probe ${t}`, 'POST', t, {});
