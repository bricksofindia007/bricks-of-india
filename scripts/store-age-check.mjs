// Daily store age check (order 0560, permanent fix 3b). Read-only. Runs on its own schedule,
// separate from the scrape. Exits 1 when any tracked store's newest price is older than the
// limit, so the workflow's existing failure mail (workflow-failure-notify.mjs) sends the alert.
// Reads the public price table with the public anon key, which the site already uses (no new key).
//
// Run: node scripts/store-age-check.mjs   (needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY)

export const STORES = ['mybrickhouse', 'toycra'];
export const MAX_AGE_HOURS = 36;

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

/** Pure. The REST path that returns the newest scraped time for one store. */
export function newestPath(baseUrl, store) {
  const u = new URL('/rest/v1/store_prices', baseUrl);
  u.searchParams.set('select', 'scraped_at');
  u.searchParams.set('store_id', `eq.${store}`);
  u.searchParams.set('order', 'scraped_at.desc');
  u.searchParams.set('limit', '1');
  return u.toString();
}

async function main() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/^﻿/, '').trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').replace(/^﻿/, '').trim();
  if (!url || !key) {
    console.error('::error::NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set');
    process.exit(1);
  }
  const newest = {};
  for (const store of STORES) {
    const res = await fetch(newestPath(url, store), { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) {
      console.error(`::error::${store}: read failed with HTTP ${res.status}`);
      process.exit(1);
    }
    const rows = await res.json();
    newest[store] = rows[0]?.scraped_at ?? null;
    console.log(`[store-age] ${store}: newest ${newest[store] ?? 'none'}`);
  }
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
