// Theme paging: a theme under the old cap, exactly 200, over 200 (Technic 918, City 1704), the last page, an
// out-of-range page, the header total, the two-query merge, the sort rules, and the reads that page through every row.
import { describe, it, expect } from 'vitest';
import {
  THEME_PAGE_SIZE, THEME_SORT_OPTIONS, parseThemePage, parseThemeSort, pageCount, resolveThemePage, mergeThemeRows, sortThemeRows,
  themeHref, canonicalThemePath, fetchAllRows,
} from '../src/lib/theme-paging';

type Row = { set_number: string; year: number | null; num_parts?: number };
const rows = (n: number, prefix = 's', year = (i: number) => 2000 + (i % 25)): Row[] =>
  Array.from({ length: n }, (_, i) => ({ set_number: `${prefix}${i}`, year: year(i) }));

describe('page size and page count', () => {
  it('a page shows 48 sets', () => {
    expect(THEME_PAGE_SIZE).toBe(48);
  });
  it('page counts: empty and under one page are one page; exactly 200 is 5 pages; 918 is 20; 1704 is 36', () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(30)).toBe(1);
    expect(pageCount(48)).toBe(1);
    expect(pageCount(49)).toBe(2);
    expect(pageCount(200)).toBe(5);
    expect(pageCount(918)).toBe(20);
    expect(pageCount(1704)).toBe(36);
  });
});

describe('a theme under the cap', () => {
  it('30 sets: one page, the whole list, no further pages', () => {
    const r = resolveThemePage(30, undefined);
    expect(r).toEqual({ ok: true, page: 1, pages: 1, from: 0, to: 30 });
  });
});

describe('exactly 200 sets', () => {
  it('the last of five pages holds the last 8 sets', () => {
    const r = resolveThemePage(200, '5');
    expect(r).toEqual({ ok: true, page: 5, pages: 5, from: 192, to: 200 });
  });
});

describe('over 200: Technic 918 and City 1704', () => {
  it('Technic: 20 pages; page 19 is full, the last page (20) holds 6', () => {
    expect(resolveThemePage(918, '19')).toEqual({ ok: true, page: 19, pages: 20, from: 864, to: 912 });
    expect(resolveThemePage(918, '20')).toEqual({ ok: true, page: 20, pages: 20, from: 912, to: 918 });
  });
  it('City: 36 pages; the last holds 24', () => {
    expect(resolveThemePage(1704, '36')).toEqual({ ok: true, page: 36, pages: 36, from: 1680, to: 1704 });
  });
  it('the Technic list really has 918 distinct sets after the merge, not 200', () => {
    const byName = rows(900, 'n');
    const mapped = [...rows(18, 'm'), ...rows(5, 'n')]; // five overlap with the first list
    expect(mergeThemeRows(byName, mapped)).toHaveLength(918);
  });
});

describe('the last page and an out-of-range page', () => {
  it('the last page of Technic is page 20 with 6 sets', () => {
    const r = resolveThemePage(918, '20');
    expect(r.ok && r.to - r.from).toBe(6);
  });
  it('page 21 of Technic is out of range (the page answers not found)', () => {
    expect(resolveThemePage(918, '21')).toEqual({ ok: false, pages: 20 });
  });
  it('an empty theme has no page 2', () => {
    expect(resolveThemePage(0, '2')).toEqual({ ok: false, pages: 1 });
  });
});

describe('the page number and sort as the URL gives them', () => {
  it('a missing, zero, negative or non-numeric page is page 1, as /sets reads it', () => {
    expect(parseThemePage(undefined)).toBe(1);
    expect(parseThemePage('0')).toBe(1);
    expect(parseThemePage('-3')).toBe(1);
    expect(parseThemePage('abc')).toBe(1);
    expect(parseThemePage('7')).toBe(7);
  });
  it('an unknown sort falls back to Newest First', () => {
    expect(parseThemeSort(undefined)).toBe('year-desc');
    expect(parseThemeSort('nonsense')).toBe('year-desc');
    expect(parseThemeSort('price-asc')).toBe('price-asc');
  });
});

describe('the two-query merge rule', () => {
  it('a set in both lists appears once, at its first place; the result is newest first', () => {
    const byName = [{ set_number: 'a', year: 2020 }, { set_number: 'b', year: 2024 }];
    const mapped = [{ set_number: 'b', year: 2024 }, { set_number: 'c', year: 2022 }];
    expect(mergeThemeRows(byName, mapped).map((r) => r.set_number)).toEqual(['b', 'c', 'a']);
  });
});

describe('the sort rules, as the grid had them', () => {
  const data = [
    { set_number: 'x', year: 2020 },
    { set_number: 'y', year: 2024 },
    { set_number: 'z', year: 2022 },
  ];
  const price: Record<string, number | null> = { x: 500, y: null, z: 300 };
  const priceOf = (r: { set_number: string }) => price[r.set_number] ?? null;

  it('price low to high: sets with no price last', () => {
    expect(sortThemeRows(data, 'price-asc', priceOf).map((r) => r.set_number)).toEqual(['z', 'x', 'y']);
  });
  it('price high to low: sets with no price last too', () => {
    expect(sortThemeRows(data, 'price-desc', priceOf).map((r) => r.set_number)).toEqual(['x', 'z', 'y']);
  });
  it('newest and oldest first by year', () => {
    expect(sortThemeRows(data, 'year-desc', priceOf).map((r) => r.set_number)).toEqual(['y', 'z', 'x']);
    expect(sortThemeRows(data, 'year-asc', priceOf).map((r) => r.set_number)).toEqual(['x', 'z', 'y']);
  });
  it('equal prices keep their order (the merged, newest-first order)', () => {
    const same = [{ set_number: 'p', year: 2024 }, { set_number: 'q', year: 2020 }];
    expect(sortThemeRows(same, 'price-asc', () => 100).map((r) => r.set_number)).toEqual(['p', 'q']);
  });
});

describe('Most Pieces is not offered (no parts count exists on the set rows)', () => {
  it('the sort options have no pieces option', () => {
    expect(THEME_SORT_OPTIONS.map((o) => o.value)).not.toContain('pieces-desc');
    expect(THEME_SORT_OPTIONS.map((o) => o.label)).not.toContain('Most Pieces');
  });
  it('an old link with ?sort=pieces-desc falls back to Newest First, as any unknown sort does', () => {
    expect(parseThemeSort('pieces-desc')).toBe('year-desc');
    expect(themeHref('technic', { sort: parseThemeSort('pieces-desc') })).toBe('/themes/technic');
  });
});

describe('addresses', () => {
  it('pages and sorts have path addresses; the default sort is not repeated; the sort is kept out of the canonical', () => {
    expect(themeHref('technic')).toBe('/themes/technic');
    expect(themeHref('technic', { page: 1, sort: 'year-desc' })).toBe('/themes/technic');
    expect(themeHref('technic', { page: 3 })).toBe('/themes/technic/page/3');
    expect(themeHref('technic', { page: 2, sort: 'price-asc' })).toBe('/themes/technic/sort/price-asc/page/2');
    expect(themeHref('technic', { sort: 'price-asc' })).toBe('/themes/technic/sort/price-asc');
    expect(canonicalThemePath('technic', 1)).toBe('/themes/technic');
    expect(canonicalThemePath('technic', 4)).toBe('/themes/technic/page/4');
  });
});

describe('reading every row', () => {
  it('a 2,500-row read takes three requests of 1000, 1000 and 500', async () => {
    const calls: Array<[number, number]> = [];
    const data = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
    const out = await fetchAllRows(async (from, to) => {
      calls.push([from, to]);
      return { data: data.slice(from, to + 1), error: null };
    });
    expect(out).toHaveLength(2500);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it('a failed read throws, so the page cannot show "no sets" for a failure', async () => {
    await expect(fetchAllRows(async () => ({ data: null, error: { message: 'down' } }))).rejects.toThrow('theme read failed');
  });
});
