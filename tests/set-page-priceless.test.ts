// The Priceless line on a set page (order 0420, D-2026-10-31-04 and -05). Added under the existing text, for retired or
// pre-2020 sets with no price and no US estimate. Every existing line stays. The switch is off in both flag files.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setPagePricelessLine } from '../src/lib/set-page-priceless';
import { RETIRED_LINE } from '../src/lib/collection-worth';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const base = { lego_mrp_inr: null, mrp_verified: null, retired: false, year: 2024 };

describe('the switch is off in both flag files', () => {
  it('src/lib/feature-flags.ts has setPagePriceless: false', () => {
    expect(read('src/lib/feature-flags.ts')).toMatch(/setPagePriceless: false,/);
  });
  it('config/feature_flags.py has set_page_priceless: False', () => {
    expect(read('config/feature_flags.py')).toMatch(/"set_page_priceless": False,/);
  });
});

describe('the line appears for these sets only', () => {
  it('a retired set with no price and no US estimate shows approved line 3', () => {
    expect(setPagePricelessLine({ ...base, retired: true }, false, false)).toBe(RETIRED_LINE);
  });
  it('a set from 2019 with no price and no US estimate shows approved line 3', () => {
    expect(setPagePricelessLine({ ...base, year: 2019 }, false, false)).toBe(RETIRED_LINE);
  });
  it('the line is the approved text, copied from the constant', () => {
    expect(RETIRED_LINE).toBe('Priceless. You could make a mini fortune on the secondary market.');
  });
});

describe('sets that show something today keep exactly what they show (no line added)', () => {
  it('a set with a store price', () => {
    expect(setPagePricelessLine({ ...base, retired: true }, true, false)).toBeNull();
  });
  it('a set with a US estimate', () => {
    expect(setPagePricelessLine({ ...base, retired: true }, false, true)).toBeNull();
  });
  it('a set with a verified LEGO India price', () => {
    expect(setPagePricelessLine({ ...base, retired: true, lego_mrp_inr: 9999, mrp_verified: true }, false, false)).toBeNull();
  });
  it('a current set (2020 or later, not retired) with no price', () => {
    expect(setPagePricelessLine({ ...base, year: 2020 }, false, false)).toBeNull();
    expect(setPagePricelessLine({ ...base, year: 2025 }, false, false)).toBeNull();
  });
  it('a set with no year and not retired', () => {
    expect(setPagePricelessLine({ ...base, year: null }, false, false)).toBeNull();
  });
});

describe('the page keeps every existing line and adds the Priceless line once, under the existing text', () => {
  const page = read('src/app/sets/[slug]/page.tsx');
  it('the existing store-row and FAQ lines are still there, once each', () => {
    expect(page.split('No listing found at {store.name}.').length - 1).toBe(1);
    expect(page.split('We\'re currently setting up price tracking for ${set.name}.').length - 1).toBe(1);
    expect(page.split('COMPARE PRICES IN INDIA').length - 1).toBe(1);
  });
  it('the Priceless line is gated by the switch and by the helper, and renders nothing when null', () => {
    expect(page).toMatch(/const priceless = FEATURE_FLAGS\.setPagePriceless\s*\?\s*setPagePricelessLine\(/);
    expect(page).toMatch(/\{priceless && <p className="text-sm text-gray-600 mb-4">\{priceless\}<\/p>\}/);
  });
  it('the Priceless line sits after the comparison box and before the staleness note', () => {
    const box = page.indexOf('COMPARE PRICES IN INDIA');
    const line = page.indexOf('{priceless && <p');
    const stale = page.indexOf('{/* Staleness indicator */}');
    expect(box).toBeLessThan(line);
    expect(line).toBeLessThan(stale);
  });
  it('the page reads no cookies or headers (G1)', () => {
    expect(page).not.toMatch(/from 'next\/headers'/);
  });
});
