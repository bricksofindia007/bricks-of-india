// Staging read-only mode: with STAGING_READ_ONLY=1 the server client uses the public key and never reads
// the service-role value. Without the flag the service-role key is required (production behaviour).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => ({})) }));

const root = join(__dirname, '..');
const ANON = 'anon-test-value';
const SERVICE = 'service-test-value';
const ORIGINAL_ENV = process.env;

// Replace process.env with a copy that records every name read from it.
function envWith(vars: Record<string, string | undefined>, reads: string[]) {
  const base: Record<string, string | undefined> = { ...ORIGINAL_ENV, ...vars };
  for (const k of Object.keys(base)) if (base[k] === undefined) delete base[k];
  process.env = new Proxy(base, {
    get(target, prop) {
      if (typeof prop === 'string') reads.push(prop);
      return typeof prop === 'string' ? target[prop] : undefined;
    },
  }) as NodeJS.ProcessEnv;
}

async function loadServerClient() {
  vi.resetModules();
  return (await import('../src/lib/supabase')).createServerClient;
}

describe('staging read-only mode', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { process.env = ORIGINAL_ENV; });

  it('(1) with the flag set, the service-role value is never read and the public key is used', async () => {
    const reads: string[] = [];
    envWith({
      STAGING_READ_ONLY: '1',
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.example',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    }, reads);
    const createServerClient = await loadServerClient();
    const { createClient } = await import('@supabase/supabase-js');
    reads.length = 0;

    createServerClient();
    createServerClient({ revalidate: 60 });

    expect(reads).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    const calls = (createClient as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call[1]).toBe(ANON);
  });

  it('(2) without the flag and without a service-role key, the server client refuses to start', async () => {
    const reads: string[] = [];
    envWith({
      STAGING_READ_ONLY: undefined,
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.example',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    }, reads);
    const createServerClient = await loadServerClient();

    expect(() => createServerClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY required/);
  });

  it('without the flag, a present service-role key is used (production unchanged)', async () => {
    const reads: string[] = [];
    envWith({
      STAGING_READ_ONLY: undefined,
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.example',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    }, reads);
    const createServerClient = await loadServerClient();
    const { createClient } = await import('@supabase/supabase-js');

    createServerClient();

    const calls = (createClient as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[calls.length - 1][1]).toBe(SERVICE);
  });
});

describe('the production deploy never turns staging read-only mode on', () => {
  const PRODUCTION_FILES = [
    '.github/workflows/deploy-cloudflare.yml',
    'wrangler.jsonc',
  ];
  for (const f of PRODUCTION_FILES) {
    it(`${f} does not set STAGING_READ_ONLY`, () => {
      expect(readFileSync(join(root, f), 'utf8')).not.toMatch(/STAGING_READ_ONLY/);
    });
  }

  it('the staging Worker config sets it', () => {
    expect(readFileSync(join(root, 'wrangler.staging.jsonc'), 'utf8')).toMatch(/"STAGING_READ_ONLY":\s*"1"/);
  });
});
