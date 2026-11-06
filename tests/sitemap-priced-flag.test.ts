// Order 0840: the sitemap's priced-set rule sits behind FEATURE_FLAGS.sitemapPricedOnly, which is off. Off = the live
// sitemap (every set listed, no price read). On = only sets with a store price above zero.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

const SETS = [
  { set_number: '10001', name: 'Priced Set', updated_at: '2026-10-01T00:00:00Z', index_tier: 'tier1' },
  { set_number: '10002', name: 'Unpriced Set', updated_at: '2026-10-01T00:00:00Z', index_tier: 'tier2' },
  { set_number: '10003', name: 'Zero Price Set', updated_at: '2026-10-01T00:00:00Z', index_tier: 'tier2' },
];
// Only rows with a price above zero (the query filters with gt(0)); 10003 has none.
const PRICES = [{ set_id: '10001', price_inr: 5000 }];

function fakeDb() {
  const calls = { storePricesRead: 0 };
  const builder = (table: string) => {
    let from = 0;
    let to = 999;
    const b: any = {
      select: () => b, neq: () => b, eq: () => b, order: () => b, not: () => b, lte: () => b, gt: () => b,
      range: (f: number, t: number) => { from = f; to = t; return b; },
      then: (resolve: (v: unknown) => void) => {
        if (table === 'sets') resolve({ data: SETS.slice(from, to + 1) });
        else if (table === 'store_prices') { calls.storePricesRead += 1; resolve({ data: PRICES.slice(from, to + 1) }); }
        else resolve({ data: [] });
      },
    };
    return b;
  };
  return { db: { from: (t: string) => builder(t) }, calls };
}

async function sitemapWithFlag(flag: boolean) {
  vi.resetModules();
  const { db, calls } = fakeDb();
  vi.doMock('@/lib/supabase', () => ({ createServerClient: () => db }));
  vi.doMock('@/lib/feature-flags', () => ({ FEATURE_FLAGS: { sitemapPricedOnly: flag, thinThemeNoindex: false } }));
  const mod = await import('../src/app/sitemap');
  const entries = await mod.default();
  const setUrls = entries.map((e) => e.url).filter((u) => u.includes('/sets/10'));
  return { setUrls, calls, mod };
}

afterEach(() => {
  vi.doUnmock('@/lib/supabase');
  vi.doUnmock('@/lib/feature-flags');
  vi.resetModules();
});

describe('sitemap: priced-set rule behind its flag (order 0840)', () => {
  it('flag off: every set is listed and the prices are not read (live behaviour)', async () => {
    const { setUrls, calls } = await sitemapWithFlag(false);
    expect(setUrls.map((u) => u.split('/sets/')[1].slice(0, 5)).sort()).toEqual(['10001', '10002', '10003']);
    expect(calls.storePricesRead).toBe(0);
  });

  it('flag on: only sets with a price above zero are listed', async () => {
    const { setUrls, calls } = await sitemapWithFlag(true);
    expect(setUrls).toHaveLength(1);
    expect(setUrls[0]).toContain('/sets/10001-');
    expect(calls.storePricesRead).toBeGreaterThan(0);
  });

  it('pricedOnly keeps exactly the sets with a positive store price', async () => {
    vi.resetModules();
    const { db } = fakeDb();
    const mod = await import('../src/app/sitemap');
    const kept = await mod.pricedOnly(db as any, SETS);
    expect(kept.map((s) => s.set_number)).toEqual(['10001']);
  });
});

describe('the flag is declared off in both flag files, under matching names', () => {
  it('config/feature_flags.py', () => {
    expect(read('config/feature_flags.py')).toMatch(/"sitemap_priced_only": False,/);
  });
  it('src/lib/feature-flags.ts', () => {
    expect(read('src/lib/feature-flags.ts')).toMatch(/sitemapPricedOnly: false,/);
  });
  it('the sitemap reads the flag and the price read is inside the guard', () => {
    const src = read('src/app/sitemap.ts');
    expect(src).toMatch(/FEATURE_FLAGS\.sitemapPricedOnly \? await pricedOnly\(supabase, allSets\) : allSets/);
  });
});
