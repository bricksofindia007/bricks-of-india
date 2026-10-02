// Round 3 item 4 (read-only): Cloudflare cost measurement. GETs and GraphQL queries only; prints aggregates.
// The bucket listing costs ~1 Class A operation per 1,000 objects (noted in the report).
const CF = 'https://api.cloudflare.com/client/v4';
const T = process.env.CLOUDFLARE_API_TOKEN?.trim();
const A = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const B = 'bricksofindia-next-cache';
const DAYS = Number(process.env.DAYS || 7);
const H = { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' };
const now = new Date();
const since = new Date(now - DAYS * 864e5);
const iso = (d) => d.toISOString().replace(/\.\d+Z$/, 'Z');

async function gql(query, variables) {
  const r = await fetch(`${CF}/graphql`, { method: 'POST', headers: H, body: JSON.stringify({ query, variables }) });
  const j = await r.json();
  if (j.errors?.length) throw new Error(j.errors.map((e) => e.message).join('; ').slice(0, 300));
  return j.data;
}
async function rest(path) {
  const r = await fetch(`${CF}${path}`, { headers: H });
  const j = await r.json();
  if (!j.success) throw new Error(`${path.split('?')[0]}: ${JSON.stringify(j.errors).slice(0, 200)}`);
  return j;
}
async function section(name, fn) {
  console.log(`\n== ${name}`);
  try { await fn(); } catch (e) { console.log(`ERROR ${name}: ${e.message}`); }
}

await section('Schema: available dimensions', async () => {
  for (const t of ['AccountR2OperationsAdaptiveGroupsDimensions', 'AccountR2StorageAdaptiveGroupsDimensions', 'ZoneHttpRequestsAdaptiveGroupsDimensions']) {
    const d = await gql(`query{__type(name:"${t}"){fields{name}}}`);
    console.log(`${t}: ${(d.__type?.fields ?? []).map((f) => f.name).join(', ') || '(type not found)'}`);
  }
});

await section(`R2 storage over time (${B})`, async () => {
  const d = await gql(`query($a:String!,$b:String!,$s:Time!,$e:Time!){viewer{accounts(filter:{accountTag:$a}){r2StorageAdaptiveGroups(limit:10000,orderBy:[datetime_ASC],filter:{bucketName:$b,datetime_geq:$s,datetime_leq:$e}){max{payloadSize metadataSize objectCount} dimensions{datetime}}}}}`,
    { a: A, b: B, s: iso(since), e: iso(now) });
  const day = {};
  for (const r of d.viewer.accounts[0].r2StorageAdaptiveGroups) {
    const k = r.dimensions.datetime.slice(0, 10);
    (day[k] ??= []).push([(r.max.payloadSize + r.max.metadataSize) / 1e9, r.max.objectCount, r.dimensions.datetime]);
  }
  for (const [k, v] of Object.entries(day)) {
    const g = v.map((x) => x[0]);
    console.log(`${k}: min ${Math.min(...g).toFixed(2)} GB, max ${Math.max(...g).toFixed(2)} GB, last ${v.at(-1)[0].toFixed(2)} GB / ${v.at(-1)[1]} objects @ ${v.at(-1)[2]} (${v.length} samples)`);
  }
});

await section('R2 operations by day and action', async () => {
  const d = await gql(`query($a:String!,$b:String!,$s:Time!,$e:Time!){viewer{accounts(filter:{accountTag:$a}){r2OperationsAdaptiveGroups(limit:10000,filter:{bucketName:$b,datetime_geq:$s,datetime_leq:$e}){sum{requests} dimensions{actionType datetimeHour}}}}}`,
    { a: A, b: B, s: iso(since), e: iso(now) });
  const byDay = {};
  const putHour = {};
  for (const r of d.viewer.accounts[0].r2OperationsAdaptiveGroups) {
    const k = r.dimensions.datetimeHour.slice(0, 10);
    byDay[k] ??= {};
    byDay[k][r.dimensions.actionType] = (byDay[k][r.dimensions.actionType] ?? 0) + r.sum.requests;
    if (r.dimensions.actionType === 'PutObject') putHour[r.dimensions.datetimeHour] = (putHour[r.dimensions.datetimeHour] ?? 0) + r.sum.requests;
  }
  for (const [k, v] of Object.entries(byDay).sort()) {
    console.log(`${k}: ${Object.entries(v).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(', ')}`);
  }
  console.log('PutObject by hour (UTC):');
  for (const [h, n] of Object.entries(putHour).sort()) console.log(`  ${h} ${n}`);
});

await section('R2 lifecycle rules', async () => {
  const j = await rest(`/accounts/${A}/r2/buckets/${B}/lifecycle`);
  for (const r of j.result?.rules ?? []) {
    console.log(JSON.stringify({ id: r.id, enabled: r.enabled, prefix: r.conditions?.prefix, del: r.deleteObjectsTransition?.condition, abort: r.abortMultipartUploadsTransition?.condition }));
  }
});

await section('R2 key layout (full listing)', async () => {
  const top = await rest(`/accounts/${A}/r2/buckets/${B}/objects?delimiter=/&per_page=1000`);
  console.log(`top-level prefixes: ${(top.result_info?.delimited ?? []).join(', ')} | top-level objects: ${top.result.length}`);
  let cursor = '';
  let calls = 0;
  const agg = {};
  do {
    const j = await rest(`/accounts/${A}/r2/buckets/${B}/objects?per_page=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    calls++;
    for (const o of j.result) {
      const parts = o.key.split('/');
      const pfx = parts.length > 2 ? `${parts[0]}/${parts[1]}/` : parts.length > 1 ? `${parts[0]}/` : '(root)';
      const m = o.key.match(/\.([a-z]+)$/);
      const k = `${pfx} [.${m ? m[1] : 'none'}]`;
      const a = (agg[k] ??= { n: 0, bytes: 0, oldest: o.last_modified, newest: o.last_modified });
      a.n++;
      a.bytes += o.size;
      if (o.last_modified < a.oldest) a.oldest = o.last_modified;
      if (o.last_modified > a.newest) a.newest = o.last_modified;
    }
    cursor = j.result_info?.is_truncated ? j.result_info.cursor : '';
  } while (cursor && calls < 2000);
  console.log(`list calls: ${calls}`);
  for (const [k, a] of Object.entries(agg).sort((x, y) => y[1].bytes - x[1].bytes)) {
    console.log(`${k}: ${a.n} objects, ${(a.bytes / 1e6).toFixed(1)} MB, oldest ${a.oldest}, newest ${a.newest}`);
  }
});

await section('Zone traffic by client, path class and cache status', async () => {
  const z = await rest(`/zones?name=bricksofindia.com`);
  const zid = z.result?.[0]?.id;
  if (!zid) throw new Error('zone not visible to this token');
  const rows = [];
  for (let d = 0; d < DAYS; d++) {
    const s = new Date(now - (d + 1) * 864e5);
    const e = new Date(now - d * 864e5);
    const q = await gql(`query($z:String!,$s:Time!,$e:Time!){viewer{zones(filter:{zoneTag:$z}){httpRequestsAdaptiveGroups(limit:10000,filter:{datetime_geq:$s,datetime_leq:$e,requestSource:"eyeball"}){count dimensions{clientRequestPath userAgent cacheStatus}}}}}`,
      { z: zid, s: iso(s), e: iso(e) });
    rows.push(...q.viewer.zones[0].httpRequestsAdaptiveGroups);
  }
  const cls = (p) => p.startsWith('/sets/') ? 'sets' : p.startsWith('/news/') ? 'news' : p.startsWith('/reviews/') ? 'reviews'
    : p.startsWith('/_next/') ? '_next assets' : p.startsWith('/api/') ? 'api' : p === '/' ? 'home'
    : /\.(png|jpe?g|webp|svg|ico|css|js|txt|xml)$/.test(p) ? 'static file' : 'other pages';
  const BOTS = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|curl|python|node-fetch|axios|go-http|headless|wget|scrapy|httpclient|java\//i;
  const who = (ua) => /BOI-QualityBot/.test(ua || '') ? 'our renderer (#430)' : BOTS.test(ua || '') ? 'bots/tools' : 'browsers';
  const agg = {};
  const cache = {};
  const whoTot = {};
  let total = 0;
  for (const r of rows) {
    const w = who(r.dimensions.userAgent);
    const c = cls(r.dimensions.clientRequestPath);
    agg[`${w} | ${c}`] = (agg[`${w} | ${c}`] ?? 0) + r.count;
    cache[`${c} ${r.dimensions.cacheStatus}`] = (cache[`${c} ${r.dimensions.cacheStatus}`] ?? 0) + r.count;
    whoTot[w] = (whoTot[w] ?? 0) + r.count;
    total += r.count;
  }
  console.log(`groups returned: ${rows.length} (limit 10000 per day; a day at the limit is truncated); requests counted: ${total}`);
  for (const [w, n] of Object.entries(whoTot)) console.log(`${w}: ${n} (${(100 * n / total).toFixed(1)}%)`);
  for (const [k, n] of Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${k}: ${n}`);
  console.log('cache status by path class:');
  for (const [k, n] of Object.entries(cache).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${k}: ${n}`);
});
