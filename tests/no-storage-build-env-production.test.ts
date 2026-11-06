// Order 0650 item 1: the production build step carries both no-storage flags: the OpenNext config flag and the build-time
// price flag read by the app code (NEXT_PUBLIC_BOI_NO_STORAGE, inlined by Next).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

describe('the production build step environment', () => {
  const wf = read('.github/workflows/deploy-cloudflare.yml');
  const step = wf.slice(wf.indexOf('name: OpenNext Cloudflare build'), wf.indexOf('name: wrangler deploy'));
  it('sets BOI_PRODUCTION_NO_STORAGE and NEXT_PUBLIC_BOI_NO_STORAGE, both to 1, on the OpenNext build step', () => {
    expect(step).toMatch(/BOI_PRODUCTION_NO_STORAGE: '1'/);
    expect(step).toMatch(/NEXT_PUBLIC_BOI_NO_STORAGE: '1'/);
  });
});
