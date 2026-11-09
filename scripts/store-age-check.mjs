// Daily store age check (order 0560, permanent fix 3b). Read-only. Runs on its own schedule,
// separate from the scrape. Exits 1 when any tracked store's newest price is older than the
// limit, so the workflow's existing failure mail (workflow-failure-notify.mjs) sends the alert.
// Reads the newest scraped time per store through the read-only database role that the staging seed already uses
// (CI_READONLY_DB_URL). The public anon key cannot read the price table by design (order 1440 item 1), so it is not used.
//
// Run: CI_READONLY_DB_URL=<read-only role connection string> node scripts/store-age-check.mjs

import { spawnSync } from 'node:child_process';

export const STORES = ['mybrickhouse', 'toycra'];
export const MAX_AGE_HOURS = 36;
const STATEMENT_TIMEOUT = '10s';
const CLIENT_TIMEOUT_MS = 60_000;

/**
 * Pure. newestByStore: { [store]: ISO time of the newest scraped row, or null when there are none }.
 * Returns the problems, one plain line per stale store. A store with no rows at all is a problem too.
 */
export function staleStores(newestByStore, nowMs, maxHours = MAX_AGE_HOURS, stores = STORES) {
  const problems = [];
  for (const store of stores) {
    const at = newestByStore[store];
    if (!at) {
      problems.push(`${store}: no prices at all`);
      continue;
    }
    const ageH = (nowMs - new Date(at).getTime()) / 3_600_000;
    if (!Number.isFinite(ageH)) {
      problems.push(`${store}: newest price time could not be read`);
    } else if (ageH > maxHours) {
      problems.push(`${store}: newest price is ${ageH.toFixed(1)} hours old (limit ${maxHours} hours)`);
    }
  }
  return problems;
}

/**
 * Pure. The read-only statement: one row per store with the newest scraped time (empty when the store has no rows).
 * Store names come from the fixed list above and are checked, so nothing from outside is put into the query.
 */
export function newestQuery(stores = STORES) {
  for (const s of stores) {
    if (!/^[a-z0-9_-]+$/.test(s)) throw new Error(`store name not allowed: ${s}`);
  }
  const list = stores.map((s) => `'${s}'`).join(', ');
  return `begin read only; set local statement_timeout = '${STATEMENT_TIMEOUT}'; `
    + `select store_id || '|' || coalesce(max(scraped_at)::text, '') from public.store_prices `
    + `where store_id in (${list}) group by store_id; commit;`;
}

/** Pure. Reads the "store|time" lines from the query output; other command output (BEGIN, SET, COMMIT) is ignored. */
export function parseNewest(text, stores = STORES) {
  const out = Object.fromEntries(stores.map((s) => [s, null]));
  for (const line of String(text).split('\n')) {
    const m = line.trim().match(/^([a-z0-9_-]+)\|(.*)$/);
    if (!m || !stores.includes(m[1])) continue;
    out[m[1]] = m[2].trim() || null;
  }
  return out;
}

/**
 * Pure. One plain line for a failed read: the first line of the database client's error, with the connection string
 * and any other connection-string-looking text removed. Order 1440 item 1: the clearer message stays, the secret does not appear.
 */
export function describeReadError(text, connectionString = '') {
  let line = String(text ?? '').split('\n').map((l) => l.trim()).find((l) => l) ?? 'no detail from the database client';
  if (connectionString) line = line.split(connectionString).join('[connection string]');
  line = line.replace(/postgres(?:ql)?:\/\/\S+/gi, '[connection string]');
  return `read failed: ${line.slice(0, 200)}`;
}

async function main() {
  const url = (process.env.CI_READONLY_DB_URL ?? '').replace(/^﻿/, '').trim();
  if (!url) {
    console.error('::error::CI_READONLY_DB_URL not set');
    process.exit(1);
  }
  const res = spawnSync('psql', [url, '-X', '-A', '-t', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-c', newestQuery()], {
    encoding: 'utf8',
    timeout: CLIENT_TIMEOUT_MS,
  });
  if (res.error || res.status !== 0) {
    console.error(`::error::${describeReadError(res.stderr || res.stdout || res.error?.message, url)}`);
    process.exit(1);
  }
  const newest = parseNewest(res.stdout);
  for (const store of STORES) console.log(`[store-age] ${store}: newest ${newest[store] ?? 'none'}`);
  const problems = staleStores(newest, Date.now());
  if (problems.length) {
    for (const p of problems) console.error(`::error::${p}`);
    process.exit(1);
  }
  console.log(`[store-age] OK: every store has a price newer than ${MAX_AGE_HOURS} hours`);
}

if (process.argv[1] && /store-age-check\.mjs$/.test(process.argv[1])) {
  main().catch((e) => { console.error('::error::store age check failed to run:', e.message ?? e); process.exit(1); });
}
