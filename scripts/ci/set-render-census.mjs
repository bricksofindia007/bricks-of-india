#!/usr/bin/env node
// P6 Step 2b (read-only): how many DISTINCT set pages re-render per day, how many renders are
// repeats, and what share are sets with no retailer offers. There are no render-call logs
// (Worker observability is off; Supabase edge logs don't carry rpc bodies), so this reads the
// evidence the renders leave behind:
//   1. R2 incremental cache (bricksofindia-next-cache): every ISR (re)render of /sets/<slug> writes
//      incremental-cache/<buildId>/<sha256(path)>.cache. Objects uploaded in the window = distinct
//      set pages rendered in the window (R2 keeps the latest write only, so repeats aren't visible
//      here).
//   2. Cloudflare GraphQL (best effort; needs Analytics Read on the token): R2 PutObject counts for
//      the bucket (approx. total renders incl. repeats) and /sets/* requests by user agent and
//      cache status (who is asking).
// Writes nothing anywhere. Output: aggregate counts + the list of rendered slugs (public URLs).
import fs from 'node:fs';
import crypto from 'node:crypto';

const CF = 'https://api.cloudflare.com/client/v4';
const TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim(), ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const BUCKET = process.env.R2_BUCKET ?? 'bricksofindia-next-cache';
const HOURS = Number(process.env.WINDOW_HOURS ?? 24);
const SB = process.env.SUPABASE_URL?.replace(/\/$/, ''), SK = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/^﻿/, '').trim();
const OUT = process.env.OUT_DIR ?? 'census-out';
fs.mkdirSync(OUT, { recursive: true });
const H = { Authorization: `Bearer ${TOKEN}` };
const since = new Date(Date.now() - HOURS * 3600e3);

export function slugify(text) { // exact copy of src/lib/utils.ts slugify (keep in sync)
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

async function cfList(prefix, delimiter, cursor) {
  const u = new URL(`${CF}/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects`);
  u.searchParams.set('per_page', '1000');
  if (prefix) u.searchParams.set('prefix', prefix);
  if (delimiter) u.searchParams.set('delimiter', delimiter);
  if (cursor) u.searchParams.set('cursor', cursor);
  const r = await fetch(u, { headers: H });
  const j = await r.json();
  if (!j.success) throw new Error(`R2 list ${prefix}: ${JSON.stringify(j.errors).slice(0, 300)}`);
  return j;
}

async function supabaseAll(path) {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${SB}/rest/v1/${path}`, { headers: { apikey: SK, Authorization: `Bearer ${SK}`, Range: `${off}-${off + 999}` } });
    if (!r.ok) throw new Error(`supabase ${path}: ${r.status}`);
    const rows = await r.json(); out.push(...rows); if (rows.length < 1000) break;
  }
  return out;
}

async function gql(query, variables) {
  const r = await fetch(`${CF}/graphql`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  const j = await r.json();
  if (j.errors?.length) throw new Error(j.errors.map((e) => e.message).join('; ').slice(0, 300));
  return j.data;
}

async function main() {
  if (!TOKEN || !ACCOUNT) throw new Error('CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID missing');
  const report = { window_hours: HOURS, since: since.toISOString() };

  // ── current build prefix = the incremental-cache/<buildId>/ with the newest object ──
  const top = await cfList('incremental-cache/', '/');
  const prefixes = top.result_info?.delimited ?? top.result?.delimited ?? [];
  let best = null;
  for (const p of prefixes) {
    let newest = 0, cursor, n = 0;
    do { const j = await cfList(p, null, cursor); for (const o of j.result) { n++; newest = Math.max(newest, Date.parse(o.last_modified)); } cursor = j.result_info?.is_truncated ? j.result_info.cursor : null; } while (cursor && n < 3000);
    if (!best || newest > best.newest) best = { prefix: p, newest };
  }
  if (!best) throw new Error(`no incremental-cache/<buildId>/ prefixes found (got ${JSON.stringify(prefixes).slice(0, 200)})`);
  report.build_prefix = best.prefix; report.build_prefixes_total = prefixes.length;

  const objs = [];
  let cursor;
  do { const j = await cfList(best.prefix, null, cursor); objs.push(...j.result); cursor = j.result_info?.is_truncated ? j.result_info.cursor : null; } while (cursor);
  const pageObjs = objs.filter((o) => o.key.endsWith('.cache'));
  const inWindow = pageObjs.filter((o) => Date.parse(o.last_modified) >= since.getTime());
  report.objects_in_build = objs.length; report.page_objects = pageObjs.length; report.page_objects_rendered_in_window = inWindow.length;

  // ── map page objects back to /sets/<slug> ──
  const sets = await supabaseAll('sets?select=set_number,name');
  const priced = new Set((await supabaseAll('store_prices?select=set_id')).map((r) => r.set_id));
  const byHash = new Map();
  for (const s of sets) {
    const slug = `${s.set_number}-${slugify(s.name ?? '')}`;
    for (const k of [`/sets/${slug}`, `sets/${slug}`]) byHash.set(crypto.createHash('sha256').update(k).digest('hex'), { slug, set: s.set_number });
  }
  const hashOf = (key) => key.slice(best.prefix.length).replace(/\.cache$/, '');
  const renderedSets = inWindow.map((o) => byHash.get(hashOf(o.key))).filter(Boolean);
  const allSetPagesInBuild = pageObjs.map((o) => byHash.get(hashOf(o.key))).filter(Boolean);
  report.distinct_set_pages_rendered_in_window = renderedSets.length;
  report.of_which_unpriced = renderedSets.filter((x) => !priced.has(x.set)).length;
  report.of_which_priced = renderedSets.length - report.of_which_unpriced;
  report.unpriced_share = renderedSets.length ? +(report.of_which_unpriced / renderedSets.length).toFixed(3) : null;
  report.set_pages_in_build_cache = allSetPagesInBuild.length;
  report.non_set_or_unmapped_page_objects_in_window = inWindow.length - renderedSets.length;
  report.catalogue = { sets: sets.length, priced_sets: priced.size };

  // ── best effort: R2 writes (≈ renders incl. repeats) and who requests /sets/* ──
  const day = since.toISOString().slice(0, 10), now = new Date().toISOString();
  try {
    const d = await gql(`query($a:String!,$b:String!,$s:Time!,$e:Time!){viewer{accounts(filter:{accountTag:$a}){r2OperationsAdaptiveGroups(limit:50,filter:{datetime_geq:$s,datetime_leq:$e,bucketName:$b}){sum{requests} dimensions{actionType}}}}}`,
      { a: ACCOUNT, b: BUCKET, s: since.toISOString(), e: now });
    report.r2_operations_in_window = Object.fromEntries(d.viewer.accounts[0].r2OperationsAdaptiveGroups.map((g) => [g.dimensions.actionType, g.sum.requests]));
  } catch (e) { report.r2_operations_in_window = `unavailable: ${e.message}`; }
  try {
    const zones = await (await fetch(`${CF}/zones?name=bricksofindia.com`, { headers: H })).json();
    const zone = zones.result?.[0]?.id;
    if (!zone) throw new Error(`zone lookup: ${JSON.stringify(zones.errors ?? []).slice(0, 200)}`);
    const d = await gql(`query($z:String!,$s:Time!,$e:Time!){viewer{zones(filter:{zoneTag:$z}){httpRequestsAdaptiveGroups(limit:25,orderBy:[count_DESC],filter:{datetime_geq:$s,datetime_leq:$e,clientRequestPath_like:"/sets/%"}){count dimensions{userAgent cacheStatus}}}}}`,
      { z: zone, s: since.toISOString(), e: now });
    report.sets_requests_top_ua_cache = d.viewer.zones[0].httpRequestsAdaptiveGroups.map((g) => ({ n: g.count, cache: g.dimensions.cacheStatus, ua: g.dimensions.userAgent.slice(0, 120) }));
  } catch (e) { report.sets_requests_top_ua_cache = `unavailable: ${e.message}`; }

  // ── FP1.4 R2 usage (P6 addendum item 7): storage vs 10 GB, Class A/B ops since the billing-cycle
  // start vs 1M/10M free, lifecycle rules, daily storage trend. Read-only; best effort per query.
  const CYCLE_START = process.env.R2_CYCLE_START ?? '2026-09-09T00:00:00Z';
  const CLASS_A = new Set(['ListBuckets', 'PutBucket', 'ListObjects', 'PutObject', 'CopyObject', 'CompleteMultipartUpload', 'CreateMultipartUpload', 'UploadPart', 'UploadPartCopy', 'ListMultipartUploads', 'ListParts', 'PutBucketEncryption', 'PutBucketCors', 'PutBucketLifecycleConfiguration', 'LifecycleStorageTierTransition']);
  const CLASS_B = new Set(['HeadBucket', 'HeadObject', 'GetObject', 'UsageSummary', 'GetBucketEncryption', 'GetBucketLocation', 'GetBucketCors', 'GetBucketLifecycleConfiguration']);
  try {
    const d = await gql(`query($a:String!,$s:Time!,$e:Time!){viewer{accounts(filter:{accountTag:$a}){r2OperationsAdaptiveGroups(limit:1000,filter:{datetime_geq:$s,datetime_leq:$e}){sum{requests} dimensions{actionType bucketName}}}}}`,
      { a: ACCOUNT, s: CYCLE_START, e: now });
    const g = d.viewer.accounts[0].r2OperationsAdaptiveGroups;
    const sum = (f) => g.filter(f).reduce((n, x) => n + x.sum.requests, 0);
    const days = (Date.now() - Date.parse(CYCLE_START)) / 864e5;
    const a = sum((x) => CLASS_A.has(x.dimensions.actionType)), b = sum((x) => CLASS_B.has(x.dimensions.actionType));
    report.r2_ops_since_cycle_start = { cycle_start: CYCLE_START, days: +days.toFixed(2), class_a: a, class_b: b,
      class_a_projected_30d: Math.round(a / days * 30), class_b_projected_30d: Math.round(b / days * 30),
      class_a_this_bucket: sum((x) => CLASS_A.has(x.dimensions.actionType) && x.dimensions.bucketName === BUCKET),
      by_bucket_action: Object.fromEntries(g.map((x) => [`${x.dimensions.bucketName}:${x.dimensions.actionType}`, x.sum.requests])) };
  } catch (e) { report.r2_ops_since_cycle_start = `unavailable: ${e.message}`; }
  try {
    const d = await gql(`query($a:String!,$b:String!,$s:Time!,$e:Time!){viewer{accounts(filter:{accountTag:$a}){r2StorageAdaptiveGroups(limit:100,orderBy:[date_ASC],filter:{datetime_geq:$s,datetime_leq:$e,bucketName:$b}){max{payloadSize metadataSize objectCount} dimensions{date}}}}}`,
      { a: ACCOUNT, b: BUCKET, s: new Date(Date.now() - 14 * 864e5).toISOString(), e: now });
    report.r2_storage_daily = d.viewer.accounts[0].r2StorageAdaptiveGroups.map((x) => ({ date: x.dimensions.date, gb: +((x.max.payloadSize + x.max.metadataSize) / 1e9).toFixed(2), objects: x.max.objectCount }));
  } catch (e) { report.r2_storage_daily = `unavailable: ${e.message}`; }
  try {
    const j = await (await fetch(`${CF}/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/lifecycle`, { headers: H })).json();
    report.r2_lifecycle = j.success ? j.result : `unavailable: ${JSON.stringify(j.errors).slice(0, 200)}`;
  } catch (e) { report.r2_lifecycle = `unavailable: ${e.message}`; }
  report.build_prefix_count = prefixes.length;

  fs.writeFileSync(`${OUT}/census.json`, JSON.stringify({ ...report, rendered_slugs: renderedSets.map((x) => x.slug).sort() }, null, 1));
  const lines = Object.entries(report).map(([k, v]) => `- ${k}: ${typeof v === 'object' ? '`' + JSON.stringify(v).slice(0, 1500) + '`' : v}`);
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Set render census (${HOURS}h, day ${day})\n${lines.join('\n')}\n`);
}

main().catch((e) => { console.error(`census FAILED: ${e.message}`); process.exit(1); });
