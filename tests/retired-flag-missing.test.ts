// A set with no stored retired flag (the flag is unknown) never shows the retired line. It falls to the estimate
// when there is a US price and a usable rate, and otherwise to "Worth not known yet".
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const flags = vi.hoisted(() => ({ myCollectionPage: true, myCollectionHearts: true }));
vi.mock('../src/lib/feature-flags', () => ({ FEATURE_FLAGS: flags }));
vi.mock('../src/lib/get-secret', () => ({ getSecret: () => 'reader-key' }));

// The sets read can be made to fail on its own; the price summary read still works.
const db = vi.hoisted(() => ({ setsFail: false, sets: [] as unknown[] }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const c: Record<string, unknown> = {
        select: () => c,
        in: () => c,
        eq: () => c,
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
          if (table === 'sets' && db.setsFail) return Promise.resolve({ data: null, error: { message: 'down' } }).then(res, rej);
          if (table === 'set_price_summary') return Promise.resolve({ data: [{ set_id: '10307', best_price_inr: null, best_store_ids: null }], error: null }).then(res, rej);
          if (table === 'sets') return Promise.resolve({ data: db.sets, error: null }).then(res, rej);
          return Promise.resolve({ data: [], error: null }).then(res, rej);
        },
      };
      return c;
    },
    rpc: async () => ({ data: [{ rate: 88, value_date: '2026-10-18', source: 'x', fetched_at: 'x' }], error: null }),
  }),
}));

import { GET } from '../src/app/api/saved-sets/route';
import { worthOf, worthInputFor, usableRate, RETIRED_LINE, WORTH_UNKNOWN_LINE } from '../src/lib/collection-worth';

const NOW = new Date('2026-10-18T06:00:00Z');
const RATE = usableRate({ rate: 88, asOf: '2026-10-18' }, NOW);
const SEEN = { priceInr: 12999, observedAt: '2026-03-14T09:00:00Z' };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefghijklmnopqrst.supabase.co';
  flags.myCollectionPage = true;
  db.setsFail = false;
  db.sets = [];
});

describe('a set with no stored retired flag, at the worth rules', () => {
  it('a US price and a usable rate: the estimate, never the retired line', () => {
    const item = worthInputFor({ set: '10307', qty: 1 }, { best_price_inr: null, us_price_usd: 499 }, true);
    const w = worthOf(item, RATE, null, SEEN);
    expect(w.rule).toBe('estimate');
    expect(w.line).not.toBe(RETIRED_LINE);
  });
  it('no US price: "Worth not known yet", never the retired line, even with a last-seen price', () => {
    const item = worthInputFor({ set: '10307', qty: 1 }, { best_price_inr: null, us_price_usd: null }, true);
    const w = worthOf(item, RATE, null, SEEN);
    expect(w.rule).toBe('unknown');
    expect(w.line).toBe(WORTH_UNKNOWN_LINE);
    expect(w.line).not.toBe(RETIRED_LINE);
  });
  it('a US price but no usable rate: "Worth not known yet", never the retired line', () => {
    const item = worthInputFor({ set: '10307', qty: 1 }, { best_price_inr: null, us_price_usd: 499 }, true);
    const w = worthOf(item, null, null, SEEN);
    expect(w.rule).toBe('unknown');
    expect(w.line).toBe(WORTH_UNKNOWN_LINE);
  });
});

describe('the route reports an unknown retired flag as null, and the page never reads null as retired', () => {
  const body = async (qs: string) => (await (await GET(new NextRequest(new URL(`https://bricksofindia.com/api/saved-sets${qs}`), { headers: { 'sec-fetch-site': 'same-origin' } }))).json()) as { sets: Array<{ retired: boolean | null }> };

  it('the sets read fails: the set has retired null, not false and not true', async () => {
    db.setsFail = true;
    const b = await body('?ids=10307');
    expect(b.sets[0].retired).toBeNull();
  });
  it('a set with the flag stored false is reported as false (a real answer)', async () => {
    db.sets = [{ set_number: '10307', us_price_usd: 499, lego_mrp_inr: null, mrp_verified: null, retired: false }];
    const b = await body('?ids=10307');
    expect(b.sets[0].retired).toBe(false);
  });
  it('the page only treats a set as retired when the flag is exactly true', () => {
    // The page passes isRetired to the worth rules; it returns the stored flag only after the read succeeds, and null otherwise.
    const src = readFileSync(join(__dirname, '..', 'src/app/my/MyCollection.tsx'), 'utf8');
    expect(src).toContain("const isRetired = (set: string): boolean | null => (priceState === 'ok' ? prices.get(set)?.retired ?? null : null);");
    expect(src).toContain("prices.get(o.set)?.retired === true");
  });
});
