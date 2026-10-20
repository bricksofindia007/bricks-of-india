// Structured data and metadata on the theme routes: page one, page N and sorted views. The ItemList counts the whole
// theme (not the page), lists at most ten items, and carries positions from 1. Titles name the page for pages 2 and up.
// Sorted views are noindex and canonical to the default-sort address for their page.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemePageBody } from '../src/components/themes/ThemePageBody';
import { themeRouteMetadata } from '../src/lib/theme-metadata';
import type { ThemeView } from '../src/lib/theme-page-data';

const setsFor = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`, set_number: `${10000 + i}`, name: `Technic Set ${i}`, year: 2024, image_url: null,
    prices: [{ is_active: true, price_inr: 1000 + i, store_name: 'lego_in', buy_url: `https://x.example/${i}`, in_stock: true, scraped_at: '2026-10-19' }],
    summary: null,
  }));

function view(page: number, total: number, sort: ThemeView['sort'] = 'year-desc', n = 48): ThemeView {
  return { theme: { name: 'Technic', slug: 'technic' }, sort, total, page, pages: Math.ceil(total / 48), sets: setsFor(n) };
}

function jsonLd(html: string): any {
  const m = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no JSON-LD');
  return JSON.parse(m[1]);
}

describe('ItemList structured data', () => {
  it('page one: counts the whole theme, lists ten items, positions from 1', () => {
    const data = jsonLd(renderToStaticMarkup(<ThemePageBody view={view(1, 918, 'year-desc', 48)} />));
    expect(data['@type']).toBe('ItemList');
    expect(data.numberOfItems).toBe(918);
    expect(data.itemListElement).toHaveLength(10);
    expect(data.itemListElement.map((x: any) => x.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
  it('page N: still counts the whole theme, not the page', () => {
    const data = jsonLd(renderToStaticMarkup(<ThemePageBody view={view(20, 918, 'year-desc', 6)} />));
    expect(data.numberOfItems).toBe(918);
    expect(data.itemListElement).toHaveLength(6);
  });
  it('a sorted view: the same whole-theme count', () => {
    const data = jsonLd(renderToStaticMarkup(<ThemePageBody view={view(1, 918, 'price-asc', 48)} />));
    expect(data.numberOfItems).toBe(918);
  });
  it('the list name names the theme', () => {
    const data = jsonLd(renderToStaticMarkup(<ThemePageBody view={view(1, 918)} />));
    expect(data.name).toBe('LEGO Technic Sets in India');
  });
  it('the JSON-LD escapes "<" so it cannot close the script tag early', () => {
    const v = view(1, 1);
    v.sets[0].name = 'Set </script><b>x';
    const html = renderToStaticMarkup(<ThemePageBody view={v} />);
    expect(html).not.toContain('</script><b>x');
    expect(jsonLd(html).itemListElement[0].item.name).toBe('Set </script><b>x');
  });
});

describe('metadata by route shape', () => {
  it('page one: indexed, bare canonical, no page suffix', () => {
    const m = themeRouteMetadata('technic', 1, null);
    expect(String(m.title)).not.toMatch(/Page \d/);
    expect(m.robots).toBeUndefined();
    expect(m.alternates?.canonical).toBe('https://bricksofindia.com/themes/technic');
  });
  it('page N: indexed, own canonical, title names the page', () => {
    const m = themeRouteMetadata('technic', 2, null);
    expect(String(m.title)).toMatch(/— Page 2$/);
    expect(m.robots).toBeUndefined();
    expect(m.alternates?.canonical).toBe('https://bricksofindia.com/themes/technic/page/2');
  });
  it('sorted views: noindex, follow, canonical to the default address for the same page', () => {
    const one = themeRouteMetadata('technic', 1, 'price-asc');
    expect(one.robots).toEqual({ index: false, follow: true });
    expect(one.alternates?.canonical).toBe('https://bricksofindia.com/themes/technic');
    const two = themeRouteMetadata('technic', 2, 'price-asc');
    expect(two.robots).toEqual({ index: false, follow: true });
    expect(two.alternates?.canonical).toBe('https://bricksofindia.com/themes/technic/page/2');
  });
  it('each page number has its own title, so no two pages share one', () => {
    const titles = [1, 2, 20].map((n) => String(themeRouteMetadata('technic', n, null).title));
    expect(new Set(titles).size).toBe(3);
  });
});
