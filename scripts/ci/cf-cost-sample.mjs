// Round 3 item 4 (read-only), part 2: which routes fill the R2 ISR cache. Lists two builds' .cache objects,
// reads a random sample of each (GetObject = Class B) and classifies the page from its canonical URL.
// Also: R2 PutObject per object for the busiest hours (objectName dimension), so rewrites vs first writes show.
const CF = 'https://api.cloudflare.com/client/v4';
const T = process.env.CLOUDFLARE_API_TOKEN?.trim();
const A = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const B = 'bricksofindia-next-cache';
const BUILDS = (process.env.BUILDS || 'Y3Vxt2qdLnUjwpWae9Duh,8gzK1nRxqdGu2k-LHvuqz').split(',');
const N = Number(process.env.SAMPLE || 250);
const H = { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' };

async function rest(path) {
  const r = await fetch(`${CF}${path}`, { headers: H });
  const j = await r.json();
  if (!j.success) throw new Error(`${path.split('?')[0]}: ${JSON.stringify(j.errors).slice(0, 200)}`);
  return j;
}
async function gql(query, variables) {
  const r = await fetch(`${CF}/graphql`, { method: 'POST', headers: H, body: JSON.stringify({ query, variables }) });
  const j = await r.json();
  if (j.errors?.length) throw new Error(j.errors.map((e) => e.message).join('; ').slice(0, 300));
  return j.data;
}
const cls = (u) => {
  const p = u.replace(/^https?:\/\/[^/]+/, '') || '/';
  if (p.startsWith('/sets/')) return 'sets';
  if (p.startsWith('/news/')) return 'news';
  if (p.startsWith('/reviews/')) return 'reviews';
  if (p.startsWith('/blog/') || p.startsWith('/guides/') || p.startsWith('/community/') || p.startsWith('/opinion/')) return 'blog/guides/community/opinion';
  if (p.startsWith('/themes/')) return 'themes';
  if (p === '/' || p === '') return 'home';
  if (p.startsWith('/deals')) return 'deals';
  if (p.startsWith('/lab/')) return 'lab';
  return 'other';
};

const keyClass = {};
for (const build of BUILDS) {
  console.log(`\n== build ${build}`);
  const keys = [];
  let cursor = '';
  do {
    const j = await rest(`/accounts/${A}/r2/buckets/${B}/objects?prefix=${encodeURIComponent(`incremental-cache/${build}/`)}&per_page=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    for (const o of j.result) if (o.key.endsWith('.cache')) keys.push(o.key);
    cursor = j.result_info?.is_truncated ? j.result_info.cursor : '';
  } while (cursor);
  const sample = keys.sort(() => Math.random() - 0.5).slice(0, N);
  const counts = {};
  let unknown = 0;
  for (const k of sample) {
    const r = await fetch(`${CF}/accounts/${A}/r2/buckets/${B}/objects/${encodeURIComponent(k)}`, { headers: H });
    const t = await r.text();
    const m = t.match(/rel=\\?"canonical\\?" href=\\?"([^"\\]+)/) || t.match(/href=\\?"([^"\\]+)\\?" rel=\\?"canonical/);
    if (!m) { unknown++; counts['(no canonical: RSC/route data)'] = (counts['(no canonical: RSC/route data)'] ?? 0) + 1; continue; }
    const c = cls(m[1]);
    keyClass[k.split('/').pop()] = c;
    counts[c] = (counts[c] ?? 0) + 1;
  }
  console.log(`.cache objects: ${keys.length}; sampled ${sample.length}`);
  for (const [c, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c}: ${n} (${(100 * n / sample.length).toFixed(0)}%) -> est. ${Math.round(keys.length * n / sample.length)} objects`);
  }
}

console.log('\n== PutObject per object, busiest windows (rewrites vs first writes)');
for (const [s, e] of [['2026-10-02T12:00:00Z', '2026-10-02T15:00:00Z'], ['2026-10-01T22:00:00Z', '2026-10-02T00:00:00Z'], ['2026-10-02T16:00:00Z', '2026-10-02T18:00:00Z']]) {
  try {
    const d = await gql(`query($a:String!,$b:String!,$s:Time!,$e:Time!){viewer{accounts(filter:{accountTag:$a}){r2OperationsAdaptiveGroups(limit:10000,orderBy:[sum_requests_DESC],filter:{bucketName:$b,actionType:"PutObject",datetime_geq:$s,datetime_leq:$e}){sum{requests} dimensions{objectName}}}}}`, { a: A, b: B, s, e });
    const rows = d.viewer.accounts[0].r2OperationsAdaptiveGroups;
    const puts = rows.reduce((x, r) => x + r.sum.requests, 0);
    const multi = rows.filter((r) => r.sum.requests > 1);
    const byExt = {};
    for (const r of rows) { const x = r.dimensions.objectName.endsWith('.fetch') ? 'fetch' : r.dimensions.objectName.endsWith('.cache') ? 'cache' : 'other'; byExt[x] = (byExt[x] ?? 0) + r.sum.requests; }
    const top = rows.slice(0, 5).map((r) => `${r.sum.requests}x ${keyClass[r.dimensions.objectName.split('/').pop()] ?? '?'} ${r.dimensions.objectName.split('/').pop().slice(0, 12)}`);
    console.log(`${s}..${e}: ${puts} puts on ${rows.length} keys${rows.length >= 10000 ? ' (truncated)' : ''}; keys written >1x: ${multi.length} (${multi.reduce((x, r) => x + r.sum.requests, 0)} puts); by type ${JSON.stringify(byExt)}; top: ${top.join(' | ')}`);
  } catch (err) { console.log(`ERROR window ${s}: ${err.message}`); }
}
