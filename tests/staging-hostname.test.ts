/**
 * Staging custom hostname (order 0580). Three checks from the draft:
 *  1. the staging config lists the custom domain once, and workers.dev stays on;
 *  2. the staging sitemap and canonical links use the new address;
 *  3. the staging build still sends noindex, nofollow.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const HOST = 'staging-edge.bricksofindia.com';
const ADDRESS = `https://${HOST}`;

// wrangler.staging.jsonc uses // comment lines only; strip them, then parse as JSON.
function readJsonc(path: string) {
  const text = readFileSync(join(root, path), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
  return JSON.parse(text);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('1. staging config: custom hostname', () => {
  const cfg = readJsonc('wrangler.staging.jsonc');

  it('lists the staging hostname once, as a custom domain', () => {
    expect(cfg.routes).toEqual([{ pattern: HOST, custom_domain: true }]);
  });

  it('keeps workers.dev on and the staging Worker name', () => {
    expect(cfg.workers_dev).toBe(true);
    expect(cfg.name).toBe('bricks-of-india-staging');
  });

  it('production config has no route for the staging hostname', () => {
    const prod = readJsonc('wrangler.jsonc');
    expect(JSON.stringify(prod)).not.toContain(HOST);
  });
});

describe('2. staging sitemap and canonical links use the new address', () => {
  it('the staging build address is the new hostname (workflow)', () => {
    const wf = readFileSync(join(root, '.github/workflows/deploy-cloudflare-staging.yml'), 'utf8');
    expect(wf).toContain(`NEXT_PUBLIC_SITE_URL: ${ADDRESS}`);
    expect(wf).not.toContain('bricks-of-india-staging.bricksofindia007.workers.dev');
  });

  it('the site address resolves to the new hostname when the staging build sets it', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', ADDRESS + '/');
    const { SITE_URL } = await import('../src/lib/metadata');
    expect(SITE_URL).toBe(ADDRESS);
  });
});

describe('3. staging build still sends noindex, nofollow', () => {
  it('every page carries the noindex header on the staging build', async () => {
    vi.stubEnv('BOI_STAGING', '1');
    const cfg = (await import('../next.config.mjs')).default;
    const rules = await cfg.headers!();
    const hit = rules.find((r: { source: string; headers: Array<{ key: string }> }) => r.source === '/(.*)' && r.headers.some((h) => h.key === 'X-Robots-Tag'));
    expect(hit?.headers).toEqual([{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]);
  });
});
