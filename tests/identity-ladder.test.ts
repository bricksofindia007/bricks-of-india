import { describe, it, expect } from 'vitest';
import { resolveIdentity, isMoreCanonical } from '../scripts/lib/identity-ladder.mjs';
import { parseInrExact, firstCryPublicPrice } from '../scripts/lib/scraper-contract.mjs';

// FP5.4 fixtures (P4 Step 4c). A small catalogue slice with the real collision shapes.
const rows = [
  ['2004', 'Jumbo Building Tub'],
  ['5023', 'Fences'],
  ['2099', 'Creative Bucket'],
  ['1701', 'Harbour Crane'],
  ['6020', 'Magic Shop'],
  ['76915', 'Ferrari F2004'],
  ['42198', 'Unimog U 5023 with Crane'],
  ['76287', 'Spider-Man 2099 Hoverbike'],
  ['10356', 'USS Enterprise NCC-1701'],
  ['71043', 'Hogwarts Castle'],
  ['71048', 'Minifigures Series 27'],
  ['60316', 'Police Station'],
  ['60320', 'Fire Station'],
  ['76284', 'Green Goblin Construction Figure'],
  ['10326', 'Natural History Museum'],
];
const catalogue = {
  byNumber: new Map(rows.map(([n, name]) => [n, { set_number: n, name }])),
  byName: new Map(rows.map(([n, name]) => [name.toLowerCase(), n])),
};
const L = (title: string, extra: Record<string, unknown> = {}) => ({ store: 'test', title, ...extra });

describe('identity ladder fixtures (FP5.4)', () => {
  it('title with no number -> exact catalogue name', () => {
    expect(resolveIdentity(L('Natural History Museum'), catalogue)).toEqual({ ok: true, setNumber: '10326', method: 'name' });
  });
  it('"F2004" is never set 2004 (name must match)', () => {
    expect(resolveIdentity(L('LEGO Speed Champions Ferrari F2004 76915'), catalogue)).toMatchObject({ ok: true, setNumber: '76915' });
    // no set number and no exact name: unmatched -- and above all NOT 2004
    const r = resolveIdentity(L('LEGO Ferrari F2004 Race Car'), catalogue);
    expect(r).toMatchObject({ ok: false, reason: 'no_catalogue_match' });
  });
  it('"NCC-1701" is never set 1701', () => {
    expect(resolveIdentity(L('LEGO Star Trek USS Enterprise NCC-1701 10356'), catalogue)).toMatchObject({ ok: true, setNumber: '10356' });
  });
  it('"Spider-Man 2099" is never set 2099', () => {
    expect(resolveIdentity(L('LEGO Marvel Spider-Man 2099 Hoverbike 76287'), catalogue)).toMatchObject({ ok: true, setNumber: '76287' });
  });
  it('"Unimog U 5023" is never set 5023 (SKU carries the right number)', () => {
    expect(resolveIdentity(L('Unimog U 5023 with Crane', { skus: ['42198'] }), catalogue)).toEqual({ ok: true, setNumber: '42198', method: 'sku' });
  });
  it('a SKU number is accepted only if the catalogue name matches', () => {
    expect(resolveIdentity(L('Some Unrelated Listing', { skus: ['71043'] }), catalogue)).toMatchObject({ ok: false });
  });
  it('FirstCry multi-set variant page -> unmatched multi_set_listing', () => {
    expect(resolveIdentity(L('LEGO City Police Station 60316 & Fire Station 60320 Combo'), catalogue)).toMatchObject({ ok: false, reason: 'multi_set_listing' });
  });
  it('Jaiman "-DM" box damage -> unmatched condition:box_damage (D28)', () => {
    expect(resolveIdentity(L('LEGO Green Goblin Construction Figure 76284', { skus: ['76284-DM'] }), catalogue)).toMatchObject({ ok: false, reason: 'condition:box_damage' });
  });
  it('Jaiman SKU != handle -> unmatched sku_handle_conflict', () => {
    expect(resolveIdentity(L('LEGO Harry Potter Hogwarts Castle', { skus: ['71043'], handle: 'lego-police-station-60316' }), catalogue)).toMatchObject({ ok: false, reason: 'sku_handle_conflict' });
  });
  it('CMF series: single pack matches via cmf_figures series name and number; packs of N do not', () => {
    const cat = { ...catalogue, byNumber: new Map([...catalogue.byNumber, ['71052', { set_number: '71052', name: 'Chocolatier' }], ['71051', { set_number: '71051', name: 'Koala Suit' }]]),
      cmfSeries: new Map([['71052', 'Series 29 Minifigures'], ['71051', 'Series 28 Minifigures']]) };
    expect(resolveIdentity(L('Series 29', { skus: ['71052'], handle: 'lego-r-minifigures-series-29-mystery-box-toy-71052' }), cat)).toMatchObject({ ok: true, setNumber: '71052' });
    expect(resolveIdentity(L('Lego 71051 Minifigures Animals Series 28 - (Pack Of 4 Mini-figures)', { skus: ['Lego71051'] }), cat)).toMatchObject({ ok: false, reason: 'cmf_box' });
    expect(resolveIdentity(L('Minifigures Series 28', { skus: ['71052'] }), cat)).toMatchObject({ ok: false, reason: 'sku_name_mismatch' });
  });
  it('a catalogue SKU with a disagreeing name is queued, never re-matched to another set', () => {
    const cat = { ...catalogue, byNumber: new Map([...catalogue.byNumber, ['43019', { set_number: '43019', name: 'Football' }], ['4297455', { set_number: '4297455', name: 'Soccer Ball' }]]),
      byName: new Map([...catalogue.byName, ['soccer ball', '4297455']]) };
    expect(resolveIdentity(L('Soccer Ball', { skus: ['43019'] }), cat)).toMatchObject({ ok: false, reason: 'sku_name_mismatch' });
  });
  it('piece counts are never set numbers ("(1361 Pieces)")', () => {
    const cat = { ...catalogue, byNumber: new Map([...catalogue.byNumber, ['1361', { set_number: '1361', name: 'Camera Car' }], ['42207', { set_number: '42207', name: 'Ferrari SF-24 F1 Car' }]]) };
    expect(resolveIdentity(L('LEGO 42207 Technic Ferrari SF-24 F1 Car (1361 Pieces)', { skus: ['Lego42207'] }), cat)).toMatchObject({ ok: true, setNumber: '42207', method: 'sku' });
  });
  it('CMF full box vs single pack', () => {
    expect(resolveIdentity(L('LEGO Minifigures Series 27 Full Box of 36 71048'), catalogue)).toMatchObject({ ok: false, reason: 'cmf_box' });
    expect(resolveIdentity(L('LEGO Minifigures Series 27 71048'), catalogue)).toMatchObject({ ok: true, setNumber: '71048' });
  });
  it('Hamleys slug with trailing uid and "NNN pieces" -> the named set only', () => {
    const handle = 'lego-harry-potter-hogwarts-castle-71043-building-kit-6020-piece-multicolor-16y-13011110';
    expect(resolveIdentity(L('LEGO Harry Potter Hogwarts Castle 71043 Building Kit (6020 Pieces)', { handle }), catalogue)).toMatchObject({ ok: true, setNumber: '71043', method: 'text' });
  });
  it('canonical listing: match method, then OLDEST listing -- never price', () => {
    const a = { method: 'text', createdAt: '2025-01-01T00:00:00Z', productId: 5, price: 900 };
    const b = { method: 'text', createdAt: '2026-01-01T00:00:00Z', productId: 1, price: 100 };
    expect(isMoreCanonical(a, b)).toBe(true);
    expect(isMoreCanonical({ ...b, method: 'sku' }, a)).toBe(true);
  });
});

describe('price parsing (FP5.2 parse validation)', () => {
  it('FirstCry paise are kept exactly (D27)', () => {
    expect(parseInrExact('₹2,975.07')).toBe(2975.07);
    expect(parseInrExact('3199')).toBe(3199);
  });
  it('non-numeric, zero or negative prices are rejected', () => {
    for (const bad of ['', 'Rs.', '0', '-5', 'NaN', null]) expect(parseInrExact(bad as any)).toBeNull();
  });
  it('FirstCry Club vs public price: public only', () => {
    const tile = '<span class="rupee fw lft">2975.07</span><div class="club-block">Club Price: <span>2911.09</span></div>';
    expect(firstCryPublicPrice(tile)).toBe(2975.07);
  });
});

import { evaluateBreaker } from '../scripts/lib/circuit-breaker.mjs';
describe('circuit breaker (FP5.3)', () => {
  const mk = (n: number, f: (i: number) => { priceInr: number; inStock: boolean }) => new Map(Array.from({ length: n }, (_, i) => [String(i), f(i)]));
  const prev = mk(100, () => ({ priceInr: 1000, inStock: true }));
  it('trips below 80% parsed', () => {
    expect(evaluateBreaker(prev, mk(79, () => ({ priceInr: 1000, inStock: true }))).trip).toBe(true);
    expect(evaluateBreaker(prev, mk(80, () => ({ priceInr: 1000, inStock: true }))).trip).toBe(false);
  });
  it('trips above 25% changed (price or stock)', () => {
    expect(evaluateBreaker(prev, mk(100, (i) => ({ priceInr: i < 26 ? 999 : 1000, inStock: true }))).trip).toBe(true);
    expect(evaluateBreaker(prev, mk(100, (i) => ({ priceInr: 1000, inStock: i >= 25 }))).trip).toBe(false);
  });
});

describe('approved name aliases (P8 item 3, public.set_name_aliases)', () => {
  const cat = (aliases: string[]) => ({
    byNumber: new Map([['43019', { set_number: '43019', name: 'Football', aliases }]]),
    byName: new Map([['football', '43019']]),
  });
  const listing = { store: 'toycra', title: 'Lego 43019 Editions FIFA Soccer Ball (1498 Pieces)', handle: 'lego-43019-editions-fifa-soccer-ball-1498-pieces', skus: ['43019'] };
  it('holds a SKU whose catalogue name disagrees when no alias is approved', () => {
    expect(resolveIdentity(listing, cat([]))).toMatchObject({ ok: false, reason: 'sku_name_mismatch' });
  });
  it('matches by SKU once the alias is approved (data, not code)', () => {
    expect(resolveIdentity(listing, cat(['Soccer Ball']))).toMatchObject({ ok: true, setNumber: '43019', method: 'sku' });
  });
});
