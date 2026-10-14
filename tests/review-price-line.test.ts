import { describe, it, expect } from 'vitest';
import { priceLineStores, resplicePublishedIndiaParagraph, extractIndiaParagraphBlock, type RetailerReviewSourceFields } from '../src/lib/publish-draft';
import { resolveEligibleListing } from '../scripts/lib/reviews-source.mjs';

const src = (o: Partial<RetailerReviewSourceFields>): RetailerReviewSourceFields => ({
  source_retailer: 'both', source_price_inr: 29399, source_stock_status: 'in_stock', source_checked_at: '2026-10-04T06:00:00Z', ...o,
});

describe('review price line names the store that has the price (round 11, 4 Oct 2026)', () => {
  it('one store', () => {
    expect(priceLineStores(src({ source_retailer: 'toycra' }))).toBe('Toycra');
    expect(priceLineStores(src({ source_retailer: 'mybrickhouse' }))).toBe('LEGO.in');
  });
  it('both stores, same price', () => {
    expect(priceLineStores(src({ featured_store: 'toycra', other_price_inr: 29399, other_in_stock: true }))).toBe('LEGO.in and Toycra');
  });
  it('both stores, different prices: cheaper first, the other in brackets', () => {
    expect(priceLineStores(src({ featured_store: 'toycra', other_price_inr: 41199, other_in_stock: true }))).toBe('Toycra (₹41,199 on LEGO.in)');
    expect(priceLineStores(src({ featured_store: 'mybrickhouse', other_price_inr: 34999, other_in_stock: false }))).toBe('LEGO.in (₹34,999 on Toycra, out of stock)');
  });
  it('a both source without details never claims both stores', () => {
    expect(priceLineStores(src({}))).toBe('the cheaper of LEGO.in and Toycra');
    expect(priceLineStores(src({ featured_store: 'toycra' }))).toBe('Toycra');
  });
  it('re-splices an old "on LEGO.in and Toycra" line into the new form, and finds the new form again', () => {
    const old = 'Body.\n\nPriced at ₹29,399 on LEGO.in and Toycra, confirmed in stock as of 21 Sep 2026.\nVerdict: BUY NOW.\n\nStandard disclaimer: if you\'ve got the money, obviously buy it — that\'s what the verdict says too, for once we all agree.';
    const s = src({ featured_store: 'toycra', other_price_inr: 41199, other_in_stock: true });
    const { content } = resplicePublishedIndiaParagraph(old, 'BUY NOW', s);
    expect(content).toContain('At review, it was priced at ₹29,399 on Toycra (₹41,199 on LEGO.in).\nVerdict: BUY NOW.');
    expect(extractIndiaParagraphBlock(content)).toMatch(/^At review, it was priced at ₹29,399 on Toycra \(₹41,199 on LEGO\.in\)\./);
    expect(resplicePublishedIndiaParagraph(content, 'BUY NOW', s).content).toBe(content);
  });
  it('the weekly resolver reports which store it featured', () => {
    const r = resolveEligibleListing({ toycra: { priceInr: 29399, inStock: true, productUrl: 't' }, mybrickhouse: { priceInr: 41199, inStock: true, productUrl: 'm' } });
    expect(r).toMatchObject({ sourceRetailer: 'both', featuredStore: 'toycra', sourcePriceInr: 29399, otherStore: { priceInr: 41199 } });
  });
});
