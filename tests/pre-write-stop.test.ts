/**
 * P14 Phase 4 (#450): the pre-write stop for lego.in. Fixtures are real:
 *  - legoin-feed-2026-09-30.json: the lego.in feed (873 products, 842 available).
 *  - legoin-runner-all-unavailable-page1.json: the runner's all-unavailable body
 *    (run 36755143181), the state the four bad runs wrote.
 * The 29 Sep payload itself was not retained; its logged shape (873 parsed,
 * 0 in stock, runs 36567076036 / 36636639478 / 36668696301 / 36712257724) is
 * rebuilt from the good feed with every variant unavailable -- the runner diff
 * shows the bad body differs from a good one only in `available` and
 * `updated_at` (run 36755143181 matrix).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { planStoreWrite, feedStats, checkPolicy, changedRatio, approvalFromEnv, loadBaselines } from '../scripts/lib/pre-write-stop.mjs';
import { parseProduct } from '../scripts/lib/retailer-fetch.mjs';

const good = JSON.parse(fs.readFileSync('tests/fixtures/legoin-feed-2026-09-30.json', 'utf8')).products;
const badPage1 = JSON.parse(fs.readFileSync('tests/fixtures/legoin-runner-all-unavailable-page1.json', 'utf8')).products;
const allUnavailable = good.map((p: any) => ({ ...p, variants: p.variants.map((v: any) => ({ ...v, available: false })) }));
const baseline = loadBaselines().mybrickhouse;

const known = new Set<string>(good.map((p: any) => String(p.variants[0].sku)));
const rowsOf = (products: any[]) => products
  .map((p) => parseProduct(p, 'mybrickhouse', 'lego.in', new Map(), known))
  .filter(Boolean)
  .map((r: any) => ({ set_id: r.setNumber, price_inr: r.priceInr, in_stock: r.inStock }));
const goodRows = rowsOf(good);
const POLICY_OK = { ok: true, results: [] };

describe('baseline file', () => {
  it('matches the evidence: 873 products, 842 available, full policy hashes', () => {
    expect(baseline.approved_products).toBe(873);
    expect(baseline.approved_available).toBe(842);
    expect(baseline.policy.map((p: any) => p.sha256)).toEqual([
      '561482b3f26e7088b0f4b48862ee2461ba2bf3ef580bf857aa85e238339e2628',
      '7689709f07a430d2b68b521c08c0e3dd5b632d419945de8d8ad566e3e4072ecd',
    ]);
    expect(feedStats(good).available_products).toBe(842);
  });
});

describe('policy check (direct fetch, sha256)', () => {
  const policy = [{ url: 'https://lego.in/robots.txt', sha256: createHash('sha256').update('ROBOTS').digest('hex') }];
  it('matching 200 body -> ok', async () => {
    const r = await checkPolicy(policy, async () => new Response('ROBOTS', { status: 200 }));
    expect(r.ok).toBe(true);
  });
  it('changed body -> not ok', async () => {
    const r = await checkPolicy(policy, async () => new Response('ROBOTS v2', { status: 200 }));
    expect(r.ok).toBe(false);
  });
  it('a redirect is not followed and fails', async () => {
    const r = await checkPolicy(policy, async () => new Response('', { status: 301, headers: { location: 'https://elsewhere/robots.txt' } }));
    expect(r.ok).toBe(false);
  });
  it('bad policy hash -> 0 writes, even with a valid approval', () => {
    const plan = planStoreWrite({ baseline, stats: feedStats(good), rows: goodRows, storedRows: goodRows, policy: { ok: false, results: [] }, approval: { store: 'lego.in', available: 842 } });
    expect(plan.write).toBe(false);
    expect(plan.reasons.join()).toMatch(/policy/);
  });
});

describe('the 29 Sep bad payload is held', () => {
  it('all 873 unavailable, stored rows already all false (the four bad runs) -> held on the share rule', () => {
    const rows = rowsOf(allUnavailable);
    const plan = planStoreWrite({ baseline, stats: feedStats(allUnavailable), rows, storedRows: rows, policy: POLICY_OK, approval: null });
    expect(plan.write).toBe(false);
    expect((plan.metrics as any).changed).toBe(0); // the old breaker's "changed 0.00%" blind spot
    expect(plan.reasons.join()).toMatch(/share/);
  });
  it('all unavailable against good stored rows -> held on share and change', () => {
    const plan = planStoreWrite({ baseline, stats: feedStats(allUnavailable), rows: rowsOf(allUnavailable), storedRows: goodRows, policy: POLICY_OK, approval: null });
    expect(plan.write).toBe(false);
    expect(plan.reasons.length).toBe(2);
  });
  it("the runner's real bad page 1 alone -> held (parsed < 90% and share)", () => {
    const plan = planStoreWrite({ baseline, stats: feedStats(badPage1), rows: rowsOf(badPage1), storedRows: goodRows, policy: POLICY_OK, approval: null });
    expect(plan.write).toBe(false);
    expect(plan.reasons.join()).toMatch(/90%/);
  });
});

describe('changes and approvals', () => {
  const bump = (n: number) => goodRows.map((r, i) => (i < n ? { ...r, price_inr: r.price_inr + 100 } : r));
  it('a good run against good stored rows writes', () => {
    expect(planStoreWrite({ baseline, stats: feedStats(good), rows: goodRows, storedRows: goodRows, policy: POLICY_OK, approval: null }).write).toBe(true);
  });
  it('> 25% of rows changing price without approval -> held', () => {
    const plan = planStoreWrite({ baseline, stats: feedStats(good), rows: bump(250), storedRows: goodRows, policy: POLICY_OK, approval: null });
    expect(changedRatio(bump(250), goodRows).ratio).toBeGreaterThan(0.25);
    expect(plan.write).toBe(false);
  });
  it('the first lego.in run over the false rows (842 flips) without approval -> held', () => {
    const storedFalse = goodRows.map((r) => ({ ...r, in_stock: false }));
    expect(planStoreWrite({ baseline, stats: feedStats(good), rows: goodRows, storedRows: storedFalse, policy: POLICY_OK, approval: null }).write).toBe(false);
  });
  it('approved and within 2% -> writes', () => {
    const storedFalse = goodRows.map((r) => ({ ...r, in_stock: false }));
    const plan = planStoreWrite({ baseline, stats: feedStats(good), rows: goodRows, storedRows: storedFalse, policy: POLICY_OK, approval: { store: 'lego.in', available: 850 } });
    expect(plan.write).toBe(true);
  });
  it('approved but outside 2% -> held', () => {
    const plan = planStoreWrite({ baseline, stats: feedStats(good), rows: goodRows, storedRows: goodRows, policy: POLICY_OK, approval: { store: 'lego.in', available: 900 } });
    expect(plan.write).toBe(false);
  });
  it('an approval for a different store key is ignored', () => {
    const plan = planStoreWrite({ baseline, stats: feedStats(allUnavailable), rows: rowsOf(allUnavailable), storedRows: goodRows, policy: POLICY_OK, approval: { store: 'toycra', available: 0 } });
    expect(plan.write).toBe(false);
  });
  it('approval inputs parse from the workflow env; empty means none', () => {
    expect(approvalFromEnv({ APPROVE_STORE: 'lego.in', APPROVE_AVAILABLE: '842' } as any)).toEqual({ store: 'lego.in', available: 842 });
    expect(approvalFromEnv({ APPROVE_STORE: '', APPROVE_AVAILABLE: '' } as any)).toBeNull();
  });
});

describe('Toycra writes in every case', () => {
  const bad = { products: 1, available_products: 0 } as any;
  it.each([
    ['bad policy', { ok: false, results: [] }, null],
    ['all unavailable', POLICY_OK, null],
    ['foreign approval', POLICY_OK, { store: 'lego.in', available: 1 }],
  ])('%s -> write (no baseline entry)', (_n, policy, approval) => {
    const plan = planStoreWrite({ baseline: loadBaselines().toycra, stats: bad, rows: [], storedRows: goodRows, policy, approval });
    expect(plan.write).toBe(true);
  });
});
