// Catalogue sync page loop (scripts/sync-rebrickable.js via scripts/lib/rebrickable-pages.mjs).
// A page failure, a write failure or an incomplete run must end the run with an error; nothing is treated as complete
// unless every entry the API reports has been processed.
import { describe, it, expect, vi } from 'vitest';
import { createPacer, paginateCatalogue } from '../scripts/lib/rebrickable-pages.mjs';

const entries = (n: number) => Array.from({ length: n }, (_, i) => ({ set_num: `${i}-1` }));
const okUpsert = async (rows: unknown[]) => ({ synced: rows.length, failed: 0, deduped: 0 });

describe('paginateCatalogue', () => {
  it('a 3-page run with a 429 on page 2 rejects, and page 3 is never fetched', async () => {
    const upsertPage = vi.fn(okUpsert);
    const fetched: string[] = [];
    const fetchPage = async (url: string) => {
      fetched.push(url);
      if (url === 'p1') return { count: 2500, next: 'p2', results: entries(1000) };
      if (url === 'p2') throw new Error('Still getting 429 after 3 retries: p2');
      return { count: 2500, next: null, results: entries(500) };
    };
    await expect(
      paginateCatalogue({ firstUrl: 'p1', fetchPage, upsertPage }),
    ).rejects.toThrow(/Page 2 fetch failed: Still getting 429/);
    expect(upsertPage).toHaveBeenCalledTimes(1);
    expect(fetched).toEqual(['p1', 'p2']);
  });

  it('a complete 3-page run resolves with every entry counted', async () => {
    const urls: Record<string, unknown> = {
      p1: { count: 2500, next: 'p2', results: entries(1000) },
      p2: { count: 2500, next: 'p3', results: entries(1000) },
      p3: { count: 2500, next: null, results: entries(500) },
    };
    const totals = await paginateCatalogue({
      firstUrl: 'p1',
      fetchPage: async (url: string) => urls[url],
      upsertPage: okUpsert,
    });
    expect(totals).toMatchObject({ entries: 2500, apiCount: 2500, pages: 3, synced: 2500, failed: 0 });
  });

  it('a run that ends early with a count mismatch rejects', async () => {
    await expect(
      paginateCatalogue({
        firstUrl: 'p1',
        fetchPage: async () => ({ count: 2500, next: null, results: entries(1000) }),
        upsertPage: okUpsert,
      }),
    ).rejects.toThrow('Incomplete sync: processed 1000 entries in 1 pages, API reports 2500');
  });

  it('a response with no count field rejects rather than assuming completeness', async () => {
    await expect(
      paginateCatalogue({
        firstUrl: 'p1',
        fetchPage: async () => ({ next: null, results: entries(10) }),
        upsertPage: okUpsert,
      }),
    ).rejects.toThrow(/no count field/);
  });

  it('a page whose rows fail to write rejects', async () => {
    await expect(
      paginateCatalogue({
        firstUrl: 'p1',
        fetchPage: async () => ({ count: 10, next: null, results: entries(10) }),
        upsertPage: async () => ({ synced: 0, failed: 10, deduped: 0 }),
      }),
    ).rejects.toThrow('Page 1: 10 rows failed to write');
  });

  it('waits the page gap between pages, and not after the last page', async () => {
    const sleep = vi.fn(async () => {});
    const urls: Record<string, unknown> = {
      p1: { count: 3, next: 'p2', results: entries(1) },
      p2: { count: 3, next: 'p3', results: entries(1) },
      p3: { count: 3, next: null, results: entries(1) },
    };
    await paginateCatalogue({
      firstUrl: 'p1',
      fetchPage: async (url: string) => urls[url],
      upsertPage: okUpsert,
      pageGapMs: 1100,
      sleep,
    });
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1100);
  });
});

describe('createPacer', () => {
  it('spaces calls at least the gap apart, and does not wait before the first call', async () => {
    let clock = 0;
    const sleep = vi.fn(async (ms: number) => {
      clock += ms;
    });
    const pace = createPacer(1100, { now: () => clock, sleep });
    await pace();
    expect(sleep).not.toHaveBeenCalled();
    clock = 100;
    await pace();
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(clock).toBe(1100);
  });
});
