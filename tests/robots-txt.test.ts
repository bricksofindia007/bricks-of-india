// public/robots.txt: every agent block (the generic one and each named AI and search agent) allows the one API path that
// social previews need, keeps the admin, API and pending paths and the draft rule closed, and never blocks /_next/.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const robots = readFileSync(join(__dirname, '../public/robots.txt'), 'utf8');

// Each block starts at a User-agent line and runs to the next blank line.
const blocks = robots.split(/\n\n+/).filter((b) => b.startsWith('User-agent:'));
const agentOf = (block: string) => block.split('\n')[0].replace('User-agent:', '').trim();

const REQUIRED = [
  'Allow: /',
  'Allow: /api/img',
  'Disallow: /admin/',
  'Disallow: /api/',
  'Disallow: /pending/',
  'Disallow: /*?*draft=',
];

describe('robots.txt agent blocks', () => {
  it('there are 23 blocks: the generic one and the 22 named agents', () => {
    expect(blocks).toHaveLength(23);
    expect(blocks.map(agentOf)[0]).toBe('*');
  });

  for (const block of blocks) {
    const agent = agentOf(block);
    describe(`User-agent: ${agent}`, () => {
      const lines = block.split('\n').map((l) => l.trim());
      for (const rule of REQUIRED) {
        it(`has "${rule}"`, () => {
          expect(lines).toContain(rule);
        });
      }
      it('never mentions /_next/', () => {
        expect(block).not.toContain('/_next/');
      });
    });
  }

  it('the /api/img allow comes before the /api/ disallow in every block (first-match parsers)', () => {
    for (const block of blocks) {
      const lines = block.split('\n').map((l) => l.trim());
      expect(lines.indexOf('Allow: /api/img')).toBeLessThan(lines.indexOf('Disallow: /api/'));
    }
  });

  it('no block blocks /api/img or any other path that the page images need', () => {
    for (const block of blocks) {
      expect(block).not.toMatch(/Disallow: \/api\/img/);
      expect(block).not.toMatch(/Disallow: \/$/m);
    }
  });
});
