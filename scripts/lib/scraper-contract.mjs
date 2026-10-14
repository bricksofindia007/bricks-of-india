// FP5.2 scraper contract (P4 Step 4a, 27 Sep 2026). Every retailer scraper
// uses this module:
//   - identity:  BricksOfIndiaBot user agent (contact bot@bricksofindia.com)
//   - pacing:    >= PACE_MS between requests to one retailer
//   - policy:    robots.txt + agents.md hashed each run and compared with the
//                hashes on the stores row (scraper_config.robots_sha256 /
//                agents_sha256). Any change -> ABORT, write nothing, alert.
//   - parsing:   numeric INR > 0 (paise kept exactly, D27), stock parsed
//                explicitly (true/false; unknown -> the listing is invalid)
//   - summary:   one run summary object (counts + reasons) for the job log,
//                the FP5.6 match audit and the FP5.3 circuit breaker.
// Pure helpers are exported for tests; network helpers take an injectable fetch.

import { createHash } from 'node:crypto';

export const BOT_UA = 'BricksOfIndiaBot/1.0 (+https://bricksofindia.com/bot; bot@bricksofindia.com)';
export const PACE_MS = 3000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Paced fetcher bound to one retailer: never two requests within PACE_MS. */
export function pacedFetcher(fetchImpl = fetch, paceMs = PACE_MS) {
  let last = 0;
  return async (url, init = {}) => {
    const wait = last + paceMs - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    return fetchImpl(url, { ...init, headers: { 'User-Agent': BOT_UA, ...(init.headers ?? {}) } });
  };
}

export const sha256 = (s) => createHash('sha256').update(String(s ?? '')).digest('hex');

/**
 * Policy check. `expected` = { robots_sha256, agents_sha256 } from the stores row
 * (null agents hash = "no agents.md expected"). Returns { ok, changed[], hashes }.
 * On ok=false the caller aborts the run BEFORE any write and alerts.
 */
export async function checkPolicy(domain, expected, get) {
  const hashes = {};
  const changed = [];
  for (const [key, path] of [['robots_sha256', '/robots.txt'], ['agents_sha256', '/agents.md']]) {
    let body = null;
    try {
      const r = await get(`https://${domain}${path}`);
      body = r.ok ? await r.text() : null;
    } catch { body = null; }
    hashes[key] = body == null ? null : sha256(body);
    if ((expected?.[key] ?? null) !== hashes[key]) changed.push(key);
  }
  return { ok: changed.length === 0, changed, hashes };
}

/** Exact INR from a displayed price string; null unless finite and > 0. Keeps paise (D27). */
export function parseInrExact(raw) {
  if (raw == null) return null;
  const s = String(raw).replace(/[₹,\s]|Rs\.?|INR/gi, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** FirstCry listing tile: the public selling price only -- never the separate Club price. */
export function firstCryPublicPrice(tileHtml) {
  const withoutClub = String(tileHtml ?? '').replace(/<div class="club-block">[\s\S]*?<\/div>/gi, '');
  const m = withoutClub.match(/class="rupee fw lft"[^>]*>\s*([\d,]+(?:\.\d{1,2})?)\s*</i);
  return m ? parseInrExact(m[1]) : null;
}

/**
 * Parse validation for one normalised listing:
 *   { setNumber?, priceInr, inStock, url }  -> [] when valid, else reasons.
 */
export function validateListing(l) {
  const errs = [];
  if (!(typeof l.priceInr === 'number' && Number.isFinite(l.priceInr) && l.priceInr > 0)) errs.push('price_not_positive_number');
  if (typeof l.inStock !== 'boolean') errs.push('stock_not_explicit');
  if (!l.url || !/^https:\/\//.test(l.url)) errs.push('url_missing');
  return errs;
}

/** Run summary shared by the breaker, the match audit and the job log. */
export function newRunSummary(storeId) {
  return {
    store: storeId, started_at: new Date().toISOString(),
    fetched: 0, parsed: 0, invalid: 0, matched: 0, unmatched: 0,
    by_method: { sku: 0, text: 0, name: 0 }, unmatched_reasons: {}, invalid_reasons: {},
    policy: null, breaker: null, wrote: false,
  };
}
export function tally(summary, bucket, key) {
  summary[bucket][key] = (summary[bucket][key] ?? 0) + 1;
}
