// Egress projection alert: email when the state changes, not every day the projection stays above the line.
//
// States: null (below the warning line), 'warning' (projected at or above the alert line), 'critical' (at or above the block line).
// The health check emails on a first crossing (last state null) and on a new higher band. It stays silent while the
// band is unchanged, and it resets to null when the projection falls below the line, so a later crossing emails again.
//
// Pure. The last-sent state must be stored between runs (the health check is a scheduled job). No store exists yet,
// so this rule is not wired into scripts/health-check.mjs until that storage is approved.

const RANK = { warning: 1, critical: 2 };

/**
 * band: 'warning' | 'critical' | null, from today's projection.
 * lastSentBand: the band last emailed and still open, or null.
 * Returns { emit, nextState, reason }. nextState is what to store after this run.
 */
export function egressAlertDecision(band, lastSentBand) {
  const last = lastSentBand ?? null;
  if (band == null) return { emit: false, nextState: null, reason: 'below the warning line; state reset' };
  if (!(band in RANK)) throw new Error(`unknown egress band: ${band}`);
  if (last == null) return { emit: true, nextState: band, reason: 'first crossing' };
  if (RANK[band] > RANK[last]) return { emit: true, nextState: band, reason: `higher band (was ${last})` };
  return { emit: false, nextState: last, reason: `same band (${last}) already emailed` };
}
