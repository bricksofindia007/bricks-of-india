// The theme page's grid, as the server renders it: the header total, the pager, the last page, and the links. Plus the
// page's own rules: a page past the end is not found, and each page's canonical keeps the page number and not the sort.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ThemeGrid } from '../src/components/sets/ThemeGrid';
import { resolveThemePage, canonicalThemePath } from '../src/lib/theme-paging';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

// Sets numbered 10000 onward; each set has one number, so a page's contents can be read off the markup.
const setsFor = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `id-${i}`, set_number: `${10000 + i}`, name: `Set ${i}`, year: 2000, image_url: null, prices: [], summary: null,
  }));

// Render the grid for one page of a theme with `total` sets, the way the page does.
function render(total: number, page: number, sort: 'year-desc' | 'price-asc' = 'year-desc') {
  const res = resolveThemePage(total, String(page));
  if (!res.ok) throw new Error('out of range');
  const onPage = setsFor(total).slice(res.from, res.to);
  return renderToStaticMarkup(
    <ThemeGrid slug="technic" sets={onPage} total={total} page={res.page} pages={res.pages} sort={sort} />,
  );
}

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

describe('a theme under the cap', () => {
  it('30 sets: the header shows 30, there is no pager, and all 30 are on the one page', () => {
    const html = render(30, 1);
    expect(html).toContain('30 sets found');
    expect(html).not.toContain('— page');
    expect(html).not.toContain('aria-label="Pages of sets"');
    expect(html).toContain('10029'); // the last set is on the page
  });
});

describe('exactly 200 sets', () => {
  it('five pages of 48 (the last holds 8): the header says 200, and page 5 links back to 4 with no Next', () => {
    const html = render(200, 5);
    expect(html).toContain('200 sets found');
    expect(html).toContain('— page 5 of 5');
    expect(html).toContain('10199'); // the 200th set is on page 5
    expect(html).not.toContain('10191'); // index 191 is the last set of page 4, so it is not on page 5
    expect(hrefs(html)).toContain('/themes/technic?page=4');
    expect(html).toContain('<span aria-disabled="true"');
  });
});

describe('over 200: the real totals, not the cap', () => {
  it('Technic 918: the header shows 918, not 200; page 1 has 48 and links to page 2', () => {
    const html = render(918, 1);
    expect(html).toContain('918 sets found');
    expect(html).not.toContain('200 sets found');
    expect(html).toContain('— page 1 of 20');
    expect(html).toContain('10047'); // index 47, the last on page 1
    expect(html).not.toContain('10048');
    expect(hrefs(html)).toContain('/themes/technic?page=2');
    expect(hrefs(html)).toContain('/themes/technic?page=20'); // the last page is always reachable
  });
  it('City 1704: the header shows 1704, and there are 36 pages', () => {
    const html = render(1704, 1);
    expect(html).toContain('1704 sets found');
    expect(html).toContain('— page 1 of 36');
  });
});

describe('the last page', () => {
  it('Technic page 20 holds the last 6 sets (912 to 917); Next is off, Previous goes to 19', () => {
    const html = render(918, 20);
    expect(html).toContain('10917');
    expect(html).toContain('10912');
    expect(html).not.toContain('10911');
    expect(hrefs(html)).toContain('/themes/technic?page=19');
    expect(html).toContain('<span aria-disabled="true"');
    expect(html).not.toContain('rel="next"');
  });
  it('City page 36 holds the last 24 (1680 to 1703)', () => {
    const html = render(1704, 36);
    expect(html).toContain('11703');
    expect(html).not.toContain('11679');
  });
});

describe('an out-of-range page', () => {
  it('page 21 of Technic is refused (the page answers not found)', () => {
    expect(resolveThemePage(918, '21')).toEqual({ ok: false, pages: 20 });
  });
  it('the page calls notFound on a refusal, and the metadata canonical is the page number, not the sort', () => {
    const src = read('src/app/themes/[theme]/page.tsx');
    expect(src).toMatch(/if \(!paging\.ok\) notFound\(\);/);
    expect(src).toMatch(/path: canonicalThemePath\(params\.theme, page\)/);
    expect(canonicalThemePath('technic', 21)).toBe('/themes/technic?page=21');
  });
});

describe('the pager and the sort', () => {
  it('pages keep the sort in their links; the default sort is left out', () => {
    const html = render(918, 2, 'price-asc');
    expect(hrefs(html)).toContain('/themes/technic?page=3&amp;sort=price-asc');
    const def = render(918, 2);
    expect(hrefs(def)).toContain('/themes/technic?page=3');
    expect(def).not.toContain('sort=');
  });
  it('the current page is marked, with no link to itself', () => {
    const html = render(918, 3);
    expect(html).toContain('aria-current="page"');
    expect(hrefs(html)).not.toContain('/themes/technic?page=3');
  });
});

describe('the wiring', () => {
  it('the grid reads the whole theme and is no longer a client component holding its own copy of the list', () => {
    const grid = read('src/components/sets/ThemeGrid.tsx');
    expect(grid).not.toContain("'use client'");
    expect(grid).not.toContain('useState');
    expect(read('src/components/sets/ThemeSortSelect.tsx')).toContain("'use client'");
  });
  it('the page has no 200-row cap left', () => {
    const src = read('src/app/themes/[theme]/page.tsx');
    expect(src).not.toMatch(/\.limit\(200\)/);
    expect(src).not.toMatch(/\.slice\(0, 200\)/);
  });
});
