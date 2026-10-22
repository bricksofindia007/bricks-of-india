// Theme addresses: page one and /page/[n] are static (cached a day); sorted views are per request, noindex, and
// canonical to the default-sort page of the same number. Old query-string links redirect (308) to the path form.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isThemeSort, themeHref, canonicalThemePath } from '../src/lib/theme-paging';
import { themeRouteMetadata } from '../src/lib/theme-metadata';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

describe('route files', () => {
  it('the four theme address shapes each have a page', () => {
    for (const f of [
      'src/app/themes/[theme]/page.tsx',
      'src/app/themes/[theme]/page/[page]/page.tsx',
      'src/app/themes/[theme]/sort/[sort]/page.tsx',
      'src/app/themes/[theme]/sort/[sort]/page/[page]/page.tsx',
    ]) {
      expect(existsSync(join(root, f)), f).toBe(true);
    }
  });
  it('page one and /page/[n] are static on the day cadence', () => {
    expect(read('src/app/themes/[theme]/page.tsx')).toMatch(/export const revalidate = 86400;/);
    expect(read('src/app/themes/[theme]/page.tsx')).not.toMatch(/searchParams/);
    expect(read('src/app/themes/[theme]/page/[page]/page.tsx')).toMatch(/export const revalidate = 86400;/);
    expect(read('src/app/themes/[theme]/page/[page]/page.tsx')).toMatch(/export const dynamicParams = true;/);
  });
  it('sorted views are cached daily, not rendered per request (queue item 1: per-request CPU)', () => {
    expect(read('src/app/themes/[theme]/sort/[sort]/page.tsx')).toMatch(/export const revalidate = 86400;/);
    expect(read('src/app/themes/[theme]/sort/[sort]/page.tsx')).not.toMatch(/force-dynamic/);
    expect(read('src/app/themes/[theme]/sort/[sort]/page/[page]/page.tsx')).toMatch(/export const revalidate = 86400;/);
    expect(read('src/app/themes/[theme]/sort/[sort]/page/[page]/page.tsx')).not.toMatch(/force-dynamic/);
  });
  it('a sort outside the options, and the default sort reached by its own path, are not served as a second list', () => {
    expect(read('src/app/themes/[theme]/sort/[sort]/page.tsx')).toMatch(/if \(!isThemeSort\(sort\)\) notFound\(\);/);
    expect(read('src/app/themes/[theme]/sort/[sort]/page.tsx')).toMatch(/if \(sort === 'year-desc'\) permanentRedirect/);
  });
});

describe('metadata', () => {
  it('page one is indexed with the bare address as canonical', () => {
    const m = themeRouteMetadata('technic', 1, null);
    expect(m.alternates?.canonical).toBe('https://bricksofindia.com/themes/technic');
    expect(m.robots).toBeUndefined();
  });
  it('page N is indexed with its own address as canonical, titled with its number', () => {
    const m = themeRouteMetadata('technic', 20, null);
    expect(m.alternates?.canonical).toBe('https://bricksofindia.com/themes/technic/page/20');
    expect(String(m.title)).toMatch(/Page 20/);
  });
  it('a sorted view is noindex, follow, and canonical to the default address for its page', () => {
    const one = themeRouteMetadata('technic', 1, 'price-asc');
    expect(one.robots).toEqual({ index: false, follow: true });
    expect(one.alternates?.canonical).toBe('https://bricksofindia.com/themes/technic');
    const three = themeRouteMetadata('technic', 3, 'price-asc');
    expect(three.robots).toEqual({ index: false, follow: true });
    expect(three.alternates?.canonical).toBe('https://bricksofindia.com/themes/technic/page/3');
  });
});

describe('address helpers', () => {
  it('sorted and paged addresses are the path form', () => {
    expect(themeHref('technic', { sort: 'price-asc', page: 3 })).toBe('/themes/technic/sort/price-asc/page/3');
    expect(themeHref('technic', { sort: 'year-desc', page: 2 })).toBe('/themes/technic/page/2');
    expect(canonicalThemePath('city', 36)).toBe('/themes/city/page/36');
  });
  it('isThemeSort accepts the four sorts and the default, and nothing else', () => {
    for (const s of ['price-asc', 'price-desc', 'year-asc', 'year-desc']) expect(isThemeSort(s)).toBe(true);
    expect(isThemeSort('pieces-desc')).toBe(true);
    for (const s of ['nonsense', '']) expect(isThemeSort(s)).toBe(false);
  });
});
