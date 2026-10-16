import { describe, it, expect } from 'vitest';
import { reviewListingCheck } from '../scripts/lib/review-listing-guard.mjs';
import { publishOneDraft, UnsourcedReviewRefused } from '../src/lib/publish-draft';

// Minimal stand-in for the Supabase client: enough of the query chain the guard uses.
function fakeSupabase(tables: Record<string, Record<string, unknown>[]>) {
  const touched: string[] = [];
  const client = {
    touched,
    from(name: string) {
      touched.push(name);
      const filters: Record<string, unknown> = {};
      const rows = () => (tables[name] ?? []).filter((r) => Object.entries(filters).every(([k, v]) => r[k] === v));
      const builder = {
        select: () => builder,
        eq: (k: string, v: unknown) => { filters[k] = v; return builder; },
        limit: () => builder,
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
          Promise.resolve({ data: rows(), error: null }).then(res, rej),
      };
      return builder;
    },
  };
  return client;
}

const CATALOGUE = [{ set_number: '77059' }, { set_number: '72156' }, { set_number: '40919' }];
const STORES = [
  { set_id: '77059', store_id: 'toycra', in_stock: true },   // listed and in stock
  { set_id: '72156', store_id: 'toycra', in_stock: false },  // listed, out of stock
];

describe('reviewListingCheck (interim guard)', () => {
  it('lets a listed, in-stock set proceed', async () => {
    const sb = fakeSupabase({ sets: CATALOGUE, store_prices: STORES });
    expect(await reviewListingCheck(sb, '77059')).toEqual({ ok: true });
  });

  it('skips an unlisted set (in the catalogue, no in-stock listing)', async () => {
    const sb = fakeSupabase({ sets: CATALOGUE, store_prices: STORES });
    const r = await reviewListingCheck(sb, '72156');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no in-stock store listing/);
  });

  it('skips a set that is not in the catalogue (e.g. 40909)', async () => {
    const sb = fakeSupabase({ sets: CATALOGUE, store_prices: STORES });
    const r = await reviewListingCheck(sb, '40909');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/not in the catalogue/);
  });

  it('skips when the set could not be identified', async () => {
    const sb = fakeSupabase({ sets: CATALOGUE, store_prices: STORES });
    expect((await reviewListingCheck(sb, null)).ok).toBe(false);
  });
});

describe('publishOneDraft refuses a review with no retailer source', () => {
  it('throws UnsourcedReviewRefused and writes nothing', async () => {
    const sb = fakeSupabase({});
    const draft = {
      id: 'draft-1',
      draft_title: 'Test review',
      draft_body: 'Body text.',
      draft_verdict: 'WAIT',
      draft_format: 'review',
      word_count: 300,
      source_url: 'https://example.com/x',
      source_title: 'Test',
      source_excerpt: null,
      source_retailer: null,
    };
    await expect(publishOneDraft(draft as never, sb as never)).rejects.toBeInstanceOf(UnsourcedReviewRefused);
    expect(sb.touched).toEqual([]);
  });
});
