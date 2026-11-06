// Tests for the pure parts of scripts/edge-check.mjs (order 0570 item 3). The network part is not tested here; it is run by
// hand against a host (T1 uses it for the staging proof and the cutover check).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-ignore: plain .mjs script, no type declarations
import { parseArgs, expectationsFor, evaluate, formatRow, DEFAULT_PAGES, BYPASS_PATHS, SIGNED_IN_COOKIE } from '../scripts/edge-check.mjs';

const root = join(__dirname, '..');

describe('parseArgs', () => {
  it('takes the host and uses the default page list when no paths are given', () => {
    const a = parseArgs(['https://staging-edge.bricksofindia.com']);
    expect(a.origin).toBe('https://staging-edge.bricksofindia.com');
    expect(a.paths).toEqual(DEFAULT_PAGES);
    expect(a.timeoutMs).toBe(15000);
  });
  it('takes given paths and a timeout, and keeps only the origin of the host', () => {
    const a = parseArgs(['http://127.0.0.1:8787/some/path', '/sets/1', '/news', '--timeout-ms', '3000']);
    expect(a.origin).toBe('http://127.0.0.1:8787');
    expect(a.paths).toEqual(['/sets/1', '/news']);
    expect(a.timeoutMs).toBe(3000);
  });
  it('refuses a missing host, a non-web host, a path without a slash, and a bad timeout', () => {
    expect(() => parseArgs([])).toThrow(/usage/);
    expect(() => parseArgs(['ftp://x.test'])).toThrow(/https:\/\/ or http:\/\//);
    expect(() => parseArgs(['not a url'])).toThrow(/not a URL/);
    expect(() => parseArgs(['https://x.test', 'news'])).toThrow(/must start with/);
    expect(() => parseArgs(['https://x.test', '--timeout-ms', '0'])).toThrow(/positive/);
  });
});

describe('expectationsFor', () => {
  it('asks for cacheable paths, the admin and API paths, and one signed-in check on the first page', () => {
    const e = expectationsFor(['/', '/sets']);
    expect(e.filter((x) => x.kind === 'cacheable').map((x) => x.path)).toEqual(['/', '/sets']);
    for (const p of BYPASS_PATHS) expect(e).toContainEqual({ path: p, kind: 'bypass', cookie: null });
    expect(e).toContainEqual({ path: '/', kind: 'bypass', cookie: SIGNED_IN_COOKIE });
  });
  it('the signed-in cookie name is the account session cookie', () => {
    expect(SIGNED_IN_COOKIE.startsWith('boi_account=')).toBe(true);
    expect(readFileSync(join(root, 'src/lib/account-session.ts'), 'utf8')).toMatch(/SESSION_COOKIE = 'boi_account'/);
  });
});

const row = (over: Record<string, unknown>) => ({ status: 200, debug: 'miss', cacheControl: 'public, max-age=300', ttfbMs: 40, cookie: null, ...over });

describe('evaluate', () => {
  const expect1 = expectationsFor(['/sets/1']);
  const good = [
    row({ path: '/sets/1', attempt: 1, debug: 'miss' }), row({ path: '/sets/1', attempt: 2, debug: 'hit' }),
    row({ path: '/admin/pending', attempt: 1, debug: 'bypass' }), row({ path: '/admin/pending', attempt: 2, debug: 'bypass' }),
    row({ path: '/api/saved-sets?ids=99001', attempt: 1, debug: 'bypass' }), row({ path: '/api/saved-sets?ids=99001', attempt: 2, debug: 'bypass' }),
    row({ path: '/sets/1', cookie: SIGNED_IN_COOKIE, attempt: 1, debug: 'bypass' }), row({ path: '/sets/1', cookie: SIGNED_IN_COOKIE, attempt: 2, debug: 'bypass' }),
  ];
  it('passes when the page misses then hits and every bypass path bypasses', () => {
    expect(evaluate(expect1, good)).toEqual({ ok: true, failures: [] });
  });
  it('a page that is a hit on the first answer also passes (cache already warm)', () => {
    const warm = good.map((r) => (r.path === '/sets/1' && !r.cookie && r.attempt === 1 ? { ...r, debug: 'hit' } : r));
    expect(evaluate(expect1, warm).ok).toBe(true);
  });
  it('fails when the second answer is not a hit (the page is not being cached)', () => {
    const bad = good.map((r) => (r.path === '/sets/1' && !r.cookie && r.attempt === 2 ? { ...r, debug: 'miss' } : r));
    const res = evaluate(expect1, bad);
    expect(res.ok).toBe(false);
    expect(res.failures.join(' ')).toMatch(/second answer expected hit, got miss/);
  });
  it('fails when an admin or API path is served from the cache', () => {
    const bad = good.map((r) => (r.path === '/admin/pending' && r.attempt === 2 ? { ...r, debug: 'hit' } : r));
    expect(evaluate(expect1, bad).failures.join(' ')).toMatch(/\/admin\/pending: expected bypass, got hit/);
  });
  it('fails when a signed-in request is served from the cache', () => {
    const bad = good.map((r) => (r.cookie && r.attempt === 1 ? { ...r, debug: 'hit' } : r));
    expect(evaluate(expect1, bad).failures.join(' ')).toMatch(/signed-in cookie\): expected bypass, got hit/);
  });
  it('fails on a non-200 first answer and on a missing answer', () => {
    const bad = good.map((r) => (r.path === '/sets/1' && !r.cookie && r.attempt === 1 ? { ...r, status: 500, debug: 'bypass' } : r));
    expect(evaluate(expect1, bad).failures.join(' ')).toMatch(/status 500/);
    const none = good.filter((r) => r.path !== '/sets/1' || r.cookie);
    expect(evaluate(expect1, none).failures.join(' ')).toMatch(/\/sets\/1: no answer|missing answer/);
  });
});

describe('formatRow', () => {
  it('prints status, the debug header and time to first byte on one line', () => {
    const line = formatRow({ path: '/news', cookie: null, attempt: 2, status: 200, debug: 'hit', cacheControl: 'public, max-age=60', ttfbMs: 12 });
    expect(line).toBe('/news #2 status=200 x-boi-edge-cache=hit cache-control="public, max-age=60" ttfb=12ms');
  });
  it('marks a signed-in request and shows a missing header as a dash', () => {
    const line = formatRow({ path: '/sets/1', cookie: SIGNED_IN_COOKIE, attempt: 1, status: 200, debug: null, cacheControl: null, ttfbMs: 99 });
    expect(line).toMatch(/^\/sets\/1 cookie #1 status=200 x-boi-edge-cache=- cache-control="-" ttfb=99ms$/);
  });
});
