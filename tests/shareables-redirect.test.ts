// Decision (c), order 1846: /shareables and every path under it redirect permanently to /lab (308).
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');

async function redirects() {
  const cfg = (await import('../next.config.mjs')).default;
  return cfg.redirects();
}

describe('/shareables redirect (decision (c), order 1846)', () => {
  it('/shareables goes to /lab as a permanent redirect', async () => {
    const list = await redirects();
    const hit = list.find((r: { source: string }) => r.source === '/shareables');
    expect(hit).toBeDefined();
    expect(hit?.destination).toBe('/lab');
    expect(hit?.permanent).toBe(true);
  });
  it('sub-addresses under /shareables also go to /lab, permanently', async () => {
    const list = await redirects();
    const hit = list.find((r: { source: string }) => r.source === '/shareables/:path*');
    expect(hit).toBeDefined();
    expect(hit?.destination).toBe('/lab');
    expect(hit?.permanent).toBe(true);
  });
  it('there is one mechanism: exactly two rules under /shareables, both permanent', async () => {
    const list = await redirects();
    const hits = list.filter((r: { source: string }) => r.source.startsWith('/shareables'));
    expect(hits.length).toBe(2);
    for (const h of hits) expect(h.permanent).toBe(true);
  });
  it('the page file is kept (not deleted)', () => {
    expect(existsSync(join(root, 'src/app/shareables/page.tsx'))).toBe(true);
  });
});
