// public/robots.txt: the generic block and the search and answer agents allow the one API path that social previews need,
// keep the admin, API and pending paths and the draft rule closed, and never block /_next/. Training crawlers
// are refused the whole site.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const robots = readFileSync(join(__dirname, '../public/robots.txt'), 'utf8');

// Each block starts at a User-agent line and runs to the next blank line.
const blocks = robots.split(/\n\n+/).filter((b) => b.startsWith('User-agent:'));
const agentOf = (block: string) => block.split('\n')[0].replace('User-agent:', '').trim();

const ALLOWED_AGENTS = [
  'ChatGPT-User', 'OAI-SearchBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot',
  'Perplexity-User', 'DuckAssistBot', 'Applebot', 'YouBot', 'MistralAI-User',
];
const TRAINING_AGENTS = [
  'GPTBot', 'ClaudeBot', 'anthropic-ai', 'Claude-Web', 'Google-Extended', 'GoogleOther',
  'Applebot-Extended', 'CCBot', 'Bytespider', 'Amazonbot', 'FacebookBot', 'Meta-ExternalAgent',
  'AI2Bot', 'cohere-ai', 'cohere-training-data-crawler', 'Diffbot', 'PetalBot', 'Baiduspider',
  'Timpibot', 'Google-CloudVertexBot', 'ImagesiftBot', 'omgili',
];

const REQUIRED = [
  'Allow: /',
  'Allow: /api/img',
  'Disallow: /admin/',
  'Disallow: /api/',
  'Disallow: /pending/',
  'Disallow: /*?*draft=',
];

const allowedBlocks = blocks.filter((b) => ALLOWED_AGENTS.includes(agentOf(b)) || agentOf(b) === '*');
const trainingBlocks = blocks.filter((b) => TRAINING_AGENTS.includes(agentOf(b)));

describe('robots.txt agent blocks', () => {
  it('there are 33 blocks: the generic one, the 10 search and answer agents and the 22 training agents', () => {
    expect(blocks).toHaveLength(33);
    expect(blocks.map(agentOf)[0]).toBe('*');
    expect(allowedBlocks).toHaveLength(11);
    expect(trainingBlocks).toHaveLength(22);
  });

  for (const block of allowedBlocks) {
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

  for (const block of trainingBlocks) {
    const agent = agentOf(block);
    it(`User-agent: ${agent} is disallowed from the whole site and has nothing else`, () => {
      const lines = block.split('\n').map((l) => l.trim());
      expect(lines).toEqual([`User-agent: ${agent}`, 'Disallow: /']);
    });
  }

  it('the /api/img allow comes before the /api/ disallow in every search and answer block (first-match parsers)', () => {
    for (const block of allowedBlocks) {
      const lines = block.split('\n').map((l) => l.trim());
      expect(lines.indexOf('Allow: /api/img')).toBeLessThan(lines.indexOf('Disallow: /api/'));
    }
  });

  it('no search or answer block blocks /api/img or the whole site, and the generic block does not either', () => {
    for (const block of allowedBlocks) {
      expect(block).not.toMatch(/Disallow: \/api\/img/);
      expect(block).not.toMatch(/Disallow: \/$/m);
    }
  });
});
