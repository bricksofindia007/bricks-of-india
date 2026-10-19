// With the My Collection page flag off, /my has no route: the request answers like any unknown path (the branded 404),
// not a bare error shell. The page source is kept in src/unrouted/ until the flag is switched on.
import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');

describe('/my with the flag off', () => {
  it('the page flag is off', async () => {
    const { FEATURE_FLAGS } = await import('../src/lib/feature-flags');
    expect(FEATURE_FLAGS.myCollectionPage).toBe(false);
  });
  it('there is no route file, so /my is an unknown path', () => {
    expect(existsSync(join(root, 'src/app/my/page.tsx'))).toBe(false);
    expect(existsSync(join(root, 'src/app/my/page.js'))).toBe(false);
  });
  it('the page source is kept unrouted, with the same flag gate', () => {
    const src = readFileSync(join(root, 'src/unrouted/my/page.tsx'), 'utf8');
    expect(src).toMatch(/if \(!FEATURE_FLAGS\.myCollectionPage\) notFound\(\);/);
    expect(src).toMatch(/move this file back to src\/app\/my\/page\.tsx/);
  });
});
