#!/usr/bin/env node
// Row counts for the staging representativeness check (MEASUREMENT.md): sets, store_prices and price_history on the
// staging project and on production. Read-only: HEAD requests with an exact count. Prints counts only, never keys or URLs.
// Env: STAGING_SUPABASE_URL, STAGING_SUPABASE_SERVICE_ROLE_KEY (or the publishable key if that is what staging uses),
//      PRODUCTION_SUPABASE_URL, PRODUCTION_SUPABASE_SERVICE_ROLE_KEY, OUT (default row-counts.json).
import fs from 'node:fs';

export const TABLES = ['sets', 'store_prices', 'price_history'];

/** Pure. The exact row count from a Content-Range header such as "0-0/7203" or "*\/0". Null when absent. */
export function countFromContentRange(h) {
  const m = /\/(\d+)$/.exec(h ?? '');
  return m ? Number(m[1]) : null;
}

async function count(url, key, table) {
  const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${table}?select=*`, {
    method: 'HEAD',
    headers: { apikey: key, authorization: `Bearer ${key}`, prefer: 'count=exact', range: '0-0' },
  });
  if (!r.ok && r.status !== 206) throw new Error(`${table}: HTTP ${r.status}`);
  return countFromContentRange(r.headers.get('content-range'));
}

async function main() {
  const env = process.env;
  const out = { staging: {}, production: {} };
  for (const t of TABLES) {
    out.staging[t] = await count(env.STAGING_SUPABASE_URL, env.STAGING_SUPABASE_SERVICE_ROLE_KEY, t);
    out.production[t] = await count(env.PRODUCTION_SUPABASE_URL, env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY, t);
    console.log(`${t}: staging ${out.staging[t]}, production ${out.production[t]}`);
  }
  fs.writeFileSync(env.OUT || 'row-counts.json', JSON.stringify(out, null, 2) + '\n');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('count-rows.mjs')) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error('count error:', e.message); process.exitCode = 1; });
}
