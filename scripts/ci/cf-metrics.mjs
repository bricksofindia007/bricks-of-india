// Read-only Cloudflare health report (round 11, A4). Prints aggregate numbers only: Worker requests,
// errors and CPU per day, R2 storage and operations, KV operations, and the zone's HSTS setting.
// Writes nothing. Each section reports its own error (e.g. a token without Analytics read)
// instead of failing the others.
const TOKEN = (process.env.CLOUDFLARE_API_TOKEN || '').replace(/^﻿/, '').trim();
const ACCOUNT = (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
const DAYS = Number(process.env.DAYS || 7);
const ZONE_NAME = 'bricksofindia.com';
const SCRIPTS = ['bricks-of-india', 'boi-scheduler'];
const API = 'https://api.cloudflare.com/client/v4';
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

const until = new Date();
const since = new Date(until.getTime() - DAYS * 86400e3);
const iso = (d) => d.toISOString();

async function gql(query, variables) {
  const r = await fetch(`${API}/graphql`, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  const j = await r.json();
  if (j.errors?.length) throw new Error(j.errors.map((e) => e.message).join('; '));
  return j.data.viewer.accounts[0];
}

async function section(name, fn) {
  console.log(`\n== ${name}`);
  try { await fn(); } catch (e) { console.log(`ERROR ${name}: ${e.message}`); }
}

await section(`Workers, last ${DAYS} days`, async () => {
  const a = await gql(`query($acc:String!,$s:Time!,$u:Time!){viewer{accounts(filter:{accountTag:$acc}){
    workersInvocationsAdaptive(limit:500,filter:{datetime_geq:$s,datetime_leq:$u}){
      sum{requests errors subrequests} quantiles{cpuTimeP50 cpuTimeP99} dimensions{date scriptName status}}}}}`,
    { acc: ACCOUNT, s: iso(since), u: iso(until) });
  const rows = a.workersInvocationsAdaptive.filter((r) => SCRIPTS.includes(r.dimensions.scriptName));
  const by = {};
  for (const r of rows) {
    const k = `${r.dimensions.scriptName} ${r.dimensions.date}`;
    by[k] ??= { requests: 0, errors: 0, sub: 0, p50: 0, p99: 0, status: {} };
    by[k].requests += r.sum.requests; by[k].errors += r.sum.errors; by[k].sub += r.sum.subrequests;
    by[k].p50 = Math.max(by[k].p50, r.quantiles.cpuTimeP50); by[k].p99 = Math.max(by[k].p99, r.quantiles.cpuTimeP99);
    by[k].status[r.dimensions.status] = (by[k].status[r.dimensions.status] || 0) + r.sum.requests;
  }
  console.log('script date | requests | errors | error % | subrequests | CPU p50 ms | CPU p99 ms | by status');
  for (const [k, v] of Object.entries(by).sort()) {
    console.log(`${k} | ${v.requests} | ${v.errors} | ${(v.requests ? (100 * v.errors / v.requests) : 0).toFixed(2)} | ${v.sub} | ${(v.p50 / 1000).toFixed(1)} | ${(v.p99 / 1000).toFixed(1)} | ${JSON.stringify(v.status)}`);
  }
});

await section('R2 storage and operations', async () => {
  const a = await gql(`query($acc:String!,$s:Time!,$u:Time!){viewer{accounts(filter:{accountTag:$acc}){
    r2StorageAdaptiveGroups(limit:50,filter:{datetime_geq:$s,datetime_leq:$u}){max{objectCount payloadSize} dimensions{bucketName}}
    r2OperationsAdaptiveGroups(limit:200,filter:{datetime_geq:$s,datetime_leq:$u}){sum{requests} dimensions{bucketName actionType}}}}}`,
    { acc: ACCOUNT, s: iso(since), u: iso(until) });
  for (const g of a.r2StorageAdaptiveGroups) console.log(`storage ${g.dimensions.bucketName}: ${g.max.objectCount} objects, ${(g.max.payloadSize / 1e6).toFixed(1)} MB`);
  const ops = {};
  for (const g of a.r2OperationsAdaptiveGroups) ops[`${g.dimensions.bucketName} ${g.dimensions.actionType}`] = (ops[`${g.dimensions.bucketName} ${g.dimensions.actionType}`] || 0) + g.sum.requests;
  for (const [k, v] of Object.entries(ops).sort((x, y) => y[1] - x[1])) console.log(`ops ${k}: ${v}`);
});

await section('KV operations', async () => {
  const a = await gql(`query($acc:String!,$s:Time!,$u:Time!){viewer{accounts(filter:{accountTag:$acc}){
    kvOperationsAdaptiveGroups(limit:200,filter:{datetime_geq:$s,datetime_leq:$u}){sum{requests} dimensions{namespaceId actionType}}}}}`,
    { acc: ACCOUNT, s: iso(since), u: iso(until) });
  const ops = {};
  for (const g of a.kvOperationsAdaptiveGroups) ops[`${g.dimensions.namespaceId} ${g.dimensions.actionType}`] = (ops[`${g.dimensions.namespaceId} ${g.dimensions.actionType}`] || 0) + g.sum.requests;
  if (!Object.keys(ops).length) console.log('no KV operations in the window');
  for (const [k, v] of Object.entries(ops).sort((x, y) => y[1] - x[1])) console.log(`${k}: ${v}`);
});

await section('Zone security header (HSTS)', async () => {
  const z = await (await fetch(`${API}/zones?name=${ZONE_NAME}`, { headers })).json();
  if (!z.success || !z.result?.length) throw new Error(z.errors?.map((e) => e.message).join('; ') || 'zone not visible to this token');
  const s = await (await fetch(`${API}/zones/${z.result[0].id}/settings/security_header`, { headers })).json();
  if (!s.success) throw new Error(s.errors?.map((e) => e.message).join('; '));
  console.log('strict_transport_security:', JSON.stringify(s.result.value?.strict_transport_security));
  const ssl = await (await fetch(`${API}/zones/${z.result[0].id}/settings/always_use_https`, { headers })).json();
  if (ssl.success) console.log('always_use_https:', ssl.result.value);
});
