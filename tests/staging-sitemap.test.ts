// Staging is kept out of search: the staging build names its own address in the sitemap and sends a noindex header.
// Production (no staging variables set) is unchanged.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const STAGING = 'https://bricks-of-india-staging.bricksofindia007.workers.dev';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('site address', () => {
  it('production: the default address, with no trailing slash', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    const { SITE_URL } = await import('../src/lib/metadata');
    expect(SITE_URL).toBe('https://bricksofindia.com');
  });

  it('staging: the address set for the staging build, trailing slash removed', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', STAGING + '/');
    const { SITE_URL } = await import('../src/lib/metadata');
    expect(SITE_URL).toBe(STAGING);
  });
});

describe('sitemap', () => {
  const src = readFileSync(join(root, 'src/app/sitemap.ts'), 'utf8');
  it('takes its base from the site address, not a fixed host', () => {
    expect(src).toMatch(/import \{ SITE_URL \} from '@\/lib\/metadata'/);
    expect(src).toMatch(/const base = SITE_URL;/);
    expect(src).not.toContain("'https://bricksofindia.com'");
  });
});

describe('noindex header', () => {
  it('staging build (BOI_STAGING=1): every page carries noindex, nofollow', async () => {
    vi.stubEnv('BOI_STAGING', '1');
    const cfg = (await import('../next.config.mjs')).default;
    const rules = await cfg.headers!();
    const hit = rules.find((r: { source: string; headers: Array<{ key: string }> }) => r.source === '/(.*)' && r.headers.some((h) => h.key === 'X-Robots-Tag'));
    expect(hit?.headers).toEqual([{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]);
  });

  it('production (flag not set): no site-wide noindex header is added', async () => {
    vi.stubEnv('BOI_STAGING', '');
    const cfg = (await import('../next.config.mjs')).default;
    const rules = await cfg.headers!();
    const siteWide = rules.some((r: { source: string; headers: Array<{ key: string }> }) => r.source === '/(.*)' && r.headers.some((h) => h.key === 'X-Robots-Tag'));
    expect(siteWide).toBe(false);
  });
});

describe('staging workflow', () => {
  const wf = readFileSync(join(root, '.github/workflows/deploy-cloudflare-staging.yml'), 'utf8');
  it('builds with the staging address and the noindex flag', () => {
    expect(wf).toContain(`NEXT_PUBLIC_SITE_URL: ${STAGING}`);
    expect(wf).toMatch(/BOI_STAGING: '1'/);
  });
  it('the production workflow sets neither', () => {
    const prod = readFileSync(join(root, '.github/workflows/deploy-cloudflare.yml'), 'utf8');
    expect(prod).not.toContain('BOI_STAGING');
    expect(prod).toMatch(/NEXT_PUBLIC_SITE_URL:\s+https:\/\/bricksofindia\.com\b/);
  });
});
