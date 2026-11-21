// Order 1953 decision 5 (release-4): (a) /sets query variants and the list's stale window at the edge, (b) parallel reads
// for the default order and the theme index. Part (c) (theme best price from set_price_summary) is removed, so the theme
// index keeps reading store_prices.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mapWithConcurrency } from '../src/lib/concurrency';
import { loadAllSetsOrder } from '../src/lib/sets-order';
import {
  handleWithEdgeCache, setsListQueryAllowed, storedAgeSeconds, SETS_LIST_EDGE_TTL_SECONDS, SETS_LIST_STALE_WINDOW_SECONDS,
  type EdgeStore,
} from '../worker/edge-cache';

afterEach(() => { vi.useRealTimers(); });

describe('mapWithConcurrency', () => {
  it('keeps input order and never exceeds the limit', async () => {
    let inFlight = 0; let peak = 0;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      inFlight++; peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5 - (n % 3)));
      inFlight--;
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60, 70]);
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it('returns [] for no items and rejects on the first error', async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
    await expect(mapWithConcurrency([1, 2, 3], 2, async (n) => { if (n === 2) throw new Error('boom'); return n; })).rejects.toThrow('boom');
  });
});

// Fake sets table: rows sorted like the query (year desc, set_number desc); range() returns a slice and tracks parallelism.
function fakeSetsClient(rows: { set_number: string; year: number; theme: string }[], failOffset?: number) {
  const sorted = [...rows].sort((a, b) =>
    b.year - a.year || (a.set_number < b.set_number ? 1 : a.set_number > b.set_number ? -1 : 0));
  const stats = { inFlight: 0, peak: 0, ranges: [] as number[] };
  const sb = {
    from: (_table: string) => ({
      select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.head) return Promise.resolve({ count: rows.length, error: null });
        return {
          order: () => ({ order: () => ({ range: async (a: number) => {
            stats.inFlight++; stats.peak = Math.max(stats.peak, stats.inFlight); stats.ranges.push(a);
            await new Promise((r) => setTimeout(r, 2));
            stats.inFlight--;
            if (failOffset === a) return { data: null, error: new Error('read failed') };
            return { data: sorted.slice(a, a + 1000), error: null };
          } }) }),
        };
      },
    }),
  };
  return { sb: sb as any, stats, sorted };
}

describe('loadAllSetsOrder (default /sets order, parallel pages)', () => {
  const rows = Array.from({ length: 2500 }, (_, i) => ({
    set_number: `${10000 + i}-1`, year: 2000 + (i % 27), theme: 'T',
  }));

  it('returns every set in the same order as one ordered read, using parallel pages', async () => {
    const { sb, stats, sorted } = fakeSetsClient(rows);
    const out = await loadAllSetsOrder(sb, 1000, 6);
    expect(out.map((r) => r.set_number)).toEqual(sorted.map((r) => r.set_number));
    expect(out.length).toBe(2500);
    expect(stats.ranges.sort((a, b) => a - b)).toEqual([0, 1000, 2000]);
    expect(stats.peak).toBeGreaterThan(1);
  });

  it('an empty table gives an empty order', async () => {
    const { sb } = fakeSetsClient([]);
    expect(await loadAllSetsOrder(sb)).toEqual([]);
  });

  it('a failed page throws, so a partial order is never returned', async () => {
    const { sb } = fakeSetsClient(rows, 1000);
    await expect(loadAllSetsOrder(sb, 1000, 6)).rejects.toThrow('read failed');
  });
});

describe('/sets list query variants (a)', () => {
  it('accepts a theme name with spaces and ampersands', () => {
    expect(setsListQueryAllowed(new URLSearchParams('theme=Star+Wars'))).toBe(true);
    expect(setsListQueryAllowed(new URLSearchParams('theme=Harry%20Potter'))).toBe(true);
    expect(setsListQueryAllowed(new URLSearchParams('theme=Duplo+%26+Friends'))).toBe(true);
  });

  it('still refuses a theme value that is too long or has markup or path characters', () => {
    expect(setsListQueryAllowed(new URLSearchParams('theme=' + 'a'.repeat(81)))).toBe(false);
    expect(setsListQueryAllowed(new URLSearchParams('theme=%3Cscript%3E'))).toBe(false);
    expect(setsListQueryAllowed(new URLSearchParams('theme=../etc'))).toBe(false);
  });

  it('keeps the list page-size limit and the known keys', () => {
    expect(setsListQueryAllowed(new URLSearchParams('page=51'))).toBe(false);
    expect(setsListQueryAllowed(new URLSearchParams('sort=price-asc&instock=1&page=2'))).toBe(true);
    expect(setsListQueryAllowed(new URLSearchParams('foo=1'))).toBe(false);
  });
});

describe('/sets list stale window at the edge (a)', () => {
  const HTML = 'text/html; charset=utf-8';
  const VARY = 'rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch';
  const ON = { enabled: true };

  function store() {
    const map = new Map<string, Response>();
    const puts: string[] = [];
    const s: EdgeStore = {
      async match(key) { const r = map.get(key.url); return r ? new Response(r.body, r) : undefined; },
      async put(key, response) { puts.push(key.url); map.set(key.url, response); },
    };
    return { s, puts };
  }
  const pendingWork: Promise<unknown>[] = [];
  const waitUntil = (p: Promise<unknown>) => { pendingWork.push(p); };
  const flush = async () => { await Promise.all(pendingWork.splice(0)); };
  const list = (search = '?theme=Star+Wars') => new Request(`https://x.test/sets${search}`);
  const origin = () => {
    let calls = 0;
    return {
      count: () => calls,
      fn: async () => {
        calls++;
        return new Response('<html>list</html>', {
          status: 200,
          headers: { 'content-type': HTML, 'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate', vary: VARY },
        });
      },
    };
  };

  it('is fresh for the TTL, serves stale in the window with a background refresh, and then fetches again', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-21T10:00:00Z'));
    const { s } = store();
    const o = origin();
    const t0 = await handleWithEdgeCache(list(), o.fn, s, waitUntil, ON);
    expect(t0.headers.get('x-boi-edge-cache')).toBe('miss');
    await flush();
    expect(o.count()).toBe(1);

    vi.setSystemTime(new Date(Date.now() + (SETS_LIST_EDGE_TTL_SECONDS - 60) * 1000));
    const fresh = await handleWithEdgeCache(list(), o.fn, s, waitUntil, ON);
    expect(fresh.headers.get('x-boi-edge-cache')).toBe('hit');
    expect(o.count()).toBe(1);

    vi.setSystemTime(new Date(Date.now() + 120 * 1000));
    const stale = await handleWithEdgeCache(list(), o.fn, s, waitUntil, ON);
    expect(stale.headers.get('x-boi-edge-cache')).toBe('stale');
    await flush();
    expect(o.count()).toBe(2);

    vi.setSystemTime(new Date(Date.now() + (SETS_LIST_EDGE_TTL_SECONDS + SETS_LIST_STALE_WINDOW_SECONDS + 60) * 1000));
    const expired = await handleWithEdgeCache(list(), o.fn, s, waitUntil, ON);
    expect(expired.headers.get('x-boi-edge-cache')).toBe('miss');
    await flush();
    expect(o.count()).toBe(3);
  });

  it('the stored list copy never carries the internal timestamp header to a visitor', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-21T10:00:00Z'));
    const { s } = store();
    const o = origin();
    await handleWithEdgeCache(list('?sort=price-asc'), o.fn, s, waitUntil, ON);
    await flush();
    const hit = await handleWithEdgeCache(list('?sort=price-asc'), o.fn, s, waitUntil, ON);
    expect(hit.headers.get('x-boi-stored-at')).toBeNull();
  });

  it('a stored copy with no usable time is treated as expired (fetched again)', () => {
    const r = new Response('x', { headers: { 'x-boi-stored-at': 'nonsense' } });
    expect(storedAgeSeconds(r)).toBeNull();
  });

  it('a set page keeps its own TTL (not the list stale window)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-21T10:00:00Z'));
    const { s } = store();
    const o = origin();
    await handleWithEdgeCache(new Request('https://x.test/sets/75192-1'), o.fn, s, waitUntil, ON);
    await flush();
    vi.setSystemTime(new Date(Date.now() + (SETS_LIST_EDGE_TTL_SECONDS + 60) * 1000));
    const again = await handleWithEdgeCache(new Request('https://x.test/sets/75192-1'), o.fn, s, waitUntil, ON);
    expect(again.headers.get('x-boi-edge-cache')).not.toBe('stale');
  });
});
