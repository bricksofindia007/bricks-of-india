// B4 follow-up: the sitemap's client is the service client unless the flag is on. Off by default, mirrored in Python.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';

describe('sitemap client flag', () => {
  it('is off by default in TypeScript and in the Python mirror', () => {
    expect(FEATURE_FLAGS.sitemapPublicClient).toBe(false);
    expect(readFileSync(join(__dirname, '..', 'config/feature_flags.py'), 'utf8')).toMatch(/"sitemap_public_client":\s*False/);
  });
  it('the sitemap chooses its client by the flag', () => {
    const src = readFileSync(join(__dirname, '..', 'src/app/sitemap.ts'), 'utf8');
    expect(src).toMatch(/FEATURE_FLAGS\.sitemapPublicClient \? createPublicClient/);
  });
});
