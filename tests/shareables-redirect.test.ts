// /shareables and every path under it answer a permanent redirect to /lab when FEATURE_FLAGS.shareablesToLab is on.
// Off (the default), the page is as it is today and paths under it are 404s.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const flags = vi.hoisted(() => ({ shareablesToLab: false }));
vi.mock('@/lib/feature-flags', () => ({ FEATURE_FLAGS: flags }));

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

// Next's redirect and not-found helpers throw; the digest says which one.
const thrownDigest = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    return String((e as { digest?: string }).digest ?? '');
  }
  return '';
};

describe('shareables redirect switch', () => {
  beforeEach(() => {
    flags.shareablesToLab = false;
  });

  it('switch is off in both mirrors', () => {
    expect(read('src/lib/feature-flags.ts')).toMatch(/shareablesToLab: false,/);
    expect(read('config/feature_flags.py')).toMatch(/"shareables_to_lab": False,/);
  });

  it('switch on: /shareables answers a permanent redirect to /lab', async () => {
    flags.shareablesToLab = true;
    const { default: ShareablesPage } = await import('@/app/shareables/page');
    const digest = thrownDigest(() => ShareablesPage());
    expect(digest).toContain(';/lab;');
    expect(digest).toContain(';308;');
  });

  it('switch on: a path under /shareables answers a permanent redirect to /lab', async () => {
    flags.shareablesToLab = true;
    const { default: ShareablesSubpage } = await import('@/app/shareables/[...path]/page');
    const digest = thrownDigest(() => ShareablesSubpage());
    expect(digest).toContain(';/lab;');
    expect(digest).toContain(';308;');
  });

  it('switch off: a path under /shareables is a 404', async () => {
    const { default: ShareablesSubpage } = await import('@/app/shareables/[...path]/page');
    expect(thrownDigest(() => ShareablesSubpage())).toBe('NEXT_HTTP_ERROR_FALLBACK;404');
  });

  it('switch off: /shareables does not redirect and renders the page', async () => {
    const { default: ShareablesPage } = await import('@/app/shareables/page');
    expect(thrownDigest(() => ShareablesPage())).toBe('');
  });
});

describe('shareables is out of the sitemap and the menus', () => {
  it('the sitemap and the navigation do not link /shareables', () => {
    expect(read('src/app/sitemap.ts')).not.toMatch(/shareables/i);
    expect(read('src/components/layout/Navbar.tsx')).not.toMatch(/href=["'{`]\/?shareables/);
  });
  it('the new route is in the cadence registry', () => {
    expect(read('src/lib/route-cadence.ts')).toMatch(/'\/shareables\/\[\.\.\.path\]': DYNAMIC,/);
  });
});
