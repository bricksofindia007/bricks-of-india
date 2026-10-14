// Capacity guard (2026-09-26): month-to-date Supabase egress and log-ingest
// estimates from daily snapshots of the API-role call counter (see migration
// 20260926050000_capacity_usage_snapshots.sql for the why and calibration).

// Calibration (2026-09-26, cycle 09-11..09-26): ~740k API-gateway requests
// against the dashboard's 2.05 GB egress and 1.73 GB log ingest; 2.25
// pg_stat_statements API-role calls per gateway request (edge-log windows).
export const CALLS_PER_REQUEST = 2.25;
export const EGRESS_BYTES_PER_REQUEST = 2770;
export const LOG_BYTES_PER_REQUEST = 2340;

// Free-plan quotas as shown on this project's usage dashboard.
export const EGRESS_QUOTA_GB = 5;
export const LOG_INGEST_QUOTA_GB = 1;
export const WARN_PCT = 70;
export const CRIT_PCT = 85;

// The billing cycle resets on the 11th (operator, 2026-09-26).
export const CYCLE_ANCHOR_DAY = 11;

/** Start of the billing cycle containing `now` (UTC midnight on the anchor day). */
export function cycleStart(now = new Date(), anchorDay = CYCLE_ANCHOR_DAY) {
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const thisMonth = new Date(Date.UTC(y, m, anchorDay));
  return now >= thisMonth ? thisMonth : new Date(Date.UTC(y, m - 1, anchorDay));
}

/** Start of the next cycle after `start`. */
export function cycleEnd(start) {
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate()));
}

/**
 * snapshots: [{ taken_at, api_calls }] oldest first (any span). Sums the
 * positive counter growth inside the current cycle; a counter that went DOWN
 * means pg_stat_statements was reset (e.g. a restart), so that interval counts
 * the new value from zero. When the snapshots cover only part of the elapsed
 * cycle, the observed rate is extrapolated to the whole elapsed period and the
 * result is flagged `extrapolated`.
 */
export function estimateCycleUsage(snapshots, now = new Date()) {
  const start = cycleStart(now);
  const end = cycleEnd(start);
  const rows = snapshots
    .map((s) => ({ t: new Date(s.taken_at), calls: Number(s.api_calls) }))
    .filter((s) => Number.isFinite(s.calls))
    .sort((a, b) => a.t - b.t);

  // Keep the last snapshot before the cycle start as the baseline, if any.
  const before = rows.filter((s) => s.t < start);
  const inside = rows.filter((s) => s.t >= start && s.t <= now);
  const series = before.length ? [before[before.length - 1], ...inside] : inside;
  if (series.length < 2) return { ok: false, reason: 'need at least two snapshots in this cycle', start, end };

  let calls = 0;
  for (let i = 1; i < series.length; i++) {
    const d = series[i].calls - series[i - 1].calls;
    calls += d >= 0 ? d : series[i].calls;
  }
  const from = series[0].t < start ? start : series[0].t;
  const observedMs = series[series.length - 1].t - from;
  const elapsedMs = now - start;
  const cycleMs = end - start;
  const extrapolated = from > start || observedMs < elapsedMs * 0.98;
  // If the baseline predates the cycle, scale its interval's calls to the
  // part inside the cycle; covered by the observed/elapsed ratio below.
  const spanMs = series[series.length - 1].t - series[0].t;
  const ratePerMs = spanMs > 0 ? calls / spanMs : 0;
  const mtdCalls = ratePerMs * elapsedMs;
  const requests = mtdCalls / CALLS_PER_REQUEST;
  const egressGB = (requests * EGRESS_BYTES_PER_REQUEST) / 1e9;
  const logGB = (requests * LOG_BYTES_PER_REQUEST) / 1e9;
  const scale = cycleMs / elapsedMs;
  return {
    ok: true,
    start, end, extrapolated,
    observedDays: observedMs / 86_400_000,
    elapsedDays: elapsedMs / 86_400_000,
    requests: Math.round(requests),
    egressGB, logGB,
    egressPct: (egressGB / EGRESS_QUOTA_GB) * 100,
    logPct: (logGB / LOG_INGEST_QUOTA_GB) * 100,
    projectedEgressGB: egressGB * scale,
    projectedLogGB: logGB * scale,
  };
}

/** 'critical' | 'warning' | null for a percentage of quota. */
export function level(pct) {
  if (pct >= CRIT_PCT) return 'critical';
  if (pct >= WARN_PCT) return 'warning';
  return null;
}
