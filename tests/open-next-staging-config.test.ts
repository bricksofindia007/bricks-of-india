/**
 * The staging build keeps no page cache, queue, tag cache or purge storage (BOI_STAGING=1).
 * Production keeps every one of them. Both are checked by loading the real config file.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';

async function loadConfig(staging: boolean) {
  if (staging) process.env.BOI_STAGING = '1';
  else delete process.env.BOI_STAGING;
  vi.resetModules();
  const mod = await import('../open-next.config');
  return mod.default as { default: { override: Record<string, unknown> } };
}

afterEach(() => {
  delete process.env.BOI_STAGING;
  vi.resetModules();
});

describe('open-next config: staging keeps no cache storage', () => {
  it('uses the dummy defaults for every storage override', async () => {
    const cfg = await loadConfig(true);
    const o = cfg.default.override;
    expect(o.incrementalCache).toBe('dummy');
    expect(o.tagCache).toBe('dummy');
    expect(o.queue).toBe('dummy');
    expect(o.cdnInvalidation).toBe('dummy');
  });

  it('does not reference the Durable Object or R2 override modules in the staging branch', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync('open-next.config.ts', 'utf8'));
    const stagingBranch = src.slice(src.indexOf('? defineCloudflareConfig({'), src.indexOf(': defineCloudflareConfig({'));
    expect(stagingBranch).not.toMatch(/r2IncrementalCache|doQueue|doShardedTagCache|purgeCache/);
  });
});

describe('open-next config: production is unchanged', () => {
  it('keeps the R2 page cache, the queue, the tag cache and the purge', async () => {
    const cfg = await loadConfig(false);
    const o = cfg.default.override;
    expect(typeof o.incrementalCache).toBe('function');
    expect(typeof o.tagCache).toBe('function');
    expect(typeof o.queue).toBe('function');
    expect(typeof o.cdnInvalidation).toBe('function');
  });

  it('turns on cache interception only in production', async () => {
    const prod = await loadConfig(false);
    expect((prod as unknown as { dangerous: { enableCacheInterception: boolean } }).dangerous.enableCacheInterception).toBe(true);
    const staging = await loadConfig(true);
    expect((staging as unknown as { dangerous: { enableCacheInterception: boolean } }).dangerous.enableCacheInterception).toBe(false);
  });
});
