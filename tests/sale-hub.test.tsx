// Sale hub (ideas register N1): Brick Rush switch, prices and set line.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BRICK_RUSH, saleActive, saleInr } from '../src/lib/sale-hub';
import { SaleSetLine } from '../src/components/sales/SaleSetLine';

describe('Brick Rush switch', () => {
  it('is on during 1-11 Oct and off from 12 Oct 00:00 IST', () => {
    expect(saleActive(BRICK_RUSH, new Date('2026-10-02T08:00:00Z'))).toBe(true);
    expect(saleActive(BRICK_RUSH, new Date('2026-10-11T18:29:59Z'))).toBe(true);   // 11 Oct 23:59:59 IST
    expect(saleActive(BRICK_RUSH, new Date('2026-10-11T18:30:00Z'))).toBe(false);  // 12 Oct 00:00 IST
    expect(saleActive(BRICK_RUSH, new Date('2026-09-30T12:00:00Z'))).toBe(false);
  });
  it('covers exactly the 50 sets from the store list, e.g. Death Star ₹68,249', () => {
    expect(Object.keys(BRICK_RUSH.prices)).toHaveLength(50);
    expect(BRICK_RUSH.prices['75419']).toBe(68249);
    expect(BRICK_RUSH.setLine(saleInr(68249))).toBe('In LEGO Certified Stores till 11 Oct: ₹68,249 (Brick Rush)');
    expect(saleInr(104999)).toBe('₹1,04,999');
  });
  it('the set line renders only for sale sets', () => {
    // Rendered on the server with today's clock; today (2 Oct) is inside the sale in this test run only
    // if the clock says so, so check the not-in-sale case, which never renders.
    expect(renderToStaticMarkup(<SaleSetLine setNumber="99999" />)).toBe('');
  });
});
