// Negative tests for public-key batch 1: blog, community, news, sitemap.
// These pages must read with the public key only. They must never reach the full key.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BATCH = [
  'src/app/blog/[slug]/page.tsx',
  'src/app/community/[slug]/page.tsx',
  'src/app/news/[slug]/page.tsx',
  'src/app/sitemap.ts',
];
const root = join(__dirname, '..');

// Code only: comments may mention the old client name without using it.
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('public-key batch 1: source checks', () => {
  for (const f of BATCH) {
    it(`${f} does not use the full-access client`, () => {
      const src = codeOnly(readFileSync(join(root, f), 'utf8'));
      expect(src).not.toMatch(/createServerClient/);
      expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    });
  }
});

describe('public-key helper: behaviour', () => {
  const createClient = vi.fn(() => ({ from: () => ({}) }));
  const saved = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    createClient.mockClear();
    vi.doMock('@supabase/supabase-js', () => ({ createClient }));
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.example';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-value';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-test-value';
  });

  afterEach(() => {
    process.env = { ...saved };
    vi.doUnmock('@supabase/supabase-js');
  });

  it('uses the public key even when the full key is present', async () => {
    const { createPublicClient } = await import('@/lib/supabase');
    createPublicClient({ revalidate: 60 });
    const calls = createClient.mock.calls as unknown as Array<[string, string]>;
    const keys = calls.map((c) => c[1]);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((k) => k === 'anon-test-value')).toBe(true);
    expect(keys).not.toContain('service-test-value');
  });

  it('refuses to start when the public key is missing (no fallback to the full key)', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { createPublicClient } = await import('@/lib/supabase');
    expect(() => createPublicClient()).toThrow(/refusing to use any other key/);
    const calls = createClient.mock.calls as unknown as Array<[string, string]>;
    expect(calls.some((c) => c[1] === 'service-test-value')).toBe(false);
  });
});
