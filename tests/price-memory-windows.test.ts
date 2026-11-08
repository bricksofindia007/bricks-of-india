// Price memory windows (order 0620). The no-storage build keeps every in-memory price window at one hour; the current
// production build keeps its values. Pins both, and the worst case for a shown price on the no-storage build.
import { describe, it, expect, afterEach, vi } from 'vitest';

async function load(env: Record<string, string | undefined>) {
  for (const k of ['NEXT_PUBLIC_BOI_NO_STORAGE']) delete process.env[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
  vi.resetModules();
  return import('../src/lib/price-freshness');
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_BOI_NO_STORAGE;
  delete process.env.NEXT_PUBLIC_BOI_NO_STORAGE;
  vi.resetModules();
});

describe('the no-storage build (BOI_STAGING=1)', () => {
  it('every price window is one hour', async () => {
    const m = await load({ NEXT_PUBLIC_BOI_NO_STORAGE: '1' });
    expect(m.NO_STORAGE_BUILD).toBe(true);
    expect(m.READ_REVALIDATE_SECONDS).toBe(3600);
    expect(m.SET_PAGE_REVALIDATE_SECONDS).toBe(3600);
    expect(m.UNPRICED_SET_REVALIDATE_SECONDS).toBe(3600);
  });
});

describe('the no-storage build (BOI_PRODUCTION_NO_STORAGE=1, cutover)', () => {
  it('every price window is one hour', async () => {
    const m = await load({ NEXT_PUBLIC_BOI_NO_STORAGE: '1' });
    expect(m.NO_STORAGE_BUILD).toBe(true);
    expect(m.READ_REVALIDATE_SECONDS).toBe(3600);
    expect(m.SET_PAGE_REVALIDATE_SECONDS).toBe(3600);
    expect(m.UNPRICED_SET_REVALIDATE_SECONDS).toBe(3600);
  });
});

describe('the current production build (no flag set) keeps its windows', () => {
  it('24 h for reads and the set price read, 14 days for the set data read', async () => {
    const m = await load({});
    expect(m.NO_STORAGE_BUILD).toBe(false);
    expect(m.READ_REVALIDATE_SECONDS).toBe(86400);
    expect(m.SET_PAGE_REVALIDATE_SECONDS).toBe(86400);
    expect(m.UNPRICED_SET_REVALIDATE_SECONDS).toBe(1209600);
  });
  it('a flag set to something other than 1 does not switch the windows', async () => {
    const m = await load({ NEXT_PUBLIC_BOI_NO_STORAGE: 'yes' });
    expect(m.NO_STORAGE_BUILD).toBe(false);
    expect(m.READ_REVALIDATE_SECONDS).toBe(86400);
  });
});

describe('worst case for a shown price on the no-storage build', () => {
  it('1 h edge copy + 1 h in memory + 24 h scrape is at most 26 h, under 48 h', async () => {
    const m = await load({ NEXT_PUBLIC_BOI_NO_STORAGE: '1' });
    const edgeHours = 1; // SET_PAGE_EDGE_TTL_SECONDS (worker/edge-cache.ts)
    const worstHours = edgeHours + m.READ_REVALIDATE_SECONDS / 3600 + m.SCRAPE_INTERVAL_HOURS;
    expect(worstHours).toBe(26);
    expect(worstHours).toBeLessThanOrEqual(48);
  });
});
