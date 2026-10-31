// Retired sets in the total (decision D-2026-10-30-01): a retired set with a last seen Indian price counts in the rupee
// total at that price; a retired set without one is not counted. The words are as on main (not yet approved).
import { describe, it, expect } from 'vitest';
import { worthOf, worthTotal, RETIRED_LINE, type WorthItem } from '../src/lib/collection-worth';

const item = (set: string, qty = 1): WorthItem => ({ set, indianPriceInr: null, usPriceUsd: null, qty });
const seen = { priceInr: 4999, observedAt: '2026-05-14T10:00:00Z' };
const yes = () => true;
const no = () => false;

describe('one retired set', () => {
  it('with a last seen price: counted at that price', () => {
    const w = worthOf(item('90001'), null, true, seen);
    expect(w.rule).toBe('last-seen');
    expect(w.inr).toBe(4999);
    expect(w.line).toMatch(/^Retired\. Last seen in India at ₹4,999 \(May 2026\)\. Good luck finding one\.$/);
  });

  it('without a last seen price: not counted, the approved retired line', () => {
    const w = worthOf(item('90001'), null, true, null);
    expect(w.rule).toBe('retired');
    expect(w.inr).toBeNull();
    expect(w.line).toBe(RETIRED_LINE);
  });

  it('a last seen price of zero is not a price: not counted', () => {
    const w = worthOf(item('90001'), null, true, { priceInr: 0, observedAt: '2026-05-14T10:00:00Z' });
    expect(w.rule).toBe('retired');
    expect(w.inr).toBeNull();
  });

  it('a set that is not retired is never counted from a last seen price', () => {
    const w = worthOf(item('90001'), null, false, seen);
    expect(w.rule).not.toBe('last-seen');
  });
});

describe('the total', () => {
  it('a retired set with a last seen price adds its price times the copies, and is counted', () => {
    const t = worthTotal([item('90001', 2)], null, yes, false, () => seen);
    expect(t.inr).toBe(4999 * 2);
    expect(t.lastSeen).toBe(1);
    expect(t.indian).toBe(1);
    expect(t.counted).toBe(1);
    expect(t.retired).toBe(0);
    expect(t.line).toBe('1 set on your shelf. Worth about ₹9,998. Your wallet has questions.');
  });

  it('a retired set without a last seen price is not counted; the retired count and the line carry it', () => {
    const t = worthTotal([item('90001')], null, yes, false, () => null);
    expect(t.inr).toBe(0);
    expect(t.retired).toBe(1);
    expect(t.counted).toBe(0);
    expect(t.line).toBe('1 set on your shelf. Worth about ₹0. Your wallet has questions.');
  });

  it('a mix: the coverage numbers follow (seen counted, unseen retired not)', () => {
    const lastSeenOf = (s: string) => (s === '90001' ? seen : null);
    const t = worthTotal([item('90001'), item('90002'), item('90003', 3)], null, yes, false, lastSeenOf);
    expect(t.counted).toBe(1);
    expect(t.sets).toBe(3);
    expect(t.inr).toBe(4999);
    expect(t.retired).toBe(2);
    expect(t.line).toBe('3 sets on your shelf. Worth about ₹4,999. Your wallet has questions.');
  });

  it('a retired set with a last seen price is not in the retired count (the tile counts only unvalued sets)', () => {
    const t = worthTotal([item('90001')], null, yes, false, () => seen);
    expect(t.retired).toBe(0);
  });

  it('with no retired sets the line is as before', () => {
    const t = worthTotal([item('90001')], null, no, false);
    expect(t.line).toBe('1 set on your shelf. Worth about ₹0. Your wallet has questions.');
  });

  it('the default (no last seen lookup) keeps the old behaviour for retired sets', () => {
    const t = worthTotal([item('90001')], null, yes, false);
    expect(t.inr).toBe(0);
    expect(t.lastSeen).toBe(0);
  });
});
