// "New vendor" test. A pretend third store, "Testmart Shop", exists only in this fixture (not in the real seed).
// Every place that lists or renders stores is run with it. The places that leave it out are the hard-coded lists.
// The set of failing places is pinned: moving a list makes it pass and the pin shrinks; adding a hard-coded list makes
// the pin grow, and the test fails.
import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/lib/store-display-names', async (orig) => {
  const m = await orig<typeof import('../src/lib/store-display-names')>();
  const names: Record<string, string> = { ...m.STORE_DISPLAY_NAMES, testmart: 'Testmart Shop' };
  return { ...m, STORE_DISPLAY_NAMES: names, storeDisplayName: (slug: string) => names[slug] ?? slug };
});

import { setMetaDescription } from '../src/lib/utils';
import { buildIndiaPriceContext } from '../src/lib/generate-body';
import { STORE_NAMES, storeName } from '../src/lib/price-summary';

import { prePublishAutoFix, priceLineStores } from '../src/lib/publish-draft';

const NAME = 'Testmart Shop';

/** Each place that lists or renders stores, run with the fictional store. true = the store name appears. */
async function survey(): Promise<Record<string, boolean>> {
  const sb = {
    from: () => ({
      select: () => ({
        eq: async () => ({ data: [{ store_id: 'testmart', price_inr: 1000, in_stock: true }] }),
      }),
    }),
  } as never;
  const india = await buildIndiaPriceContext(sb, '10307', 'Eiffel Tower');
  return {
    'utils: setMetaDescription (set meta text)': setMetaDescription('X').includes(NAME),
    'generate-body: India price lines': india.includes(NAME),
    'price-summary: STORE_NAMES constant': STORE_NAMES['testmart'] === NAME,
    'price-summary: storeName (set card "only at" badge)': storeName('testmart') === NAME,
    'publish-draft: priceLineStores (review price line)': priceLineStores({
      source_retailer: 'testmart' as never, source_price_inr: 1000, source_stock_status: 'in_stock', source_checked_at: '2026-10-18',
    } as never).includes(NAME),
    'publish-draft: store detection and copy (publish path)': prePublishAutoFix(
      'The set costs ₹1,000 at a shop near you.', { source_title: 'x', draft_title: 'x' }, '10307-x',
    ).includes(NAME),
  };
}

/** The pinned list: the places that still leave a new store out. Shrinks as lists are moved. */
const PINNED_HARD_CODED = [
  'utils: setMetaDescription (set meta text)',
  'publish-draft: priceLineStores (review price line)',
  'publish-draft: store detection and copy (publish path)',
];

describe('new vendor: every store-listing output', () => {
  it('the set of outputs that leave the new store out matches the pinned list', async () => {
    const results = await survey();
    const failing = Object.entries(results).filter(([, ok]) => !ok).map(([k]) => k).sort();
    console.log('new-vendor survey, outputs that leave the store out:\n  ' + failing.join('\n  '));
    expect(failing).toEqual([...PINNED_HARD_CODED].sort());
  });
  it('the outputs that now include the new store (for the record)', async () => {
    const results = await survey();
    const passing = Object.entries(results).filter(([, ok]) => ok).map(([k]) => k).sort();
    expect(passing).toEqual([
      'generate-body: India price lines',
      'price-summary: STORE_NAMES constant',
      'price-summary: storeName (set card "only at" badge)',
    ].sort());
  });
});
