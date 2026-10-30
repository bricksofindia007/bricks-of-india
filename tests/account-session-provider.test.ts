// The shared session read (order 0280 decision 3): one request per page view, none while accounts are off, and saves
// applied to the shared lists at once.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sessionStatusFromHttp, applyLocalChange } from '../src/components/saved/AccountSession';
import type { Lists } from '../src/lib/account-lists';

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

describe('a save is applied to the shared lists at once', () => {
  const base: Lists = {
    wishlist: [{ set: '90001', qty: 1, added_at: '2026-10-20T10:00:00Z' }],
    collection: [{ set: '90002', qty: 2, added_at: '2026-10-21T10:00:00Z' }],
  };

  it('adding puts the row first and changes only that list', () => {
    const next = applyLocalChange(base, 'wishlist', '90003', { set: '90003', qty: 1, added_at: '2026-10-30T10:00:00Z' });
    expect(next.wishlist.map((i) => i.set)).toEqual(['90003', '90001']);
    expect(next.collection).toBe(base.collection);
  });

  it('removing takes the set out of that list only', () => {
    const next = applyLocalChange(base, 'collection', '90002', null);
    expect(next.collection).toEqual([]);
    expect(next.wishlist).toBe(base.wishlist);
  });

  it('a set already on the list is replaced, never duplicated', () => {
    const next = applyLocalChange(base, 'wishlist', '90001', { set: '90001', qty: 1, added_at: '2026-10-30T10:00:00Z' });
    expect(next.wishlist.filter((i) => i.set === '90001')).toHaveLength(1);
  });

  it('does not change the input', () => {
    applyLocalChange(base, 'wishlist', '90009', null);
    expect(base.wishlist).toHaveLength(1);
  });
});

describe('the provider asks once, and only when enabled', () => {
  it('the read goes to the lists route, uncached, with names only when asked', () => {
    expect(src).toContain("fetch(`/api/account/lists${withNames ? '?names=1' : ''}`, { cache: 'no-store' })");
  });

  it('with accounts off the effect makes no request', () => {
    const effect = src.slice(src.indexOf('useEffect'), src.indexOf('return <AccountContext.Provider'));
    expect(effect.indexOf('if (!enabled)')).toBeLessThan(effect.indexOf('fetch('));
    expect(effect).toMatch(/if \(!enabled\) \{\s*setStatus\('signed-out'\);\s*setLists\(null\);\s*return;\s*\}/);
  });

  it('a failed read is unavailable and holds no lists, never signed in or out', () => {
    expect(src).toContain("setStatus('unavailable');");
    expect(src).toMatch(/\.catch\(\(\) => \{\s*if \(live\) \{\s*setStatus\('unavailable'\);\s*setLists\(null\);/);
  });

  it('a signed-in answer without lists is unavailable, not signed in', () => {
    expect(src).toMatch(/if \(j\?\.lists\) \{\s*setStatus\('signed-in'\);[\s\S]*?\} else \{\s*setStatus\('unavailable'\);/);
  });

  it('the effect runs once per enabled and withNames value, not per card', () => {
    expect(src).toMatch(/\}, \[enabled, withNames\]\);/);
  });

  it('nothing is stored in the browser', () => {
    expect(src).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });
});
