// Health check in the scheduler Worker (first slice): staging only, flag off by default, heartbeat written every run.
import { describe, it, expect, vi } from 'vitest';
import { runHealthCheck, healthGate, evaluateStaleness, HEALTH_KEY, HEALTH_FLAG, type KvLike } from '../workers/boi-scheduler/src/health';

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

describe('evaluateStaleness', () => {
  const NOW = '2026-10-23T12:00:00.000Z';
  it('fresh when inside the allowed age', () => {
    const r = evaluateStaleness('2026-10-23T06:00:00.000Z', NOW, 24);
    expect(r).toEqual({ ok: true, ageHours: 6, reason: 'fresh' });
  });
  it('stale when older than the allowed age', () => {
    expect(evaluateStaleness('2026-10-20T12:00:00.000Z', NOW, 24).reason).toBe('stale');
  });
  it('a missing timestamp is never fresh', () => {
    expect(evaluateStaleness(null, NOW, 24)).toEqual({ ok: false, ageHours: null, reason: 'no_timestamp' });
  });
  it('an unreadable timestamp is never fresh', () => {
    expect(evaluateStaleness('not a date', NOW, 24)).toEqual({ ok: false, ageHours: null, reason: 'bad_timestamp' });
  });
});

import { evaluateCapacity } from '../workers/boi-scheduler/src/health';

describe('evaluateCapacity', () => {
  const L = { dbWarnMb: 400, dbCritMb: 450, storageWarnMb: 800, storageCritMb: 900 };
  it('ok below the warning lines', () => {
    expect(evaluateCapacity(100, 100, L)).toEqual({ db: 'ok', storage: 'ok', failures: [] });
  });
  it('warning at the warning line, critical at the critical line', () => {
    expect(evaluateCapacity(400, 800, L).failures).toEqual(['db-size-warning', 'storage-size-warning']);
    expect(evaluateCapacity(450, 900, L).failures).toEqual(['db-size-critical', 'storage-size-critical']);
  });
  it('an unreadable size is never ok', () => {
    const r = evaluateCapacity(Number.NaN, 100, L);
    expect(r.db).toBe('unknown');
    expect(r.failures).toEqual(['capacity-unreadable-db']);
  });
});

import { checkNewsFreshness, checkRadarFreshness, checkPriceFreshness } from '../workers/boi-scheduler/src/health';

describe('checkNewsFreshness', () => {
  const NOW = '2026-10-24T12:00:00.000Z';
  it('fresh within 7 days', () => {
    expect(checkNewsFreshness('2026-10-20T12:00:00.000Z', NOW, false)).toEqual({ ok: true, kind: 'fresh', failure: null, ageDays: 4 });
  });
  it('stale after 7 days, with the script failure name', () => {
    const r = checkNewsFreshness('2026-10-10T12:00:00.000Z', NOW, false);
    expect(r).toMatchObject({ ok: false, kind: 'stale', failure: 'news-stale' });
  });
  it('no article row at all is an infrastructure failure, never fresh', () => {
    expect(checkNewsFreshness(null, NOW, false)).toMatchObject({ ok: false, kind: 'infra', failure: 'news-freshness-crashed' });
  });
  it('a failed read is an infrastructure failure, not staleness', () => {
    expect(checkNewsFreshness('2026-10-24T11:00:00.000Z', NOW, true)).toEqual({ ok: false, kind: 'infra', failure: 'news-freshness-crashed', ageDays: null });
  });
});

describe('checkRadarFreshness', () => {
  const NOW = '2026-10-24T12:00:00.000Z';
  it('fresh within 25 hours', () => {
    expect(checkRadarFreshness('2026-10-24T06:00:00.000Z', NOW, false)).toEqual({ ok: true, kind: 'fresh', failure: null, ageHours: 6 });
  });
  it('stale after 25 hours, with the script failure name', () => {
    expect(checkRadarFreshness('2026-10-22T12:00:00.000Z', NOW, false)).toMatchObject({ ok: false, kind: 'stale', failure: 'radar-stale' });
  });
  it('no signal row, or a failed read, is an infrastructure failure', () => {
    expect(checkRadarFreshness(null, NOW, false)).toMatchObject({ kind: 'infra', failure: 'radar-check-error' });
    expect(checkRadarFreshness('2026-10-24T11:00:00.000Z', NOW, true)).toMatchObject({ kind: 'infra', failure: 'radar-check-error' });
  });
});

describe('checkPriceFreshness', () => {
  const NOW = '2026-10-24T12:00:00.000Z';
  it('fresh within 26 hours', () => {
    expect(checkPriceFreshness('2026-10-24T01:00:00.000Z', NOW, false)).toEqual({ ok: true, kind: 'fresh', failure: null, ageHours: 11 });
  });
  it('stale after 26 hours, with the script failure name', () => {
    expect(checkPriceFreshness('2026-10-23T09:00:00.000Z', NOW, false)).toMatchObject({ ok: false, kind: 'stale', failure: 'prices-stale' });
  });
  it('no row, or a failed read, is an infrastructure failure', () => {
    expect(checkPriceFreshness(null, NOW, false)).toMatchObject({ kind: 'infra', failure: 'prices-check-error' });
    expect(checkPriceFreshness('2026-10-24T11:00:00.000Z', NOW, true)).toMatchObject({ kind: 'infra', failure: 'prices-check-error' });
  });
});
