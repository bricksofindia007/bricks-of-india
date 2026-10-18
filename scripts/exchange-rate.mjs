// Daily USD to INR rate job (decision of 18 Oct 2026). Fetches the ECB reference rate from Frankfurter and keeps
// exactly one stored row with its value date and source. Band 70 to 110; a value more than 5% from the stored
// value is rejected; a stored value older than 5 days is not used. No fixed fallback.
// A failed fetch keeps the stored row, writes the attempt time, and exits 1 (the failure email is the alert).
// Heartbeat: every run that finds a stored row writes last_attempt_at.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (CI secrets). Writes only usd_inr_rate, row id 1.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveRate, parseFrankfurter } = require('./lib/usd-rate.cjs');

const FX_URL = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR';
const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !KEY) {
  console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
  process.exit(2);
}
const headers = { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };

async function readStored() {
  const r = await fetch(`${SB}/rest/v1/usd_inr_rate?id=eq.1&select=rate,value_date`, { headers });
  if (!r.ok) throw new Error(`stored read failed: HTTP ${r.status}`);
  const rows = await r.json();
  return rows[0] ? { rate: Number(rows[0].rate), date: rows[0].value_date } : null;
}

async function fetchFrankfurter() {
  try {
    const r = await fetch(FX_URL);
    if (r.status !== 200) return null;
    return parseFrankfurter(await r.json());
  } catch {
    return null;
  }
}

async function writeRow(row) {
  const r = await fetch(`${SB}/rest/v1/usd_inr_rate?on_conflict=id`, {
    method: 'POST',
    headers: { ...headers, prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: 1, ...row }),
  });
  if (!r.ok) throw new Error(`row write failed: HTTP ${r.status}`);
}

async function heartbeat(now) {
  const r = await fetch(`${SB}/rest/v1/usd_inr_rate?id=eq.1`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ last_attempt_at: now }),
  });
  if (!r.ok) throw new Error(`heartbeat write failed: HTTP ${r.status}`);
}

const now = new Date().toISOString();
const today = now.slice(0, 10);
const stored = await readStored();
const fetched = await fetchFrankfurter();
const res = resolveRate({ fetched: fetched ? fetched.rate : null, stored, today });

if (res.storeNew) {
  await writeRow({ rate: fetched.rate, value_date: fetched.date, source: 'frankfurter-ecb', fetched_at: now, last_attempt_at: now });
} else if (stored) {
  await heartbeat(now);
}

console.log(`exchange rate: ${res.source}${res.rate ? ` ${res.rate}` : ''}; stored value date ${stored ? stored.date : 'none'}`);
if (res.alert) {
  console.error(`ALERT: ${res.alert}`);
  process.exitCode = 1;
}
