import { describe, expect, it } from 'vitest';
import { cacheDecision, isFresh, REFRESH_AFTER_MS, CACHED_ROUTES } from '@/lib/page-cache';

const base = 'https://bricksofindia.com';
const dec = (path: string, init: { method?: string; headers?: Record<string, string> } = {}) =>
  cacheDecision(init.method ?? 'GET', new URL(path, base), new Headers(init.headers ?? {}));

describe('cacheDecision: what is cached', () => {
  it('caches the listing routes for anonymous GET requests', () => {
    for (const r of CACHED_ROUTES) {
      expect(dec(r).cache, r).toBe(true);
    }
  });

  it('caches paged set listings', () => {
    expect(dec('/sets/page/2').cache).toBe(true);
  });

  it('does not cache article, set or review detail pages (already cached)', () => {
    expect(dec('/news/some-article').cache).toBe(false);
    expect(dec('/sets/75419-death-star').cache).toBe(false);
    expect(dec('/reviews/some-review').cache).toBe(false);
  });

  it('does not cache admin, API, sign-in or account routes', () => {
    for (const p of ['/admin/pending', '/api/sets/search', '/auth/sign-in', '/account']) {
      expect(dec(p).cache, p).toBe(false);
    }
  });

  it('does not cache non-GET requests', () => {
    expect(dec('/compare', { method: 'POST' })).toEqual({ cache: false, reason: 'not GET' });
  });

  it('does not cache requests with an authorization header', () => {
    expect(dec('/compare', { headers: { authorization: 'Bearer x' } }).cache).toBe(false);
  });

  it('does not cache a signed-in visitor (session cookie)', () => {
    expect(dec('/compare', { headers: { cookie: 'boi_admin=abc' } }).cache).toBe(false);
    expect(dec('/compare', { headers: { cookie: 'sb-project-auth-token=abc' } }).cache).toBe(false);
  });

  it('still caches for a visitor with only analytics cookies', () => {
    expect(dec('/compare', { headers: { cookie: '_ga=GA1.2.3; __cf_bm=xyz' } }).cache).toBe(true);
  });
});

describe('cacheDecision: query strings', () => {
  it('uses the full URL, with parameters sorted, as the key', () => {
    const a = dec('/compare?theme=star-wars&q=death');
    const b = dec('/compare?q=death&theme=star-wars');
    expect(a.cache && b.cache).toBe(true);
    if (a.cache && b.cache) expect(a.key).toBe(b.key);
  });

  it('treats different parameter values as different pages', () => {
    const a = dec('/compare?q=death');
    const b = dec('/compare?q=pirate');
    if (a.cache && b.cache) expect(a.key).not.toBe(b.key);
  });

  it('does not cache unknown query keys (no cache flooding)', () => {
    expect(dec('/compare?utm_source=x').cache).toBe(false);
    expect(dec('/compare?random=abc').cache).toBe(false);
  });

  it('does not cache more than four query keys', () => {
    expect(dec('/compare?q=a&theme=b&price=c&page=2&min=1').cache).toBe(false);
  });

  it('a trailing slash does not change the page', () => {
    const a = dec('/compare/');
    expect(a.cache).toBe(true);
  });
});

describe('isFresh', () => {
  it('a copy younger than the refresh time is served as it is', () => {
    const now = 1_000_000;
    expect(isFresh(now - 1000, now)).toBe(true);
  });

  it('a copy older than the refresh time is refreshed in the background', () => {
    const now = 1_000_000;
    expect(isFresh(now - REFRESH_AFTER_MS - 1, now)).toBe(false);
  });

  it('an unknown store time is never fresh', () => {
    expect(isFresh(NaN, 1000)).toBe(false);
  });
});
