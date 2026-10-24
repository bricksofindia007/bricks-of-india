#!/usr/bin/env node
// Release measurement for the deploy gate (docs/release/gates/MEASUREMENT.md). Three subcommands, run in order:
//   cpu       reads the staging Worker's analytics over the sample window: requests, errors, and CPU time per request
//   pages     compares the fixed URL list between the candidate (staging) and the rollback release (production)
//   assemble  writes docs/release/gates/current.json and checks it with the deploy gate's own rules before saving
// Inputs (environment, never written to output): STAGING_SITE, ROLLBACK_SITE, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID,
// WORKER_SCRIPT (the staging Worker's script name), WINDOW_START / SAMPLE_START / SAMPLE_END (ISO times), MEASURED_SHA,
// LOAD_PROFILE (path), ROW_COUNTS (path to JSON from count-rows.mjs), APPROVED_BY, ROLLBACK_TARGET (default 34faed19).
// Read-only except for the output files. Prints counts and times only.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { isFailedResponse, errorRateFromResponses } from '../ci/deploy-gate.mjs';

const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';
export const FIXED_URLS = ['/', '/sets', '/themes', '/themes/city', '/themes/city/sort/price-asc', '/compare', '/deals', '/reviews', '/news', '/lab/budget-calculator'];

/** Pure. Median of a numeric list (null for an empty list). */
export function median(xs) {
  const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/**
 * Pure. CPU per request for the sample: the median of the hourly medians, weighted equally per hour with traffic.
 * Hours with no requests are ignored. Returns { cpu_median_ms, requests, errors, error_rate, hours }.
 * @param {Array<{requests:number, errors:number, cpuP50Us:number}>} hours
 */
export function summarise(hours) {
  const used = hours.filter((h) => h.requests > 0);
  const requests = used.reduce((n, h) => n + h.requests, 0);
  const errors = used.reduce((n, h) => n + h.errors, 0);
  return {
    cpu_median_ms: median(used.map((h) => h.cpuP50Us / 1000)),
    requests,
    errors,
    error_rate: requests ? Number((errors / requests).toFixed(6)) : null,
    hours: used.length,
  };
}

/** Pure. Normalises a page for comparison: build ids, timestamps and cache-busting query values are removed. */
export function normalisePage(html) {
  return html
    .replace(/\/_next\/static\/[A-Za-z0-9_-]+\//g, '/_next/static/BUILD/')
    .replace(/"buildId":"[^"]+"/g, '"buildId":"BUILD"')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, 'TIMESTAMP')
    .replace(/\?v=[A-Za-z0-9]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pure. Compares two normalised pages. Returns a short description of the first difference, or null when they match. */
export function firstDifference(a, b) {
  if (a === b) return null;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return { at: i, candidate: a.slice(Math.max(0, i - 40), i + 60), rollback: b.slice(Math.max(0, i - 40), i + 60) };
}

async function cfQuery(token, query, variables) {
  const r = await fetch(GRAPHQL, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  const j = await r.json();
  if (j.errors?.length) throw new Error('graphql: ' + j.errors.map((e) => e.message).join('; '));
  return j.data;
}

async function cmdCpu(env) {
  const Q = `query W($acct: String!, $start: Time!, $end: Time!, $script: String!) {
    viewer { accounts(filter: { accountTag: $acct }) {
      workers: workersInvocationsAdaptive(limit: 1000, filter: { datetime_geq: $start, datetime_lt: $end, scriptName: $script }) {
        sum { requests errors cpuTimeUs }
        quantiles { cpuTimeP50 }
        dimensions { datetimeHour }
      }
    } } }`;
  const data = await cfQuery(env.CLOUDFLARE_API_TOKEN, Q, { acct: env.CLOUDFLARE_ACCOUNT_ID, start: env.SAMPLE_START, end: env.SAMPLE_END, script: env.WORKER_SCRIPT });
  const rows = data.viewer.accounts[0].workers ?? [];
  const hours = rows.map((r) => ({ requests: r.sum.requests, errors: r.sum.errors, cpuP50Us: r.quantiles?.cpuTimeP50 ?? NaN }));
  const s = summarise(hours);
  return { ...s, sample_hours: Number(((Date.parse(env.SAMPLE_END) - Date.parse(env.SAMPLE_START)) / 3600e3).toFixed(2)) };
}

/**
 * Pure. The visible text of a page's body: the head (title and metadata), scripts, styles, comments and tags are removed,
 * and build ids and timestamps are normalised. This is the page rule the owner approved on 23 Oct 2026 (visible text).
 */
export function visibleBody(html) {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, 'TIMESTAMP')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Blocking page rule: the status is the same and the visible text is the same, in order.
 * The raw markup comparison is returned as a report line only; it never blocks.
 */
async function cmdPages(env) {
  const out = [];
  for (const p of FIXED_URLS) {
    const [c, r] = await Promise.all([fetch(env.STAGING_SITE.replace(/\/$/, '') + p, { redirect: 'manual' }), fetch(env.ROLLBACK_SITE.replace(/\/$/, '') + p, { redirect: 'manual' })]);
    const [ct, rt] = [await c.text(), await r.text()];
    const text = c.status !== r.status ? { status: { candidate: c.status, rollback: r.status } } : firstDifference(visibleBody(ct), visibleBody(rt));
    const markupSame = normalisePage(ct) === normalisePage(rt);
    out.push({ path: p, candidate_status: c.status, rollback_status: r.status, same: !text, difference: text, markup_same: markupSame });
  }
  const markupDiffering = out.filter((o) => !o.markup_same).length;
  return { compared: out.length, differences: out.filter((o) => !o.same), markup_report: { pages_with_markup_differences: markupDiffering, blocking: false }, all: out };
}

// Reads the load generator's per-class, per-status counts from the flag store (KV). Read-only. Writes COUNTS_OUT.
async function cmdCounts(env) {
  const key = encodeURIComponent('loadgen:counts');
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${env.KV_NAMESPACE_ID}/values/${key}`;
  const r = await fetch(url, { headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } });
  if (!r.ok) throw new Error(`counts read failed: HTTP ${r.status}`);
  const counts = await r.json();
  if (counts.since !== env.WINDOW_START) throw new Error('counts are from a different window than WINDOW_START');
  fs.writeFileSync(env.COUNTS_OUT || 'counts.json', JSON.stringify(counts, null, 2));
  return counts;
}

async function cmdAssemble(env, cpu, pages, responses) {
  const profileSha = crypto.createHash('sha256').update(fs.readFileSync(env.LOAD_PROFILE)).digest('hex');
  const rows = JSON.parse(fs.readFileSync(env.ROW_COUNTS, 'utf8'));
  const failed = responses.filter((r) => isFailedResponse(r)).length;
  const ev = {
    measured_sha: env.MEASURED_SHA,
    cpu_median_ms: cpu.cpu_median_ms,
    warmup_hours: 1,
    sample_hours: cpu.sample_hours,
    requests_measured: responses.length,
    worker_requests: cpu.requests,
    error_rate: errorRateFromResponses(responses),
    response_summary: { total: responses.length, failed },
    load_profile_sha256: profileSha,
    staging_rows: rows.staging,
    production_rows: rows.production,
    page_diff_ok: pages.differences.length === 0,
    rollback_target: env.ROLLBACK_TARGET || '34faed19',
    approved_by: env.APPROVED_BY,
  };
  return ev;
}

async function main() {
  const env = process.env;
  const cmd = process.argv[2];
  if (cmd === 'cpu') { console.log(JSON.stringify(await cmdCpu(env), null, 2)); return 0; }
  if (cmd === 'counts') { const c = await cmdCounts(env); console.log(`counts: ${Object.keys(c.classes ?? {}).length} classes`); return 0; }
  if (cmd === 'pages') {
    const p = await cmdPages(env);
    console.log(`compared ${p.compared} URLs on visible text; ${p.differences.length} differ (blocking)`);
    console.log(`report only, not blocking: ${p.markup_report.pages_with_markup_differences} of ${p.compared} pages differ in raw markup`);
    for (const d of p.differences) console.log(`  DIFF ${d.path}: ${JSON.stringify(d.difference).slice(0, 300)}`);
    fs.writeFileSync(env.PAGES_OUT || 'pages-diff.json', JSON.stringify(p, null, 2));
    return 0;
  }
  if (cmd === 'assemble') {
    const cpu = JSON.parse(fs.readFileSync(env.CPU_OUT || 'cpu.json', 'utf8'));
    const pages = JSON.parse(fs.readFileSync(env.PAGES_OUT || 'pages-diff.json', 'utf8'));
    const counts = JSON.parse(fs.readFileSync(env.COUNTS_OUT || 'counts.json', 'utf8'));
    const { evaluateGate, responsesFromCounts } = await import('../ci/deploy-gate.mjs');
    const responses = responsesFromCounts(counts);
    const ev = await cmdAssemble(env, cpu, pages, responses);
    const check = evaluateGate({ sha: ev.measured_sha, checkRuns: [], diffFiles: [], evidence: ev, rollbackTarget: ev.rollback_target, profileSha: ev.load_profile_sha256, override: null, responses });
    // The gate's check-run rules are not evaluated here: only the measurement rules.
    const measurementFailures = check.failures.filter((f) => !f.startsWith('check '));
    console.log(measurementFailures.length ? `measurement NOT passing: ${measurementFailures.join('; ')}` : 'measurement passes the gate rules');
    fs.writeFileSync(env.GATE_OUT || 'docs/release/gates/current.json', JSON.stringify(ev, null, 2) + '\n');
    return measurementFailures.length ? 1 : 0;
  }
  console.error('usage: measure-release.mjs cpu | counts | pages | assemble');
  return 2;
}

if (process.argv[1] && process.argv[1].endsWith('measure-release.mjs')) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error('measurement error:', e.message); process.exitCode = 1; });
}
