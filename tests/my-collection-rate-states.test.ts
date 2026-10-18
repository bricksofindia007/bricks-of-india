// The stored exchange rate on My Collection, in its four states: usable, missing, stale (older than 5 days) and
// out-of-band (outside 70 to 110). A missing, stale or out-of-band rate means no estimate is shown. The route
// answers with the sets and prices whatever the rate read does.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefghijklmnopqrst.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';
});

const flags = vi.hoisted(() => ({ myCollectionPage: true, myCollectionHearts: true }));
vi.mock('../src/lib/feature-flags', () => ({ FEATURE_FLAGS: flags }));
vi.mock('../src/lib/get-secret', () => ({ getSecret: () => 'reader-key' }));

// One fake client for both reads: sets/prices through the chain, the rate through rpc.
const db = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
  rate: { data: [] as unknown[] | null, error: null as null | { message: string }, throws: false },
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const c: Record<string, unknown> = {
        select: () => c,
        in: () => c,
        eq: () => c,
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
          Promise.resolve({ data: db.tables[table] ?? [], error: null }).then(res, rej),
      };
      return c;
    },
    rpc: async (name: string) => {
      if (name !== 'get_usd_inr_rate') throw new Error(`unexpected function ${name}`);
      if (db.rate.throws) throw new Error('network down');
      return db.rate;
    },
  }),
}));

import { GET } from '../src/app/api/saved-sets/route';
import { usableRate, worthInputFor, worthOf, type StoredRate } from '../src/lib/collection-worth';
import { loadStoredRate, toStoredRate, rateSourceOf } from '../src/lib/usd-rate-reader';

const NOW = new Date('2026-10-18T06:00:00Z');
const US_ONLY = () => worthInputFor({ set: '10307', qty: 1 }, { best_price_inr: null, us_price_usd: 499 }, true);
const req = (qs: string) =>
  new NextRequest(new URL(`https://bricksofindia.com/api/saved-sets${qs}`), { headers: { 'sec-fetch-site': 'same-origin' } });

beforeEach(() => {
  flags.myCollectionPage = true;
  db.tables = { set_price_summary: [{ set_id: '10307', best_price_inr: 41199, best_store_ids: ['lego_in'] }], stores: [] };
  db.rate = { data: [], error: null, throws: false };
});

describe('the four rate states, on the worth rules the page uses', () => {
  it('usable: a rate dated today gives an estimate', () => {
    const w = worthOf(US_ONLY(), usableRate({ rate: 88, asOf: '2026-10-18' }, NOW), false);
    expect(w.rule).toBe('estimate');
    expect(w.inr).not.toBeNull();
  });
  it('missing: no rate, no estimate', () => {
    const w = worthOf(US_ONLY(), usableRate(null, NOW), false);
    expect(w.rule).toBe('unknown');
    expect(w.inr).toBeNull();
  });
  it('stale: a rate over 5 days old gives no estimate', () => {
    const w = worthOf(US_ONLY(), usableRate({ rate: 88, asOf: '2026-10-12' }, NOW), false);
    expect(w.rule).toBe('unknown');
    expect(w.inr).toBeNull();
  });
  it('out-of-band: a rate outside 70 to 110 gives no estimate, either side', () => {
    for (const rate of [0, 69.99, 110.01, 150]) {
      const w = worthOf(US_ONLY(), usableRate({ rate, asOf: '2026-10-18' }, NOW), false);
      expect(w.inr, `rate ${rate}`).toBeNull();
    }
  });
  it('the band edges are usable (70 and 110)', () => {
    for (const rate of [70, 110]) {
      expect(usableRate({ rate, asOf: '2026-10-18' }, NOW), `rate ${rate}`).not.toBeNull();
    }
  });
  it('5 days old is usable; the stale line is 6 days', () => {
    expect(usableRate({ rate: 88, asOf: '2026-10-13' }, NOW)).not.toBeNull();
    expect(usableRate({ rate: 88, asOf: '2026-10-12' }, NOW)).toBeNull();
  });
});

describe('the reader maps the granted function row (T1 reader)', () => {
  it('maps a usable row, and refuses an unusable one', () => {
    expect(toStoredRate({ rate: '88.2', value_date: '2026-10-18' })).toEqual({ rate: 88.2, asOf: '2026-10-18' });
    expect(toStoredRate({ rate: 88, value_date: 'yesterday' })).toBeNull();
  });
  it('a read that returns nothing, or throws, gives no rate (loadStoredRate)', async () => {
    db.rate = { data: [], error: null, throws: false };
    expect(await loadStoredRate()).toBeNull();
    db.rate = { data: null, error: { message: 'down' }, throws: false };
    expect(await loadStoredRate()).toBeNull();
    db.rate = { data: [], error: null, throws: true };
    await expect(loadStoredRate()).rejects.toThrow('network down');
  });
  it('the source the page uses hands back exactly the stored value', () => {
    expect(rateSourceOf(null).getRate()).toBeNull();
    expect(rateSourceOf({ rate: 88, asOf: '2026-10-18' }).getRate()).toEqual({ rate: 88, asOf: '2026-10-18' });
  });
});

describe('through the route: the rate travels with the sets, and a rate failure never takes the sets down', () => {
  const body = async (res: Response) => (await res.json()) as { sets: Array<{ set_number: string; best_price_inr: number | null }>; usd_inr: StoredRate | null };

  it('usable: the route returns the stored rate with the prices', async () => {
    db.rate = { data: [{ rate: 88.2, value_date: '2026-10-18', source: 'ecb', fetched_at: '2026-10-18T00:00:00Z' }], error: null, throws: false };
    const b = await body(await GET(req('?ids=10307')));
    expect(b.usd_inr).toEqual({ rate: 88.2, asOf: '2026-10-18' });
    expect(b.sets[0].best_price_inr).toBe(41199);
  });
  it('missing: the route returns no rate, and the sets and prices are still there', async () => {
    db.rate = { data: [], error: null, throws: false };
    const b = await body(await GET(req('?ids=10307')));
    expect(b.usd_inr).toBeNull();
    expect(b.sets[0].best_price_inr).toBe(41199);
  });
  it('the rate read throws: the route still answers 200 with the sets, and no rate', async () => {
    db.rate = { data: [], error: null, throws: true };
    const res = await GET(req('?ids=10307'));
    expect(res.status).toBe(200);
    const b = await body(res);
    expect(b.usd_inr).toBeNull();
    expect(b.sets[0].best_price_inr).toBe(41199);
  });
  it('stale or out-of-band: the route passes the stored value on, and the page refuses it', async () => {
    db.rate = { data: [{ rate: 88, value_date: '2026-10-01', source: 'ecb', fetched_at: 'x' }], error: null, throws: false };
    const stale = await body(await GET(req('?ids=10307')));
    expect(usableRate(stale.usd_inr, NOW)).toBeNull();
    db.rate = { data: [{ rate: 150, value_date: '2026-10-18', source: 'ecb', fetched_at: 'x' }], error: null, throws: false };
    const band = await body(await GET(req('?ids=10307')));
    expect(usableRate(band.usd_inr, NOW)).toBeNull();
  });
});

describe('the page wiring', () => {
  it('the page takes its rate from the stored value that came with the sets, and nothing else', () => {
    const src = readFileSync(join(__dirname, '..', 'src/app/my/MyCollection.tsx'), 'utf8');
    expect(src).toContain('setStoredRate(j.usd_inr ?? null);');
    expect(src).toContain('.catch(() => { if (live) { setStoredRate(null); setPriceState(\'failed\'); } });');
    expect(src).toContain('usableRate(rateSourceOf(storedRate).getRate(), new Date())');
  });
});
