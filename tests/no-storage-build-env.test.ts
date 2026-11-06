// Order 0650 item 1: the no-storage price path is switched on at build time by a literal NEXT_PUBLIC_BOI_NO_STORAGE in the
// staging build environment (the production build gets the same line at cutover, on the cutover branch).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

describe('the staging build environment', () => {
  const wf = read('.github/workflows/deploy-cloudflare-staging.yml');
  it('sets NEXT_PUBLIC_BOI_NO_STORAGE to 1 at job level, next to BOI_STAGING', () => {
    expect(wf).toMatch(/BOI_STAGING: '1'\n\s*# [^\n]*\n\s*NEXT_PUBLIC_BOI_NO_STORAGE: '1'/);
  });
  it('the flag is at job level (applies to the build step), not only on one step', () => {
    const jobEnvBlock = wf.slice(0, wf.indexOf('    steps:'));
    expect(jobEnvBlock).toMatch(/NEXT_PUBLIC_BOI_NO_STORAGE: '1'/);
  });
});
