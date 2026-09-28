#!/usr/bin/env node
// FP1.3 (P5 decision 6): like-for-like Workers CPU by script version -- median (P50) and P90
// CPU per request for each deployed version of the site Worker, per UTC day. Read-only
// (Cloudflare GraphQL analytics via the deploy token).
const CF = 'https://api.cloudflare.com/client/v4/graphql';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim(), ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const SCRIPT = process.env.WORKER_NAME ?? 'bricks-of-india';
const since = process.env.SINCE ?? new Date(Date.now() - 6 * 864e5).toISOString();
const q = `query($a:String!,$s:Time!,$e:Time!,$n:String!){viewer{accounts(filter:{accountTag:$a}){
  workersInvocationsAdaptive(limit:500,filter:{datetime_geq:$s,datetime_leq:$e,scriptName:$n},orderBy:[date_ASC]){
    sum{requests errors} quantiles{cpuTimeP50 cpuTimeP90 cpuTimeP99} dimensions{date scriptVersion}}}}}`;
const r = await fetch(CF, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: q, variables: { a: ACCOUNT, s: since, e: new Date().toISOString(), n: SCRIPT } }) });
const j = await r.json();
if (j.errors?.length) { console.error('GraphQL:', JSON.stringify(j.errors).slice(0, 400)); process.exit(1); }
const rows = j.data.viewer.accounts[0].workersInvocationsAdaptive;
const lines = ['| day (UTC) | version | requests | errors | CPU P50 ms | P90 ms | P99 ms |', '|---|---|---|---|---|---|---|'];
for (const x of rows) lines.push(`| ${x.dimensions.date} | ${(x.dimensions.scriptVersion ?? '-').slice(0, 8)} | ${x.sum.requests} | ${x.sum.errors} | ${(x.quantiles.cpuTimeP50 / 1000).toFixed(1)} | ${(x.quantiles.cpuTimeP90 / 1000).toFixed(1)} | ${(x.quantiles.cpuTimeP99 / 1000).toFixed(1)} |`);
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Workers CPU by version\n${lines.join('\n')}\n`);
