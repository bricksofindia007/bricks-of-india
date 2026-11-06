// Order 0710: one rule for the no-storage build. Every route renders per request (root layout), no database read goes through
// a data cache across requests (unstable_cache, fetch revalidate windows), and the edge copy is the only cache. The current
// production build is unchanged. Pins the rule by reading the source; the rendered result is checked by the local poll.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const SOURCE_FILES = [...walk(join(root, 'src/app')), ...walk(join(root, 'src/lib'))].map((p) => relative(root, p).split('\\').join('/'));

describe('the layout applies the rule to every route', () => {
  it('the root layout calls the per-request helper and imports it from the helper module', () => {
    const layout = read('src/app/layout.tsx');
    expect(layout).toMatch(/import \{ renderPerRequestOnNoStorageBuild \} from "@\/lib\/no-storage-render";/);
    expect(layout).toMatch(/export default function RootLayout[\s\S]*renderPerRequestOnNoStorageBuild\(\);/);
  });
  it('the helper calls unstable_noStore only on the flag, and storedCache passes through only on the flag', () => {
    const h = read('src/lib/no-storage-render.ts');
    expect(h).toMatch(/if \(NO_STORAGE_BUILD\) unstable_noStore\(\);/);
    expect(h).toMatch(/if \(NO_STORAGE_BUILD\) return fn;/);
    expect(h).toMatch(/return unstable_cache\(fn, keyParts, options\);/);
  });
});

describe('no database read is held in a data cache on the flag build', () => {
  it('unstable_cache( is called only inside the helper (the production branch of storedCache)', () => {
    const hits = SOURCE_FILES.filter((f) => /unstable_cache\(/.test(read(f)));
    expect(hits).toEqual(['src/lib/no-storage-render.ts']);
  });
  it('no page or lib file imports unstable_cache except the helper', () => {
    const hits = SOURCE_FILES.filter((f) => /import[^;]*unstable_cache/.test(read(f)));
    expect(hits).toEqual(['src/lib/no-storage-render.ts']);
  });
  it('the shared wrapper and all three Supabase client builders use no-store on the flag', () => {
    const sb = read('src/lib/supabase.ts');
    expect(sb).toContain('const window = NO_STORAGE_BUILD ? 0 : seconds;');
    expect(sb).toMatch(/export const supabase = supabaseUrl[\s\S]*NO_STORAGE_BUILD \? \{ global: \{ fetch: revalidatingFetch\(0\) \} \} : undefined/);
    expect(sb).toMatch(/createServerClient[\s\S]*opts\?\.revalidate != null \|\| NO_STORAGE_BUILD/);
    expect(sb).toMatch(/createPublicClient[\s\S]*opts\?\.revalidate != null \|\| NO_STORAGE_BUILD/);
  });
  it('the Supabase wrapper keeps the production window (the seconds argument) when the flag is off', () => {
    expect(read('src/lib/supabase.ts')).toContain('next: { revalidate: window }');
  });
  it('per-page render calls were removed (the layout covers them)', () => {
    const pages = SOURCE_FILES.filter((f) => f.startsWith('src/app/') && f !== 'src/app/layout.tsx');
    const hits = pages.filter((f) => /renderPerRequestOnNoStorageBuild/.test(read(f)));
    expect(hits).toEqual([]);
  });
});

describe('prerendered routes (generateStaticParams) on the flag build', () => {
  it('every generateStaticParams goes through staticParamsForBuild, so no real page is prerendered on the flag build', () => {
    const files = SOURCE_FILES.filter((f) => f.startsWith('src/app/') && /generateStaticParams\(/.test(read(f)));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(read(f), f).toMatch(/staticParamsForBuild[<(]/);
  });
  it('the helper returns the probe only on the flag and the real list otherwise', () => {
    expect(read('src/lib/no-storage-render.ts')).toMatch(/return NO_STORAGE_BUILD \? \[probe\] : real;/);
  });
});

describe('the production build is unchanged', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_BOI_NO_STORAGE;
    vi.resetModules();
  });
  it('with the flag unset: helper is a no-op, storedCache is unstable_cache with the same args, window = production 86400', async () => {
    delete process.env.NEXT_PUBLIC_BOI_NO_STORAGE;
    vi.resetModules();
    vi.doMock('next/cache', () => ({ unstable_cache: (fn: unknown, k: unknown, o: unknown) => ({ fn, k, o }), unstable_noStore: () => { throw new Error('noStore called in production'); } }));
    const m = await import('../src/lib/no-storage-render');
    expect(() => m.renderPerRequestOnNoStorageBuild()).not.toThrow();
    const fn = async () => 1;
    const wrapped = m.storedCache(fn, ['k'], { revalidate: 86400 }) as unknown as { fn: unknown; o: { revalidate: number } };
    expect(wrapped.fn).toBe(fn);
    expect(wrapped.o.revalidate).toBe(86400);
    vi.doUnmock('next/cache');
  });
  it('the price-freshness windows keep the production values when the flag is off', async () => {
    delete process.env.NEXT_PUBLIC_BOI_NO_STORAGE;
    vi.resetModules();
    const pf = await import('../src/lib/price-freshness');
    expect(pf.NO_STORAGE_BUILD).toBe(false);
    expect(pf.PRICE_READ_REVALIDATE_SECONDS).toBe(86400);
    expect(pf.READ_REVALIDATE_SECONDS).toBe(86400);
    expect(pf.SET_PAGE_REVALIDATE_SECONDS).toBe(86400);
    expect(pf.UNPRICED_SET_REVALIDATE_SECONDS).toBe(1209600);
  });
});
