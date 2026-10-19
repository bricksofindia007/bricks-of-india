// Old query-string theme addresses redirect (308) to the path form, with the query removed. Page only, sort only,
// both, and the fallbacks. Tested on the helper and on the middleware that calls it.
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { themeRedirectTarget } from '../src/lib/theme-redirect';
import { middleware } from '../src/middleware';

const target = (path: string, qs: string) => themeRedirectTarget(path, new URLSearchParams(qs));

describe('the target of an old theme address', () => {
  it('page only: /page/N, no query', () => {
    expect(target('/themes/technic', 'page=3')).toBe('/themes/technic/page/3');
  });
  it('sort only: /sort/X, no query', () => {
    expect(target('/themes/technic', 'sort=price-asc')).toBe('/themes/technic/sort/price-asc');
  });
  it('both: /sort/X/page/N, no query', () => {
    expect(target('/themes/technic', 'sort=price-asc&page=2')).toBe('/themes/technic/sort/price-asc/page/2');
  });
  it('page 1 and the default sort go to the bare address', () => {
    expect(target('/themes/technic', 'page=1')).toBe('/themes/technic');
    expect(target('/themes/technic', 'sort=year-desc')).toBe('/themes/technic');
    expect(target('/themes/technic', 'sort=year-desc&page=1')).toBe('/themes/technic');
  });
  it('a page that is not a number, and an unknown sort, fall back and drop the query', () => {
    expect(target('/themes/technic', 'page=abc')).toBe('/themes/technic');
    expect(target('/themes/technic', 'sort=pieces-desc&page=4')).toBe('/themes/technic/page/4');
  });
  it('a request with neither parameter is left alone, and so is any other path', () => {
    expect(target('/themes/technic', 'utm=x')).toBeNull();
    expect(target('/themes/technic/page/3', 'page=3')).toBeNull();
    expect(target('/sets', 'page=3')).toBeNull();
  });
});

describe('the middleware answers with a 308 to that target', () => {
  const get = (path: string) => middleware(new NextRequest(`https://bricksofindia.com${path}`));

  it('?page=3 -> /themes/technic/page/3 (308, no query)', () => {
    const res = get('/themes/technic?page=3');
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://bricksofindia.com/themes/technic/page/3');
  });
  it('?sort=price-asc -> /themes/technic/sort/price-asc (308, no query)', () => {
    const res = get('/themes/technic?sort=price-asc');
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://bricksofindia.com/themes/technic/sort/price-asc');
  });
  it('both -> /themes/technic/sort/price-asc/page/2 (308, no query)', () => {
    const res = get('/themes/technic?sort=price-asc&page=2');
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('https://bricksofindia.com/themes/technic/sort/price-asc/page/2');
  });
  it('a plain path passes through', () => {
    expect(get('/themes/technic').status).toBe(200);
  });
});
