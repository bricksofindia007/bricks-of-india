// No store name is hard-coded in the price helper. Store display names come from the registry, passed in by each page.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { storeName } from '../src/lib/price-summary';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

describe('store names come from the registry', () => {
  it('the price helper names no store', () => {
    const src = read('src/lib/price-summary.ts');
    expect(src).not.toMatch(/LEGO\.in|Toycra|mybrickhouse/);
  });

  it('storeName uses the registry map it is given', () => {
    expect(storeName({ shop_a: 'Shop A' }, 'shop_a')).toBe('Shop A');
  });

  it('a store missing from the registry shows a neutral label, never its id or a guessed name', () => {
    expect(storeName({}, 'unknown_store')).toBe('a single store');
  });

  for (const f of [
    'src/app/compare/page.tsx',
    'src/app/deals/page.tsx',
    'src/app/page.tsx',
    'src/app/sets/page.tsx',
    'src/app/sets/[slug]/page.tsx',
    'src/app/themes/[theme]/page.tsx',
  ]) {
    it(`${f} passes the registry names to its set cards`, () => {
      expect(read(f)).toMatch(/storeNames=\{(storeNames|STORE_NAMES)\}/);
    });
  }

  it('the theme grid passes the names on to its cards', () => {
    expect(read('src/components/sets/ThemeGrid.tsx')).toMatch(/storeNames=\{storeNames\}/);
  });
});
