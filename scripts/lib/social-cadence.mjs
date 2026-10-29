// Social automation cadence. The social run is weekly (one scheduled run on Mondays), so its
// "last post" window is eight days: a Monday post stays fresh until the following Tuesday.
// Used by scripts/technical-hygiene.mjs and checked against the freshness watchlist by tests.

export const SOCIAL_MAX_HOURS = 8 * 24;

/**
 * Pure. Given the latest posted_at (ISO string) and the current time (ms), returns the age in hours
 * and whether the last post is inside the window (equal to the window counts as inside).
 */
export function socialPostStatus(lastPostIso, nowMs) {
  const hoursAgo = (nowMs - new Date(lastPostIso).getTime()) / 3_600_000;
  return { hoursAgo, fresh: hoursAgo <= SOCIAL_MAX_HOURS };
}
