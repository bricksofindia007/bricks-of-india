// /sets default order (Bundle 3 item 11): priced sets first, newest first within each group, theme scope applied.
import { describe, it, expect } from 'vitest';
import { orderSetsForDefault, type SetOrderRow } from '../src/lib/sets-default-order';

// Input is in the cache's order: year descending, then set number descending.
const rows: SetOrderRow[] = [
  { set_number: '99001', year: 2027, theme: 'Icons' },
  { set_number: '99002', year: 2026, theme: 'Icons' },
  { set_number: '76001', year: 2025, theme: 'Icons' },
  { set_number: '75001', year: 2024, theme: 'Star Wars' },
  { set_number: '77001', year: 2023, theme: 'Star Wars' },
];
const priced = new Set(['75001', '76001']);
const has = (n: string) => priced.has(n);

describe('orderSetsForDefault', () => {
  it('puts priced sets first, then unpriced, each newest first', () => {
    expect(orderSetsForDefault(rows, has, '')).toEqual(['76001', '75001', '99001', '99002', '77001']);
  });
  it('page 1 is not only unpriced sets when any set has a price', () => {
    const page1 = orderSetsForDefault(rows, has, '').slice(0, 2);
    expect(page1.every(has)).toBe(true);
  });
  it('a theme scope keeps only that theme, priced first', () => {
    expect(orderSetsForDefault(rows, has, 'Icons')).toEqual(['76001', '99001', '99002']);
  });
  it('an unknown theme gives an empty list', () => {
    expect(orderSetsForDefault(rows, has, 'Nope')).toEqual([]);
  });
});
