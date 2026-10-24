import { describe, it, expect } from 'vitest';
import { mrpCoverage, type PriceRow, type SetRow } from '../scripts/lib/mrp-coverage';

const set = (set_number: string, over: Partial<SetRow> = {}): SetRow => ({
  set_number,
  name: `Set ${set_number}`,
  lego_mrp_inr: null,
  mrp_verified: false,
  is_gwp: false,
  ...over,
});

describe('MRP coverage rule (in-stock sets only)', () => {
  it('an in-stock set with no MRP still FAILS', () => {
    const rows: PriceRow[] = [{ set_id: '10001', in_stock: true }];
    const r = mrpCoverage(rows, [set('10001')], new Map());
    expect(r.missing.map((s) => s.set_number)).toEqual(['10001']);
    expect(r.outOfStockNoMrp).toEqual([]);
  });

  it('an out-of-stock-only set with no MRP PASSES (information only)', () => {
    const rows: PriceRow[] = [{ set_id: '10002', in_stock: false }];
    const r = mrpCoverage(rows, [set('10002')], new Map());
    expect(r.missing).toEqual([]);
    expect(r.outOfStockNoMrp.map((s) => s.set_number)).toEqual(['10002']);
  });

  it('a set with one in-stock listing and one out-of-stock listing counts as in stock', () => {
    const rows: PriceRow[] = [
      { set_id: '10003', in_stock: false },
      { set_id: '10003', in_stock: true },
    ];
    const r = mrpCoverage(rows, [set('10003')], new Map());
    expect(r.missing.map((s) => s.set_number)).toEqual(['10003']);
  });

  it('an in-stock set with a store anchor MRP passes', () => {
    const rows: PriceRow[] = [{ set_id: '10004', in_stock: true }];
    const r = mrpCoverage(rows, [set('10004')], new Map([['10004', 4999]]));
    expect(r.missing).toEqual([]);
  });

  it('an in-stock set with an unverified catalogue MRP still FAILS (not a page MRP)', () => {
    const rows: PriceRow[] = [{ set_id: '10005', in_stock: true }];
    const r = mrpCoverage(rows, [set('10005', { lego_mrp_inr: 3999, mrp_verified: false })], new Map());
    expect(r.missing.map((s) => s.set_number)).toEqual(['10005']);
  });

  it('an out-of-stock set with an unverified catalogue MRP is listed as information', () => {
    const rows: PriceRow[] = [{ set_id: '10006', in_stock: false }];
    const r = mrpCoverage(rows, [set('10006', { lego_mrp_inr: 3999, mrp_verified: false })], new Map());
    expect(r.missing).toEqual([]);
    expect(r.outOfStockNoMrp.map((s) => s.set_number)).toEqual(['10006']);
  });

  it('GWP gifts are excluded from both lists', () => {
    const rows: PriceRow[] = [
      { set_id: '10007', in_stock: true },
      { set_id: '10008', in_stock: false },
    ];
    const r = mrpCoverage(rows, [set('10007', { is_gwp: true }), set('10008', { is_gwp: true })], new Map());
    expect(r.missing).toEqual([]);
    expect(r.outOfStockNoMrp).toEqual([]);
  });

  it('an in-stock set missing from the sets table still FAILS', () => {
    const rows: PriceRow[] = [{ set_id: '10009', in_stock: true }];
    const r = mrpCoverage(rows, [], new Map());
    expect(r.missing).toEqual([{ set_number: '10009', name: '(not found in sets table)' }]);
  });
});
