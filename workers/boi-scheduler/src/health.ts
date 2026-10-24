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

// News freshness check (health check, check 1): stale after 7 days. A failed read is an infrastructure failure,
// reported as its own kind, never as staleness.
export const NEWS_MAX_DAYS = 7;
export interface NewsFreshnessResult {
  ok: boolean;
  kind: 'fresh' | 'stale' | 'infra';
  failure: 'news-stale' | 'news-freshness-crashed' | null;
  ageDays: number | null;
}

/** Pure: the news freshness rule. queryFailed means the read itself broke. */
export function checkNewsFreshness(publishedAt: string | null | undefined, nowIso: string, queryFailed: boolean): NewsFreshnessResult {
  // A failed read, or no row at all (the script's single-row read errors on zero rows), is an infrastructure failure.
  if (queryFailed || !publishedAt) return { ok: false, kind: 'infra', failure: 'news-freshness-crashed', ageDays: null };
  const r = evaluateStaleness(publishedAt, nowIso, NEWS_MAX_DAYS * 24);
  if (r.ok) return { ok: true, kind: 'fresh', failure: null, ageDays: r.ageHours === null ? null : r.ageHours / 24 };
  return { ok: false, kind: 'stale', failure: 'news-stale', ageDays: r.ageHours === null ? null : r.ageHours / 24 };
}

// RADAR freshness check (health check, check 3): stale after 25 hours. A failed or empty read is an infrastructure failure.
export const RADAR_MAX_HOURS = 25;
export interface RadarFreshnessResult {
  ok: boolean;
  kind: 'fresh' | 'stale' | 'infra';
  failure: 'radar-stale' | 'radar-check-error' | null;
  ageHours: number | null;
}

/** Pure: the RADAR freshness rule. */
export function checkRadarFreshness(fetchedAt: string | null | undefined, nowIso: string, queryFailed: boolean): RadarFreshnessResult {
  if (queryFailed || !fetchedAt) return { ok: false, kind: 'infra', failure: 'radar-check-error', ageHours: null };
  const r = evaluateStaleness(fetchedAt, nowIso, RADAR_MAX_HOURS);
  if (r.ok) return { ok: true, kind: 'fresh', failure: null, ageHours: r.ageHours };
  return { ok: false, kind: 'stale', failure: 'radar-stale', ageHours: r.ageHours };
}

// Store price freshness check (health check, check 5): stale after 26 hours. A failed or empty read is an infrastructure failure.
export const PRICES_MAX_HOURS = 26;
export interface PriceFreshnessResult {
  ok: boolean;
  kind: 'fresh' | 'stale' | 'infra';
  failure: 'prices-stale' | 'prices-check-error' | null;
  ageHours: number | null;
}

/** Pure: the store price freshness rule. Carries no price value. */
export function checkPriceFreshness(scrapedAt: string | null | undefined, nowIso: string, queryFailed: boolean): PriceFreshnessResult {
  if (queryFailed || !scrapedAt) return { ok: false, kind: 'infra', failure: 'prices-check-error', ageHours: null };
  const r = evaluateStaleness(scrapedAt, nowIso, PRICES_MAX_HOURS);
  if (r.ok) return { ok: true, kind: 'fresh', failure: null, ageHours: r.ageHours };
  return { ok: false, kind: 'stale', failure: 'prices-stale', ageHours: r.ageHours };
}

// Pending drafts backlog (health check, check 7): alert above 50 approved drafts. A failed read is an infrastructure failure.
// A missing count is treated as unreadable here. The script reads a missing count as zero, which would show no backlog.
export const DRAFTS_BACKLOG_MAX = 50;
export interface DraftsBacklogResult {
  ok: boolean;
  kind: 'ok' | 'backlog' | 'infra';
  failure: 'drafts-backlog' | 'drafts-check-error' | null;
  count: number | null;
}

/** Pure: the approved-drafts backlog rule. Carries no draft text. */
export function checkDraftsBacklog(count: number | null | undefined, queryFailed: boolean): DraftsBacklogResult {
  if (queryFailed || count === null || count === undefined || !Number.isFinite(count)) {
    return { ok: false, kind: 'infra', failure: 'drafts-check-error', count: null };
  }
  if (count > DRAFTS_BACKLOG_MAX) return { ok: false, kind: 'backlog', failure: 'drafts-backlog', count };
  return { ok: true, kind: 'ok', failure: null, count };
}
