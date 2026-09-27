import { describe, it, expect } from 'vitest';
import { SETS_PRICE_BANDS, BUDGET_QUICK_RANGES } from '../src/lib/price-bands';
import { PRICE_RANGES } from '../src/lib/brand';

// #381: every price-band label must state exactly its own bounds.
const num = (s: string) => Number(s.replace(/[₹,]/g, ''));
function labelBounds(label: string): { lo: number | null; hi: number | null } {
  let m = label.match(/^Under (₹[\d,]+)$/);
  if (m) return { lo: 0, hi: num(m[1]) };
  m = label.match(/^(₹[\d,]+)\+$/);
  if (m) return { lo: num(m[1]), hi: null };
  m = label.match(/^(₹[\d,]+)–₹?([\d,]+)$/);
  if (m) return { lo: num(m[1]), hi: num(m[2]) };
  throw new Error(`unrecognised band label: ${label}`);
}

// inclusive max may be the boundary or boundary-1; open-ended bands have a huge max.
function check(b: { label: string; min: number; max: number }) {
  const { lo, hi } = labelBounds(b.label);
  expect(b.min, b.label).toBe(lo);
  if (hi === null) expect(b.max, b.label).toBeGreaterThanOrEqual(999_999);
  else expect([hi, hi - 1], b.label).toContain(b.max);
}

describe('price-band labels match their bounds (#381)', () => {
  it('/sets filter bands', () => Object.values(SETS_PRICE_BANDS).forEach(check));
  it('budget calculator quick ranges', () => BUDGET_QUICK_RANGES.forEach(check));
  it('compare-page PRICE_RANGES', () => PRICE_RANGES.forEach((r) => check({ ...r, max: r.max === Infinity ? Number.MAX_SAFE_INTEGER : r.max })));
});
