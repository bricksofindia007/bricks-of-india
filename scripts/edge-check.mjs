#!/usr/bin/env node
// Read-only page check for the edge cache (order 0570). Used for the staging proof and the cutover check.
// It only sends GET requests. Each cacheable path is requested twice: the first answer may be a miss, the second must be a hit.
// Admin and API paths, and a request with a signed-in cookie, must always show bypass. No production key is used or needed.
//
// Usage:  node scripts/edge-check.mjs <https://host> [path ...] [--timeout-ms 15000]
// Exit code 0 when every expectation holds, 1 when one fails, 2 on bad arguments.

import { pathToFileURL } from 'node:url';

export const DEFAULT_PAGES = ['/', '/sets', '/news', '/reviews', '/deals', '/sitemap.xml'];
export const BYPASS_PATHS = ['/admin/pending', '/api/saved-sets?ids=99001'];
/** The signed-in cookie name (src/lib/account-session.ts). The value is a test value, not a session. */
export const SIGNED_IN_COOKIE = 'boi_account=edge-check-test';
export const DEBUG_HEADER = 'x-boi-edge-cache';

/** Parses the command line. Throws on a missing or non-https/http host. */
export function parseArgs(argv) {
  const args = [...argv];
  let timeoutMs = 15000;
  const i = args.indexOf('--timeout-ms');
  if (i !== -1) {
    timeoutMs = Number(args[i + 1]);
    args.splice(i, 2);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('--timeout-ms must be a positive number');
  }
  const host = args.shift();
  if (!host) throw new Error('usage: node scripts/edge-check.mjs <https://host> [path ...]');
  let url;
  try { url = new URL(host); } catch { throw new Error(`not a URL: ${host}`); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('host must start with https:// or http://');
  const paths = args.length ? args : DEFAULT_PAGES;
  for (const p of paths) if (!p.startsWith('/')) throw new Error(`path must start with /: ${p}`);
  return { origin: url.origin, paths, timeoutMs };
}

/** What each check must show: 'cacheable' means the second answer is a hit; 'bypass' means every answer is bypass. */
export function expectationsFor(paths) {
  return [
    ...paths.map((path) => ({ path, kind: 'cacheable', cookie: null })),
    ...BYPASS_PATHS.map((path) => ({ path, kind: 'bypass', cookie: null })),
    { path: paths[0] ?? '/', kind: 'bypass', cookie: SIGNED_IN_COOKIE },
  ];
}

/** Checks the answers. rows: [{ path, cookie, attempt, debug, cacheControl, status, ttfbMs }] in request order. */
export function evaluate(expectations, rows) {
  const failures = [];
  for (const e of expectations) {
    const mine = rows.filter((r) => r.path === e.path && (r.cookie ?? null) === e.cookie);
    if (mine.length === 0) { failures.push(`${e.path}: no answer`); continue; }
    if (e.kind === 'bypass') {
      for (const r of mine) if (r.debug !== 'bypass') failures.push(`${e.path}${e.cookie ? ' (signed-in cookie)' : ''}: expected bypass, got ${r.debug ?? 'none'}`);
      continue;
    }
    const first = mine.find((r) => r.attempt === 1);
    const second = mine.find((r) => r.attempt === 2);
    if (!first || !second) { failures.push(`${e.path}: missing answer`); continue; }
    if (first.debug !== 'miss' && first.debug !== 'hit') failures.push(`${e.path}: first answer expected miss or hit, got ${first.debug ?? 'none'}`);
    if (second.debug !== 'hit') failures.push(`${e.path}: second answer expected hit, got ${second.debug ?? 'none'}`);
    if (first.status !== 200) failures.push(`${e.path}: status ${first.status}`);
  }
  return { ok: failures.length === 0, failures };
}

/** One line per answer, for the evidence file. */
export function formatRow(r) {
  const cookie = r.cookie ? ' cookie' : '';
  return `${r.path}${cookie} #${r.attempt} status=${r.status} ${DEBUG_HEADER}=${r.debug ?? '-'} cache-control="${r.cacheControl ?? '-'}" ttfb=${r.ttfbMs}ms`;
}

async function timedGet(origin, path, cookie, timeoutMs) {
  const headers = { accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' };
  if (cookie) headers.cookie = cookie;
  const started = Date.now();
  const res = await fetch(origin + path, { method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
  const ttfbMs = Date.now() - started;
  await res.arrayBuffer();
  return { status: res.status, debug: res.headers.get(DEBUG_HEADER), cacheControl: res.headers.get('cache-control'), ttfbMs };
}

export async function run(args) {
  const rows = [];
  for (const e of expectationsFor(args.paths)) {
    for (const attempt of [1, 2]) {
      const answer = await timedGet(args.origin, e.path, e.cookie, args.timeoutMs);
      rows.push({ path: e.path, cookie: e.cookie, attempt, ...answer });
    }
  }
  return rows;
}

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (err) { console.error(err.message); process.exit(2); }
  const rows = await run(args);
  for (const r of rows) console.log(formatRow(r));
  const result = evaluate(expectationsFor(args.paths), rows);
  if (result.ok) console.log('RESULT: all expectations hold');
  else { for (const f of result.failures) console.log(`FAIL: ${f}`); console.log('RESULT: failed'); }
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
