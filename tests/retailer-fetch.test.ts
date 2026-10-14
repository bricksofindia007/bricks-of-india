/**
 * Wave 1 PR-0 (2026-09-26): listing identity (SKU first), compare_at capture,
 * and the canonical-listing rule. Fixtures are the real MyBrickHouse listings
 * the old first-number-in-title logic mis-matched.
 */
import { describe, it, expect } from 'vitest';
import { parseProduct, isMoreCanonical } from '../scripts/lib/retailer-fetch.mjs';

const KNOWN = new Set(['42242', '5023', '11375', '2004', '76337', '2099', '40912', '6057', '72537', '42643']);
const BY_NAME = new Map([['sea serpent', '6057']]);

const mbh = (title: string, handle: string, sku: string, price = '999.00', cmp: string | null = null, extra: Record<string, unknown> = {}) => ({
  title, handle, variants: [{ sku, price, compare_at_price: cmp, available: true }], ...extra,
});

describe('parseProduct identity: SKU before title/URL digits', () => {
  it.each([
    ['Mercedes-Benz Unimog U 5023 with Crane', 'lego-r-technic-mercedes-benz-unimog-u-5023-with-crane-42242', '42242'],
    ['Ferrari F2004 & Michael Schumacher', 'lego-icons-ferrari-f2004-michael-schumacher-model-car-11375', '11375'],
    ['Miles Morales Mech vs. Spider-Man 2099', 'lego-r-marvel-miles-morales-mech-vs-spider-man-2099-76337', '76337'],
  ])('%s -> %s (was mis-matched by the first number in the title)', (title, handle, sku) => {
    const p = parseProduct(mbh(title, handle, sku), 'mybrickhouse', 'lego.mybrickhouse.com', BY_NAME, KNOWN);
    expect(p!.setNumber).toBe(sku);
    expect(p!.matchMethod).toBe('sku');
  });

  it('SKU beats a name-map collision (Sea Serpent 40912, not 6057)', () => {
    const p = parseProduct(mbh('Sea Serpent', 'sea-serpent', '40912'), 'mybrickhouse', 'lego.mybrickhouse.com', BY_NAME, KNOWN);
    expect(p!.setNumber).toBe('40912');
  });

  it('Toycra "Lego72537" SKU form resolves to 72537', () => {
    const p = parseProduct(mbh('Lego 72537 Kpop Demon Hunters', 'lego-72537-kpop', 'Lego72537'), 'toycra', 'www.toycra.com', new Map(), KNOWN);
    expect(p!.setNumber).toBe('72537');
    expect(p!.matchMethod).toBe('sku');
  });

  it('falls back to title/URL digits when the SKU is not a known set', () => {
    const p = parseProduct(mbh('LEGO 42643 Candy Stand', 'friends-42643-kit', 'ABC-1'), 'mybrickhouse', 'lego.mybrickhouse.com', BY_NAME, KNOWN);
    expect(p!.setNumber).toBe('42643');
    expect(p!.matchMethod).toBe('text');
  });

  it('defaults knownSets to the name map values (existing callers unchanged)', () => {
    const p = parseProduct(mbh('Sea Serpent', 'sea-serpent', '6057'), 'mybrickhouse', 'lego.mybrickhouse.com', BY_NAME);
    expect(p!.setNumber).toBe('6057');
    expect(p!.matchMethod).toBe('sku');
  });
});

describe('compare_at_price capture', () => {
  it('captures the displayed MRP of the chosen variant', () => {
    const p = parseProduct(mbh('Candy Stand', 'friends-candyfloss-42643-kit', '42643', '670.00', '899.00'), 'mybrickhouse', 'lego.mybrickhouse.com', BY_NAME, KNOWN);
    expect(p!.priceInr).toBe(670);
    expect(p!.compareAtInr).toBe(899);
  });
  it('null when the store sets none', () => {
    const p = parseProduct(mbh('Candy Stand', 'friends-candyfloss-42643-kit', '42643', '899.00', null), 'mybrickhouse', 'lego.mybrickhouse.com', BY_NAME, KNOWN);
    expect(p!.compareAtInr).toBeNull();
  });
});

describe('canonical listing: SKU > title/URL > name, then oldest; never price', () => {
  const base = { setNumber: '42643', storeId: 'mybrickhouse', inStock: true, productUrl: 'x', compareAtInr: null };
  it('a SKU match beats a cheaper title match', () => {
    const skuMatch = { ...base, priceInr: 899, matchMethod: 'sku', productCreatedAt: '2026-06-01T00:00:00Z', productId: 5 };
    const cheaper = { ...base, priceInr: 670, matchMethod: 'text', productCreatedAt: '2026-01-01T00:00:00Z', productId: 1 };
    expect(isMoreCanonical(skuMatch, cheaper)).toBe(true);
    expect(isMoreCanonical(cheaper, skuMatch)).toBe(false);
  });
  it('same method: the oldest listing wins regardless of price', () => {
    const older = { ...base, priceInr: 899, matchMethod: 'sku', productCreatedAt: '2025-11-01T00:00:00Z', productId: 9 };
    const newerCheaper = { ...base, priceInr: 670, matchMethod: 'sku', productCreatedAt: '2026-08-01T00:00:00Z', productId: 2 };
    expect(isMoreCanonical(older, newerCheaper)).toBe(true);
  });
});
