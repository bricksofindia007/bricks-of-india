// Crawl policy and security headers: the private prefixes are kept out of search by a header,
// not by robots.txt; the AI-crawler policy stays; HSTS is one year with no preload.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// next.config.mjs is plain JavaScript; its header rules are read as data.
const loadConfig = async (): Promise<any> => (await import('../next.config.mjs')).default;

const root = join(__dirname, '..');
const robots = readFileSync(join(root, 'public/robots.txt'), 'utf8');

describe('robots.txt', () => {
  it('does not list the private prefixes (a header keeps them out of search)', () => {
    expect(robots).not.toMatch(/^Disallow: \/admin\/$/m);
    expect(robots).not.toMatch(/^Disallow: \/api\/$/m);
    expect(robots).not.toMatch(/^Disallow: \/pending\/$/m);
  });

  it('keeps the AI-crawler policy groups', () => {
    expect(robots).toMatch(/^User-agent: GPTBot$/m);
    expect(robots).toMatch(/^User-agent: ClaudeBot$/m);
  });
});

describe('response headers', () => {
  it('sets HSTS to one year with no includeSubDomains and no preload', async () => {
    const rules = await (await loadConfig()).headers();
    const all = rules.find((r: { source: string }) => r.source === '/(.*)');
    const hsts = all.headers.find((h: { key: string }) => h.key === 'Strict-Transport-Security');
    expect(hsts.value).toBe('max-age=31536000');
    expect(hsts.value).not.toMatch(/preload|includeSubDomains/);
  });

  for (const prefix of ['/admin/:path*', '/api/:path*', '/pending/:path*']) {
    it(`${prefix} is marked noindex`, async () => {
      const rules = await (await loadConfig()).headers();
      const rule = rules.find((r: { source: string }) => r.source === prefix);
      const tag = rule.headers.find((h: { key: string }) => h.key === 'X-Robots-Tag');
      expect(tag.value).toMatch(/noindex/);
    });
  }
});
