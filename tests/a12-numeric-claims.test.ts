// A12 numeric claims: a draft's piece count and price must match the database exactly (no rounding).
// A failing draft produces a blocking finding, so it is held for review (never discarded). CI runs these tests,
// so a deliberately bad draft cannot pass.
import { describe, it, expect } from 'vitest';
import { gate14Check, blocking, type Gate14Facts } from '../src/lib/gate14';

const facts = (over: Partial<Gate14Facts> = {}): Gate14Facts => ({
  setNumber: '10305',
  name: 'Lion Knights Castle',
  pieces: 1200,
  minifigs: 4,
  year: 2026,
  prices: [2999],
  mrp: [3299],
  verdict: 'BUY NOW',
  noSet: false,
  ...over,
} as Gate14Facts);

describe('A12: piece count must match the database exactly', () => {
  it('an exact piece count passes', () => {
    const f = blocking(gate14Check('This set has 1,200 pieces and four minifigures.', facts()));
    expect(f.filter((x) => x.rule === 'pieces')).toEqual([]);
  });

  it('a count one piece off is blocked (no rounding allowance)', () => {
    const f = blocking(gate14Check('This set has 1,201 pieces.', facts()));
    expect(f.some((x) => x.rule === 'pieces')).toBe(true);
  });

  it('a count inside the old 2% rounding band is blocked', () => {
    const f = blocking(gate14Check('This set has 1,190 pieces.', facts()));
    expect(f.some((x) => x.rule === 'pieces')).toBe(true);
  });

  it('a piece claim with no catalogue count (zero or missing) is blocked, never passed as zero', () => {
    const f = blocking(gate14Check('This set has 500 pieces.', facts({ pieces: 0 })));
    expect(f.some((x) => x.rule === 'pieces' && /unverifiable/.test(x.detail))).toBe(true);
  });
});

describe('A12: price must match the database exactly', () => {
  it('the displayed price passes', () => {
    const f = blocking(gate14Check('It sells for ₹2,999 in India.', facts()));
    expect(f.filter((x) => x.rule === 'inr')).toEqual([]);
  });

  it('a price one rupee off is blocked (no rounding allowance)', () => {
    const f = blocking(gate14Check('It sells for ₹3,000 in India.', facts()));
    expect(f.some((x) => x.rule === 'inr')).toBe(true);
  });
});

// The piece-count chip on the set card and the set page shows only a positive count. Zero, missing, or
// "not confirmed" text never render.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = join(__dirname, '..');
describe('A12: piece-count chip renders only a positive count', () => {
  for (const f of ['src/components/sets/SetCard.tsx', 'src/app/sets/[slug]/page.tsx']) {
    it(`${f} renders the chip only for a positive count, returning null otherwise`, () => {
      const src = readFileSync(join(root, f), 'utf8');
      expect(src).toMatch(/set\.pieces != null && set\.pieces > 0 \? .*pcs.* : null\}/);
      expect(src).not.toMatch(/not confirmed/);
    });
  }
});
