// The last-seen route: flag off = 404; cross-site = 403; over 150 set ids = 400 (no read); output is only set number,
// price and date; cache headers; a failed or unconfigured read = 503. The page-level test runs the estimate path the page uses.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

const flags = vi.hoisted(() => ({ myCollectionPage: true }));
vi.mock('../src/lib/feature-flags', () => ({ FEATURE_FLAGS: flags }));

const cfg = vi.hoisted(() => ({ key: 'reader-key' as string | null, rpcCalls: [] as unknown[], rpcResult: { data: [] as unknown[] | null, error: null as null | { message: string } } }));
vi.mock('../src/lib/get-secret', () => ({ getSecret: () => cfg.key }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: async (name: string, args: unknown) => {
      cfg.rpcCalls.push({ name, args });
      return cfg.rpcResult;
    },
  }),
}));

import { GET } from '../src/app/api/last-seen-prices/route';
import { worthInputFor, worthOf, worthTotal, type StoredRate } from '../src/lib/collection-worth';

const root = join(__dirname, '..');
const ids = (n: number) => Array.from({ length: n }, (_, i) => String(10000 + i));
const req = (qs: string, headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' }) =>
  new NextRequest(new URL(`https://bricksofindia.com/api/last-seen-prices${qs}`), { headers });

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefghijklmnopqrst.supabase.co';
  flags.myCollectionPage = true;
  cfg.key = 'reader-key';
  cfg.rpcCalls = [];
  cfg.rpcResult = { data: [], error: null };
});

describe('gates', () => {
  it('flag off: not found, and nothing is read', async () => {
    flags.myCollectionPage = false;
    const res = await GET(req(`?ids=${ids(1)}`));
    expect(res.status).toBe(404);
    expect(cfg.rpcCalls).toHaveLength(0);
  });
  it('a cross-site request is refused', async () => {
    const res = await GET(req(`?ids=${ids(1)}`, { 'sec-fetch-site': 'cross-site' }));
    expect(res.status).toBe(403);
    expect(cfg.rpcCalls).toHaveLength(0);
  });
});

describe('the input limit', () => {
  it('151 distinct set ids are rejected with 400, and nothing is read', async () => {
    const res = await GET(req(`?ids=${ids(151).join(',')}`));
    expect(res.status).toBe(400);
    expect(cfg.rpcCalls).toHaveLength(0);
  });
  it('150 distinct set ids are accepted, and all 150 go to the function', async () => {
    const res = await GET(req(`?ids=${ids(150).join(',')}`));
    expect(res.status).toBe(200);
    expect((cfg.rpcCalls[0] as { args: { p_set_numbers: string[] } }).args.p_set_numbers).toHaveLength(150);
  });
  it('repeats of one id count once, so a long list of the same ids is accepted', async () => {
    const res = await GET(req(`?ids=${Array.from({ length: 300 }, () => '10307').join(',')}`));
    expect(res.status).toBe(200);
  });
  it('values that are not set numbers are dropped before the read', async () => {
    await GET(req('?ids=10307,javascript:alert(1),abc,../etc'));
    expect((cfg.rpcCalls[0] as { args: { p_set_numbers: string[] } }).args.p_set_numbers).toEqual(['10307']);
  });
  it('no valid ids: an empty list, and no read', async () => {
    const res = await GET(req('?ids=abc'));
    expect(await res.json()).toEqual({ prices: [] });
    expect(cfg.rpcCalls).toHaveLength(0);
  });
});

describe('the output', () => {
  it('returns only set number, price and date, even if the function returns more columns', async () => {
    cfg.rpcResult = {
      data: [{ set_id: '10307', price_inr: 12999, observed_at: '2026-03-14T08:00:00Z', store_id: 'toycra', in_stock: true, product_url: 'https://x' }],
      error: null,
    };
    const body = await (await GET(req('?ids=10307'))).json();
    expect(body).toEqual({ prices: [{ set_number: '10307', price_inr: 12999, observed_at: '2026-03-14T08:00:00Z' }] });
    expect(Object.keys(body.prices[0]).sort()).toEqual(['observed_at', 'price_inr', 'set_number']);
  });
  it('the response is cached privately for an hour, varying by the request origin', async () => {
    const res = await GET(req('?ids=10307'));
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=3600');
    expect(res.headers.get('Vary')).toBe('Sec-Fetch-Site');
  });
  it('calls the function by name with the batch', async () => {
    await GET(req('?ids=10307,10308'));
    expect(cfg.rpcCalls[0]).toEqual({ name: 'get_last_seen_prices', args: { p_set_numbers: ['10307', '10308'] } });
  });
});

describe('failures answer unavailable, never a guess', () => {
  it('no read key: 503, and no read', async () => {
    cfg.key = null;
    const res = await GET(req('?ids=10307'));
    expect(res.status).toBe(503);
    expect(cfg.rpcCalls).toHaveLength(0);
  });
  it('a failed read: 503 with no prices', async () => {
    cfg.rpcResult = { data: null, error: { message: 'down' } };
    const res = await GET(req('?ids=10307'));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'unavailable' });
  });
});

describe('the route is not reachable by browsers with a read on the price tables', () => {
  it('the route file names only the function, never a price table', () => {
    const src = readFileSync(join(root, 'src/app/api/last-seen-prices/route.ts'), 'utf8');
    expect(src).toContain("rpc('get_last_seen_prices'");
    expect(src).not.toMatch(/from\('(store_prices|price_history)'\)/);
  });
  it('the Cloudflare rate-rule note is in the code', () => {
    const src = readFileSync(join(root, 'src/app/api/last-seen-prices/route.ts'), 'utf8');
    expect(src).toMatch(/Cloudflare rate rule/);
  });
});

// Page-level: the same path the page takes for each collection set (the price row, the worth input, the rule, the total).
describe('page-level: stored estimate only as a fallback, excluded from the total', () => {
  const rate: StoredRate = { rate: 95, asOf: '2026-10-18' };
  const owned = [
    { set: 'A', qty: 1 }, // has a US price
    { set: 'B', qty: 2 }, // only a stored estimate
    { set: 'C', qty: 1 }, // nothing
  ];
  const prices = new Map([
    ['A', { best_price_inr: null, us_price_usd: 499, stored_estimate_inr: 99999 }],
    ['B', { best_price_inr: null, us_price_usd: null, stored_estimate_inr: 43900 }],
    ['C', { best_price_inr: null, us_price_usd: null, stored_estimate_inr: null }],
  ]);
  const items = owned.map((o) => worthInputFor(o, prices.get(o.set), true));

  it('a US price beats the stored estimate when both exist', () => {
    expect(worthOf(items[0], rate, false)).toMatchObject({ rule: 'estimate' });
    expect(worthOf(items[0], rate, false).line).toBe('About ₹47,405, estimated from the US list price');
  });
  it('with no US price, the stored estimate is shown with its source named', () => {
    expect(worthOf(items[1], rate, false).line).toBe('About ₹43,900, worked out from the US price');
  });
  it('the total excludes the stored estimate and says so', () => {
    const t = worthTotal(items, rate, () => false);
    expect(t.inr).toBe(47405); // only the US-price estimate for A, once
    expect(t.line).toMatch(/1 is worked out from the US price and not counted\./);
  });
  it('the page passes the stored estimate from the price row only when the prices loaded', () => {
    const off = worthInputFor({ set: 'B', qty: 1 }, prices.get('B'), false);
    expect(off.storedEstimateInr).toBeNull();
  });
  it('the page source uses the same input builder for the rows and the total', () => {
    const src = readFileSync(join(root, 'src/app/my/MyCollection.tsx'), 'utf8');
    expect(src).toContain('worthInputFor(o, prices.get(o.set), priceState === \'ok\')');
    expect(src).toContain('worthTotal(worthItems, rate, (s) => unknownRetired.isRetired(s), capped)');
  });
});
