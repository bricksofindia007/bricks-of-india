// Order 0830: the staging build keeps every crawler out; the production robots.txt is unchanged.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

describe('robots on the staging build', () => {
  const staging = read('scripts/ci/robots-staging.txt');
  it('blocks every crawler and names no sitemap', () => {
    expect(staging).toBe('User-agent: *\nDisallow: /\n');
    expect(staging).not.toMatch(/sitemap/i);
    expect(staging).not.toMatch(/Allow:/);
  });
  it('the staging workflow copies it over public/robots.txt before the Next build, and nowhere else', () => {
    const wf = read('.github/workflows/deploy-cloudflare-staging.yml');
    const copyAt = wf.indexOf('cp scripts/ci/robots-staging.txt public/robots.txt');
    const buildAt = wf.indexOf('name: Next.js build');
    expect(copyAt).toBeGreaterThan(-1);
    expect(copyAt).toBeLessThan(buildAt);
    const prod = read('.github/workflows/deploy-cloudflare.yml');
    expect(prod).not.toMatch(/robots-staging/);
  });
});

describe('robots on the production build', () => {
  const prod = read('public/robots.txt');
  it('production robots.txt is the same as before: general crawlers allowed, sitemap listed', () => {
    expect(prod).toMatch(/User-agent: \*\nAllow: \//);
    expect(prod).toMatch(/Sitemap: https:\/\/bricksofindia\.com\/sitemap\.xml/);
    expect(prod).not.toMatch(/^Disallow: \/$/m);
  });
  it('the production workflow does not copy the staging file', () => {
    expect(read('.github/workflows/deploy-cloudflare.yml')).not.toMatch(/robots-staging\.txt/);
  });
});
