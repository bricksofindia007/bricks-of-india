// The total line reads "1 set on your shelf" for one set and "N sets on your shelf" otherwise (order 0380 item 2).
// Only the plural word changes; the rest of line 1 is the approved wording.
import { describe, it, expect } from 'vitest';
import { worthTotal, type WorthItem } from '../src/lib/collection-worth';

const item = (set: string): WorthItem => ({ set, indianPriceInr: 1000, usPriceUsd: null, qty: 1 });
const no = () => false;

describe('the shelf count reads with the right plural', () => {
  it('one set: "1 set on your shelf"', () => {
    expect(worthTotal([item('90001')], null, no).line).toBe('1 set on your shelf. Worth about ₹1,000. Your wallet has questions.');
  });
  it('two sets: "2 sets on your shelf"', () => {
    expect(worthTotal([item('90001'), item('90002')], null, no).line).toBe('2 sets on your shelf. Worth about ₹2,000. Your wallet has questions.');
  });
  it('no sets: "0 sets on your shelf"', () => {
    expect(worthTotal([], null, no).line).toBe('0 sets on your shelf. Worth about ₹0. Your wallet has questions.');
  });
  it('one set with the cap sentence keeps the cap sentence after line 1', () => {
    expect(worthTotal([item('90001')], null, no, true).line).toBe('1 set on your shelf. Worth about ₹1,000. Your wallet has questions. Worth counts your newest 150 sets.');
  });
});
