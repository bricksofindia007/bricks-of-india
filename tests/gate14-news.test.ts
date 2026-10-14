import { describe, it, expect } from 'vitest';
import { gate14Check, blocking, type Gate14Facts } from '../src/lib/gate14';
import { isUnverifiableOnly } from '../src/lib/gate14-facts';

const facts = (o: Partial<Gate14Facts> = {}): Gate14Facts => ({
  setNumber: '11387', name: 'Holiday House', pieces: 1354, minifigs: null, year: 2026, prices: [], mrp: [9999], verdict: null, ...o,
});

describe('Gate 14, round 11 (news + advisory minifigure counts)', () => {
  it('an unknown minifigure count is advisory: logged, not blocking', () => {
    const f = gate14Check('It comes with four minifigures.', facts());
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: 'minifigs', advisory: true });
    expect(blocking(f)).toHaveLength(0);
    expect(isUnverifiableOnly(f)).toBe(false);
  });
  it('a minifigure count that contradicts a known one still blocks', () => {
    const f = gate14Check('It comes with four minifigures.', facts({ minifigs: 6 }));
    expect(blocking(f)).toEqual([expect.objectContaining({ rule: 'minifigs', detail: '"four minifigures"; catalogue 6' })]);
  });
  it('news with a set: wrong piece count and an invented import price are caught', () => {
    const f = blocking(gate14Check('The set has 900 pieces. Expect an import price of ₹14,000 in India.', facts()));
    expect(f.map((x) => x.rule).sort()).toEqual(['foreign', 'pieces']);
  });
  it('news without a catalogued set: only price-source and voice rules run', () => {
    const body = 'Over 2,000 pieces and four minifigures. It costs $199.99 in the US. That works out to an estimated ₹21,000. The reviewer loved it. Toycra has it at ₹4,999.';
    const f = gate14Check(body, facts({ setNumber: '', name: '', pieces: null, year: null, mrp: [], noSet: true }));
    expect(f.map((x) => x.rule)).toEqual(['foreign', 'foreign', 'leak']);
  });
  it('news without a set: a sourced foreign price is fine', () => {
    expect(gate14Check('It is US$199.99 on LEGO.com.', facts({ setNumber: '', pieces: null, mrp: [], noSet: true }))).toEqual([]);
  });
});
