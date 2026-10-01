/**
 * Pre-write stop for a guarded store (#450, P14 Phase 4). Pure decisions plus
 * one policy fetch; the caller (scrape-now.mjs) writes only when
 * planStoreWrite() says so. Runs BEFORE any write for that store.
 *
 * Holds the store's writes (and alerts) when:
 *   - robots.txt / agents.md fetched directly don't match the approved sha256
 *     (or answer anything but HTTP 200 without a redirect). Not overridable:
 *     a new fingerprint needs a reviewed baseline change.
 *   - parsed products < 90% of the approved baseline. Not overridable.
 *   - without approval: the available share moves > 25 points from the last
 *     APPROVED run (store-baselines.json, never the stored rows, which can be
 *     wrong -- the rule that holds an all-unavailable payload), OR > 25% of
 *     the rows compared with store_prices change price or stock.
 * Approval (workflow_dispatch inputs approve_store + approve_available) lets
 * that one run write only if its own available count is within +-2% of the
 * approved count. Nothing persists: the next run is judged afresh.
 *
 * Failure behaviour (G14): a hold writes nothing for that store, so its last
 * rows age past 12h and stop badging -- older-but-labelled, never wrong.
 * A store without a baseline entry is never held (both stores have one since B2, 1 Oct 2026).
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULES = { minParsedRatio: 0.9, maxShareMovePts: 25, maxChangedRatio: 0.25, approvalTolerance: 0.02 };
const BOT_UA = 'BricksOfIndiaBot/1.0 (+https://bricksofindia.com/bot; bot@bricksofindia.com)';
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

export function loadBaselines(file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'store-baselines.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Fetch each policy file directly (no redirect followed) and compare its sha256. File text is data only. */
export async function checkPolicy(policy, fetchImpl = fetch) {
  const results = [];
  for (const p of policy ?? []) {
    try {
      const res = await fetchImpl(p.url, { headers: { 'User-Agent': BOT_UA }, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
      const body = await res.text();
      const got = sha256(body);
      results.push({ url: p.url, status: res.status, sha256: got, expected: p.sha256, match: res.status === 200 && got === p.sha256 });
    } catch (e) {
      results.push({ url: p.url, status: null, error: String(e.message ?? e), expected: p.sha256, match: false });
    }
  }
  return { ok: results.length > 0 && results.every((r) => r.match), results };
}

const tagList = (p) => (Array.isArray(p.tags) ? p.tags : String(p.tags ?? '').split(',')).map((t) => t.trim()).filter(Boolean);

/** Per-run feed facts (P14 4.4). `tags` is for the artifact only. */
export function feedStats(products) {
  const s = { products: products.length, variants: 0, available_products: 0, available_variants: 0, unavailable_variants: 0,
    compare_at: { present: 0, null: 0, equal: 0, greater: 0, less: 0 }, sale_tagged_products: 0, tags: {} };
  for (const p of products) {
    let any = false;
    for (const v of p.variants ?? []) {
      s.variants++;
      if (v.available === true) { s.available_variants++; any = true; } else s.unavailable_variants++;
      if (v.compare_at_price == null) s.compare_at.null++;
      else {
        s.compare_at.present++;
        const c = parseFloat(v.compare_at_price), pr = parseFloat(v.price);
        if (c === pr) s.compare_at.equal++; else if (c > pr) s.compare_at.greater++; else s.compare_at.less++;
      }
    }
    if (any) s.available_products++;
    const tags = tagList(p);
    if (tags.some((t) => /sale/i.test(t))) s.sale_tagged_products++;
    for (const t of tags) s.tags[t] = (s.tags[t] ?? 0) + 1;
  }
  return s;
}

/** Share of compared rows whose price or stock differ from store_prices. New rows aren't compared. */
export function changedRatio(rows, storedRows) {
  const stored = new Map(storedRows.map((r) => [r.set_id, r]));
  let compared = 0, changed = 0;
  for (const r of rows) {
    const s = stored.get(r.set_id);
    if (!s) continue;
    compared++;
    if (Number(s.price_inr) !== Number(r.price_inr) || Boolean(s.in_stock) !== Boolean(r.in_stock)) changed++;
  }
  return { compared, changed, ratio: compared ? changed / compared : 0 };
}

/**
 * @returns {{ write: boolean, held: boolean, reasons: string[], metrics: object }}
 */
export function planStoreWrite({ baseline, stats, rows, storedRows, policy, approval }) {
  if (!baseline) return { write: true, held: false, reasons: [], metrics: {} }; // unguarded store (none today)
  const reasons = [];
  const share = stats.products ? stats.available_products / stats.products : 0;
  const baseShare = baseline.approved_available / baseline.approved_products;
  const ch = changedRatio(rows, storedRows);
  const metrics = {
    parsed: stats.products, approved_products: baseline.approved_products,
    available: stats.available_products, approved_available: baseline.approved_available,
    share_pts: +(share * 100).toFixed(2), approved_share_pts: +(baseShare * 100).toFixed(2),
    changed: ch.changed, compared: ch.compared, changed_pct: +(ch.ratio * 100).toFixed(2),
    policy_ok: policy?.ok ?? false,
  };

  if (!policy?.ok) reasons.push(`policy: robots/agents hash or status differs from the approved fingerprint (${(policy?.results ?? []).filter((r) => !r.match).map((r) => `${r.url} status=${r.status} sha256=${(r.sha256 ?? r.error ?? '').slice(0, 12)}`).join('; ')})`);
  if (stats.products < RULES.minParsedRatio * baseline.approved_products) reasons.push(`parsed ${stats.products} < 90% of approved ${baseline.approved_products}`);

  const approved = approval && approval.store === baseline.approve_key && Number.isFinite(approval.available) && approval.available > 0;
  if (approved) {
    const tol = Math.abs(stats.available_products - approval.available) <= RULES.approvalTolerance * approval.available;
    metrics.approval = { store: approval.store, available: approval.available, within_2pct: tol };
    if (!tol) reasons.push(`approval: this run's available ${stats.available_products} is not within 2% of approved ${approval.available}`);
  } else {
    if (Math.abs(share - baseShare) * 100 > RULES.maxShareMovePts) reasons.push(`available share ${metrics.share_pts}% moved > 25 points from the last approved ${metrics.approved_share_pts}%`);
    if (ch.ratio > RULES.maxChangedRatio) reasons.push(`${ch.changed}/${ch.compared} rows (${metrics.changed_pct}%) change price or stock (> 25%)`);
  }
  return { write: reasons.length === 0, held: reasons.length > 0, reasons, metrics };
}

/** Workflow inputs -> approval object, or null. */
export function approvalFromEnv(env = process.env) {
  const store = (env.APPROVE_STORE ?? '').trim();
  const available = Number((env.APPROVE_AVAILABLE ?? '').trim());
  return store && Number.isFinite(available) && available > 0 ? { store, available } : null;
}
