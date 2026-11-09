// Decision #7 (8 Nov 2026): /shareables redirects to /lab as a temporary redirect (307). The page file is kept, unreachable.
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');

async function redirects() {
  const cfg = (await import('../next.config.mjs')).default;
  return cfg.redirects();
}

describe('/shareables redirect (decision #7)', () => {
  it('/shareables goes to /lab as a temporary redirect (307, permanent false)', async () => {
    const list = await redirects();
    const hit = list.find((r: { source: string }) => r.source === '/shareables');
    expect(hit).toBeDefined();
    expect(hit.destination).toBe('/lab');
    expect(hit.permanent).toBe(false);
  });
  it('sub-addresses under /shareables also go to /lab, temporarily', async () => {
    const list = await redirects();
    const hit = list.find((r: { source: string }) => r.source === '/shareables/:path*');
    expect(hit).toBeDefined();
    expect(hit.destination).toBe('/lab');
    expect(hit.permanent).toBe(false);
  });
  it('the redirect is temporary, so the address can come back later (not 308)', async () => {
    const list = await redirects();
    const hits = list.filter((r: { source: string }) => r.source.startsWith('/shareables'));
    expect(hits.length).toBe(2);
    for (const h of hits) expect(h.permanent).not.toBe(true);
  });
  it('the page file is kept (not deleted)', () => {
    expect(existsSync(join(root, 'src/app/shareables/page.tsx'))).toBe(true);
  });
});
