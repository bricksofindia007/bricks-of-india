// Crawl policy: no robots group disallows the script and image paths (blocking them stops rendering checks
// from loading the page's resources). The private prefixes stay out of search through noindex headers.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const robots = readFileSync(join(root, 'public/robots.txt'), 'utf8');

function groups(text: string): { agents: string[]; rules: string[] }[] {
  const out: { agents: string[]; rules: string[] }[] = [];
  let cur: { agents: string[]; rules: string[] } | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (/^user-agent$/i.test(key)) {
      if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; out.push(cur); }
      cur.agents.push(value);
    } else if (cur) {
      cur.rules.push(`${key.trim().toLowerCase()}: ${value}`);
    }
  }
  return out;
}

describe('robots.txt', () => {
  it('no group disallows the script and image paths', () => {
    for (const g of groups(robots)) {
      expect(g.rules).not.toContain('disallow: /_next/');
    }
  });

  it('the generic group still exists', () => {
    expect(groups(robots).some((g) => g.agents.includes('*'))).toBe(true);
  });

  it('does not list the private prefixes', () => {
    for (const p of ['/admin/', '/api/', '/pending/']) {
      expect(robots).not.toMatch(new RegExp(`^Disallow: ${p.replace(/\//g, '\/')}$`, 'm'));
    }
  });
});

describe('noindex headers on the private prefixes', () => {
  it('admin, api and pending each carry X-Robots-Tag noindex', async () => {
    const config: any = (await import('../next.config.mjs')).default;
    const rules: { source: string; headers: { key: string; value: string }[] }[] = await config.headers();
    for (const source of ['/admin/:path*', '/api/:path*', '/pending/:path*']) {
      const rule = rules.find((r) => r.source === source);
      expect(rule, source).toBeTruthy();
      const tag = rule!.headers.find((h) => h.key === 'X-Robots-Tag');
      expect(tag?.value, source).toMatch(/noindex/);
    }
  });
});
