// Order 0480 (round46) item 2: the set page carries no cache tags, because nothing revalidates a set by tag. Each read keeps
// its own clock, the price side stays inside the 48 hour limit, and a publish still refreshes the page it should (by path).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SET_PAGE_REVALIDATE_SECONDS, UNPRICED_SET_REVALIDATE_SECONDS } from '../src/lib/price-freshness';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const page = read('src/app/sets/[slug]/page.tsx');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe('the set page carries no cache tags', () => {
  it('no read on the set page passes a tags option', () => {
    expect(page).not.toMatch(/tags:\s*\[/);
    expect(page).not.toMatch(/set:\$\{setNumber\}/);
  });
  it('the set page reads keep their clocks (unpriced data 14 days; price side 24 hours)', () => {
    expect(page).toMatch(/\['set_page_data', setNumber, slug\], \{ revalidate: UNPRICED_SET_REVALIDATE_SECONDS \}\)\(\);/);
    expect(page).toMatch(/\['set_price_side', setNumber\], \{ revalidate: SET_PAGE_REVALIDATE_SECONDS \}\)\(\);/);
  });
  it('the price side stays inside the 48 hour limit', () => {
    expect(SET_PAGE_REVALIDATE_SECONDS).toBeGreaterThan(0);
    expect(SET_PAGE_REVALIDATE_SECONDS).toBeLessThanOrEqual(48 * 60 * 60);
  });
  it('no code calls revalidateTag, so removing the set tag removes no refresh', () => {
    const calls = sourceFiles(join(root, 'src')).filter((f) => /revalidateTag\(/.test(readFileSync(f, 'utf8')));
    expect(calls).toEqual([]);
  });
});

describe('a publish still refreshes the page it should', () => {
  it('the admin publish action refreshes the published path', () => {
    const actions = read('src/app/admin/pending/actions.ts');
    expect(actions).toMatch(/onPublished: \(publishedPath\) => revalidatePath\(publishedPath\)/);
  });
  it('the admin page itself is refreshed on approve and reject', () => {
    expect(read('src/app/admin/pending/actions.ts')).toMatch(/revalidatePath\('\/admin\/pending'\)/);
  });
  it('the publish step reports the path it published to, so the refresh runs', () => {
    const publish = read('src/lib/publish-draft.ts');
    expect(publish).toMatch(/if \(options\.onPublished\) options\.onPublished\(path\);/);
  });
});
