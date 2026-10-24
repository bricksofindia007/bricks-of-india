// Health check in the scheduler Worker: first slice of the port of the scheduled health check.
// Staging only, behind a flag that is off by default. No schedule is attached in this slice, so nothing runs.
// The checks themselves are not ported yet. Until they are, a run records ok=false with reason "checks_not_ported"
// so the heartbeat never reads as healthy when no check has run. No secret is written to the heartbeat or a response.

export const HEALTH_KEY = 'meta:health:heartbeat';
export const HEALTH_FLAG = 'health_check_enabled';

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface HealthEnv {
  BOI_SNAPSHOTS: KvLike;
  TARGET: string;
}

export interface HealthResult {
  ok: boolean;
  ran: boolean;
  reason: string;
}

/** Pure: whether this run may do anything. Staging only, and only when the flag is explicitly true. */
export function healthGate(target: string, flags: Record<string, unknown>): { allowed: boolean; reason: string } {
  if (target !== 'staging') return { allowed: false, reason: 'not_staging' };
  if (flags[HEALTH_FLAG] !== true) return { allowed: false, reason: 'flag_off' };
  return { allowed: true, reason: 'allowed' };
}

/** Pure: the heartbeat record. Carries no secret and no check output. */
export function healthRecord(result: HealthResult, at: string, target: string) {
  return { at, target, ok: result.ok, ran: result.ran, reason: result.reason };
}

export async function runHealthCheck(env: HealthEnv, flags: Record<string, unknown>, nowIso = new Date().toISOString()): Promise<HealthResult> {
  const gate = healthGate(env.TARGET, flags);
  let result: HealthResult;
  if (!gate.allowed) {
    result = { ok: false, ran: false, reason: gate.reason };
  } else {
    // Not ported yet. Recorded as not healthy on purpose.
    result = { ok: false, ran: false, reason: 'checks_not_ported' };
  }
  await env.BOI_SNAPSHOTS.put(HEALTH_KEY, JSON.stringify(healthRecord(result, nowIso, env.TARGET)));
  return result;
}

export interface StalenessResult {
  ok: boolean;
  ageHours: number | null;
  reason: 'fresh' | 'stale' | 'no_timestamp' | 'bad_timestamp';
}

/** Pure: is a last-seen timestamp within the allowed age. Missing or unreadable input is never reported as fresh. */
export function evaluateStaleness(lastIso: string | null | undefined, nowIso: string, maxHours: number): StalenessResult {
  if (!lastIso) return { ok: false, ageHours: null, reason: 'no_timestamp' };
  const last = Date.parse(lastIso);
  const now = Date.parse(nowIso);
  if (Number.isNaN(last) || Number.isNaN(now)) return { ok: false, ageHours: null, reason: 'bad_timestamp' };
  const ageHours = Math.max(0, (now - last) / 3_600_000);
  return ageHours <= maxHours
    ? { ok: true, ageHours, reason: 'fresh' }
    : { ok: false, ageHours, reason: 'stale' };
}

// Capacity check (first real check ported). Thresholds are inputs; the Worker does not read the database here.
export interface CapacityLimits { dbWarnMb: number; dbCritMb: number; storageWarnMb: number; storageCritMb: number }
export type CapacityLevel = 'ok' | 'warning' | 'critical' | 'unknown';
export interface CapacityResult { db: CapacityLevel; storage: CapacityLevel; failures: string[] }

function level(value: number, warn: number, crit: number): CapacityLevel {
  if (!Number.isFinite(value)) return 'unknown';
  if (value >= crit) return 'critical';
  if (value >= warn) return 'warning';
  return 'ok';
}

/** Pure: database and storage sizes against their warning and critical lines. An unreadable size is never reported as ok. */
export function evaluateCapacity(dbMb: number, storageMb: number, limits: CapacityLimits): CapacityResult {
  const db = level(dbMb, limits.dbWarnMb, limits.dbCritMb);
  const storage = level(storageMb, limits.storageWarnMb, limits.storageCritMb);
  const failures: string[] = [];
  if (db === 'unknown') failures.push('capacity-unreadable-db');
  else if (db !== 'ok') failures.push(`db-size-${db}`);
  if (storage === 'unknown') failures.push('capacity-unreadable-storage');
  else if (storage !== 'ok') failures.push(`storage-size-${storage}`);
  return { db, storage, failures };
}
