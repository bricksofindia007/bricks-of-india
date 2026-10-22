// Staging keep-alive in the scheduler Worker (addendum 2, job 1): staging only, one read, heartbeat, no secret in output.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runKeepAlive, keepAliveRequest, KEEPALIVE_CRON, KEEPALIVE_KEY, type KvLike } from '../workers/boi-scheduler/src/keepalive';
import { RESERVED_RE } from '../workers/boi-scheduler/src/auth';

const root = join(__dirname, '..');
const KEY = 'sb_publishable_TESTKEY_123';
const URL_ = 'https://staging-test.supabase.co';

function kv() {
  const store = new Map<string, string>();
  return {
    store,
    kv: {
      get: async (k: string) => store.get(k) ?? null,
      put: async (k: string, v: string) => { store.set(k, v); },
    } as KvLike,
  };
}
const body = (text: string) => new Response(text, { status: 200 });

describe('runKeepAlive', () => {
  it('is inert on the production target: no read, heartbeat says skipped', async () => {
    const { kv: k, store } = kv();
    const f = vi.fn();
    const r = await runKeepAlive({ BOI_SNAPSHOTS: k, TARGET: 'production', STAGING_SUPABASE_URL: URL_, STAGING_SUPABASE_PUBLISHABLE_KEY: KEY }, f as unknown as typeof fetch);
    expect(f).not.toHaveBeenCalled();
    expect(r.skipped).toBe(true);
    expect(JSON.parse(store.get(KEEPALIVE_KEY)!).skipped).toBe(true);
  });

  it('is inert on staging when the URL or the key is missing', async () => {
    const { kv: k } = kv();
    const f = vi.fn();
    const r = await runKeepAlive({ BOI_SNAPSHOTS: k, TARGET: 'staging' }, f as unknown as typeof fetch);
    expect(f).not.toHaveBeenCalled();
    expect(r.skipped).toBe(true);
  });

  it('a 200 from staging is recorded as ok', async () => {
    const { kv: k, store } = kv();
    const f = vi.fn(async () => body('[{"id":1}]'));
    const r = await runKeepAlive({ BOI_SNAPSHOTS: k, TARGET: 'staging', STAGING_SUPABASE_URL: URL_, STAGING_SUPABASE_PUBLISHABLE_KEY: KEY }, f as unknown as typeof fetch, '2026-10-23T06:17:00.000Z');
    expect(f).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ ok: true, status: 200, skipped: false });
    expect(JSON.parse(store.get(KEEPALIVE_KEY)!)).toEqual({ at: '2026-10-23T06:17:00.000Z', target: 'staging', ok: true, status: 200, skipped: false });
  });

  it('a non-200 is recorded as not ok, with its status', async () => {
    const { kv: k, store } = kv();
    const f = vi.fn(async () => new Response('nope', { status: 503 }));
    const r = await runKeepAlive({ BOI_SNAPSHOTS: k, TARGET: 'staging', STAGING_SUPABASE_URL: URL_, STAGING_SUPABASE_PUBLISHABLE_KEY: KEY }, f as unknown as typeof fetch);
    expect(r.ok).toBe(false);
    expect(JSON.parse(store.get(KEEPALIVE_KEY)!).status).toBe(503);
  });

  it('a network error is recorded as not ok with status 0, and its text is not stored', async () => {
    const { kv: k, store } = kv();
    const f = vi.fn(async () => { throw new Error(`request to ${URL_} failed with key ${KEY}`); });
    const r = await runKeepAlive({ BOI_SNAPSHOTS: k, TARGET: 'staging', STAGING_SUPABASE_URL: URL_, STAGING_SUPABASE_PUBLISHABLE_KEY: KEY }, f as unknown as typeof fetch);
    expect(r).toEqual({ ok: false, status: 0, skipped: false });
    expect(store.get(KEEPALIVE_KEY)).not.toContain(KEY);
  });

  it('the heartbeat never contains the key', async () => {
    const { kv: k, store } = kv();
    await runKeepAlive({ BOI_SNAPSHOTS: k, TARGET: 'staging', STAGING_SUPABASE_URL: URL_, STAGING_SUPABASE_PUBLISHABLE_KEY: KEY }, (async () => body('[]')) as unknown as typeof fetch);
    expect(store.get(KEEPALIVE_KEY)).not.toContain(KEY);
  });
});

describe('keepAliveRequest', () => {
  it('puts the key in headers only, never in the URL', () => {
    const req = keepAliveRequest(`${URL_}/`, KEY);
    expect(req.url).toBe(`${URL_}/rest/v1/blog_posts?select=id&limit=1`);
    expect(req.url).not.toContain(KEY);
    expect((req.init.headers as Record<string, string>).apikey).toBe(KEY);
    expect(req.init.method).toBe('GET');
  });
});

describe('wiring', () => {
  it('the cron constant matches the staging cron in wrangler.jsonc', () => {
    const wrangler = readFileSync(join(root, 'workers/boi-scheduler/wrangler.jsonc'), 'utf8');
    expect(wrangler).toContain(`"${KEEPALIVE_CRON}"`);
  });
  it('the heartbeat key is reserved, so a signed client write cannot forge it', () => {
    expect(RESERVED_RE.test(KEEPALIVE_KEY)).toBe(true);
  });
  it('the scheduled handler routes the keep-alive cron to the keep-alive', () => {
    const src = readFileSync(join(root, 'workers/boi-scheduler/src/index.ts'), 'utf8');
    expect(src).toMatch(/if \(ev\.cron === KEEPALIVE_CRON\) ctx\.waitUntil\(runKeepAlive\(env\)\)/);
  });
});
