// Order 0620: on the no-storage build, price reads run on each render (no data cache), and the current production build keeps
// its data cache. Pins the helper and the price reads that use it.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

async function loadHelper(env: Record<string, string | undefined>) {
  for (const k of ['NEXT_PUBLIC_BOI_NO_STORAGE']) delete process.env[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
  vi.resetModules();
  vi.doMock('next/cache', () => ({
    unstable_cache: (fn: unknown) => ({ cached: true, fn }),
    unstable_noStore: () => undefined,
  }));
  return import('../src/lib/no-storage-render');
}

afterEach(() => {
  delete process.env.NEXT_PUBLIC_BOI_NO_STORAGE;
  delete process.env.NEXT_PUBLIC_BOI_NO_STORAGE;
  vi.doUnmock('next/cache');
  vi.resetModules();
});

describe('storedCache', () => {
  it('on the no-storage build the read is returned as it is (no data cache)', async () => {
    const m = await loadHelper({ NEXT_PUBLIC_BOI_NO_STORAGE: '1' });
    const fn = async () => 42;
    expect(m.storedCache(fn, ['k'], { revalidate: 3600 })).toBe(fn);
  });
  it('on the cutover flag too', async () => {
    const m = await loadHelper({ NEXT_PUBLIC_BOI_NO_STORAGE: '1' });
    const fn = async () => 1;
    expect(m.storedCache(fn, ['k'], { revalidate: 3600 })).toBe(fn);
  }, 20_000); // the first import compiles the helper's module graph; under a full parallel run that alone can pass 5 s
  it('on the current production build it is unstable_cache with the same arguments', async () => {
    const m = await loadHelper({});
    const fn = async () => 1;
    const wrapped = m.storedCache(fn, ['k'], { revalidate: 86400 }) as unknown as { cached: boolean; fn: unknown };
    expect(wrapped.cached).toBe(true);
    expect(wrapped.fn).toBe(fn);
  });
});

describe('the price reads use it', () => {
  it('the set page price reads go through storedCache, and the page does not call unstable_noStore (ISR route: it throws there)', () => {
    const page = read('src/app/sets/[slug]/page.tsx');
    expect(page).toMatch(/storedCache\(async \(\) => \{/);
    expect(page.split('storedCache(async () => {').length - 1).toBe(3);
    expect(page).not.toMatch(/unstable_cache\(async/);
    expect(page).not.toMatch(/renderPerRequestOnNoStorageBuild/);
  });
  it('the sets list store-price read goes through storedCache; the default order skeleton stays cached', () => {
    const list = read('src/app/sets/page.tsx');
    expect(list).toMatch(/const getAllSetsStorePrices = storedCache\(/);
    expect(list).toMatch(/const getSetsDefaultOrder = storedCache\(/);
  });
  it('the lab price-drops read goes through storedCache', () => {
    expect(read('src/app/lab/price-drops/page.tsx')).toMatch(/const getPriceDropsData = storedCache\(/);
  });
  it('the price pages carry the price window (the per-request rule is in the root layout, order 0710)', () => {
    for (const f of ['src/app/page.tsx', 'src/app/deals/page.tsx', 'src/app/lab/deals/page.tsx', 'src/app/reviews/[slug]/page.tsx']) {
      expect(read(f), f).toContain('createServerClient({ revalidate: PRICE_READ_REVALIDATE_SECONDS })');
    }
  });
  it('the shared Supabase fetch wrapper keeps the production window; no-store only on the flag (order 0710)', () => {
    const sb = read('src/lib/supabase.ts');
    expect(sb).toContain('const window = NO_STORAGE_BUILD ? 0 : seconds;');
    expect(sb).toContain('next: { revalidate: window }');
  });
});
