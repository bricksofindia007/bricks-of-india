// The shared session read (order 0280 decision 3): one request per page view, none while accounts are off.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sessionStatusFromHttp } from '../src/components/saved/AccountSession';

const root = join(__dirname, '..');
const src = readFileSync(join(root, 'src/components/saved/AccountSession.tsx'), 'utf8');

describe('session status from the server', () => {
  it('200 is signed in; 401 and 404 are signed out; anything else is unavailable', () => {
    expect(sessionStatusFromHttp(200)).toBe('signed-in');
    expect(sessionStatusFromHttp(401)).toBe('signed-out');
    expect(sessionStatusFromHttp(404)).toBe('signed-out');
    expect(sessionStatusFromHttp(503)).toBe('unavailable');
    expect(sessionStatusFromHttp(500)).toBe('unavailable');
  });
});

describe('the provider asks once, and only when enabled', () => {
  it('the read goes to the lists route, uncached', () => {
    expect(src).toContain("fetch('/api/account/lists', { cache: 'no-store' })");
  });

  it('with accounts off the effect makes no request', () => {
    const effect = src.slice(src.indexOf('useEffect'), src.indexOf('return <SessionContext.Provider'));
    expect(effect.indexOf('if (!enabled)')).toBeLessThan(effect.indexOf('fetch('));
    expect(effect).toMatch(/if \(!enabled\) \{\s*setStatus\('signed-out'\);\s*return;\s*\}/);
  });

  it('a failed read is unavailable, never signed in or out', () => {
    expect(src).toContain("setStatus('unavailable')");
  });

  it('the effect runs once per enabled value, not per card', () => {
    expect(src).toMatch(/\}, \[enabled\]\);/);
  });

  it('nothing is stored in the browser', () => {
    expect(src).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });
});
