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
  it('sorted views are forced dynamic', () => {
    expect(read('src/app/themes/[theme]/sort/[sort]/page.tsx')).toMatch(/export const dynamic = 'force-dynamic';/);
    expect(read('src/app/themes/[theme]/sort/[sort]/page/[page]/page.tsx')).toMatch(/export const dynamic = 'force-dynamic';/);
  });
  it('a sort outside the options, and the default sort reached by its own path, are not served as a second list', () => {
    expect(read('src/app/themes/[theme]/sort/[sort]/page.tsx')).toMatch(/if \(!isThemeSort\(sort\)\) notFound\(\);/);
    expect(read('src/app/themes/[theme]/sort/[sort]/page.tsx')).toMatch(/if \(sort === 'year-desc'\) permanentRedirect/);
  });
});

describe('query-string links redirect to the path form (308)', () => {
  type Rule = { source: string; has?: { type: string; key: string; value?: string }[]; destination: string; permanent: boolean };
  const rules = (): Promise<Rule[]> =>
    (import('../next.config.mjs') as Promise<{ default: { redirects: () => Promise<Rule[]> } }>)
      .then((m) => m.default.redirects());

  it('?page=N goes to /page/N, permanently', async () => {
    const r = (await rules()).find((x) => x.destination === '/themes/:theme/page/:page');
    expect(r).toBeTruthy();
    expect(r!.permanent).toBe(true);
    expect(r!.has?.[0]).toMatchObject({ type: 'query', key: 'page' });
  });
  it('?sort=X goes to /sort/X, permanently, for the four non-default sorts', async () => {
    const r = (await rules()).find((x) => x.destination === '/themes/:theme/sort/:sort');
    expect(r).toBeTruthy();
    expect(r!.permanent).toBe(true);
    expect(r!.has?.[0].value).toBe('(?<sort>price-asc|price-desc|year-asc|year-desc)');
  });
  it('a link with both parameters goes straight to the sorted page, and that rule comes first', async () => {
    const list = await rules();
    const both = list.findIndex((x) => x.destination === '/themes/:theme/sort/:sort/page/:page');
    const sortOnly = list.findIndex((x) => x.destination === '/themes/:theme/sort/:sort');
    const pageOnly = list.findIndex((x) => x.destination === '/themes/:theme/page/:page');
    expect(both).toBeGreaterThanOrEqual(0);
    expect(both).toBeLessThan(sortOnly);
    expect(both).toBeLessThan(pageOnly);
  });
  it('page numbers the redirect takes are 2 and up; page 1 and 0 stay on the bare address', async () => {
    const r = (await rules()).find((x) => x.destination === '/themes/:theme/page/:page');
    const re = new RegExp(`^${r!.has![0].value}$`);
    expect(re.test('2')).toBe(true);
    expect(re.test('20')).toBe(true);
    expect(re.test('1')).toBe(false);
    expect(re.test('0')).toBe(false);
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
    for (const s of ['pieces-desc', 'nonsense', '']) expect(isThemeSort(s)).toBe(false);
  });
});
