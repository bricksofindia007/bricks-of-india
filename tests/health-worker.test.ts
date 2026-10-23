// Health check in the scheduler Worker (first slice): staging only, flag off by default, heartbeat written every run.
import { describe, it, expect, vi } from 'vitest';
import { runHealthCheck, healthGate, HEALTH_KEY, HEALTH_FLAG, type KvLike } from '../workers/boi-scheduler/src/health';

function kv() {
  const store = new Map<string, string>();
  const k: KvLike = {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
  };
  return { k, store };
}

describe('healthGate', () => {
  it('refuses anything that is not staging', () => {
    expect(healthGate('production', { [HEALTH_FLAG]: true })).toEqual({ allowed: false, reason: 'not_staging' });
  });
  it('refuses on staging while the flag is off or missing', () => {
    expect(healthGate('staging', {})).toEqual({ allowed: false, reason: 'flag_off' });
    expect(healthGate('staging', { [HEALTH_FLAG]: 'true' })).toEqual({ allowed: false, reason: 'flag_off' });
  });
  it('allows staging only when the flag is exactly true', () => {
    expect(healthGate('staging', { [HEALTH_FLAG]: true }).allowed).toBe(true);
  });
});

describe('runHealthCheck', () => {
  it('flag off: writes a heartbeat that says it did not run, and no check is attempted', async () => {
    const { k, store } = kv();
    const r = await runHealthCheck({ BOI_SNAPSHOTS: k, TARGET: 'staging' }, {}, '2026-10-23T12:00:00.000Z');
    expect(r).toEqual({ ok: false, ran: false, reason: 'flag_off' });
    expect(JSON.parse(store.get(HEALTH_KEY)!)).toEqual({ at: '2026-10-23T12:00:00.000Z', target: 'staging', ok: false, ran: false, reason: 'flag_off' });
  });
  it('flag on but checks not ported: never reads as healthy', async () => {
    const { k, store } = kv();
    const r = await runHealthCheck({ BOI_SNAPSHOTS: k, TARGET: 'staging' }, { [HEALTH_FLAG]: true }, '2026-10-23T12:00:00.000Z');
    expect(r.ok).toBe(false);
    expect(JSON.parse(store.get(HEALTH_KEY)!).reason).toBe('checks_not_ported');
  });
  it('heartbeat carries no secret-like fields', async () => {
    const { k, store } = kv();
    await runHealthCheck({ BOI_SNAPSHOTS: k, TARGET: 'production' }, { [HEALTH_FLAG]: true });
    expect(Object.keys(JSON.parse(store.get(HEALTH_KEY)!)).sort()).toEqual(['at', 'ok', 'ran', 'reason', 'target']);
  });
});
