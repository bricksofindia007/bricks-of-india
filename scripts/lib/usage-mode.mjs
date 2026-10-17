// Usage mode for the daily usage guard (Master Plan D13, 17 Oct 2026).
//
// Why: Cloudflare cannot hard-cap spend, so this code does. Each metric is
// read once a day and compared with its included allowance. The mode is the
// worst of the metrics:
//   normal   below 60% of the allowance
//   warn     60% and above: one line to the ops alert path
//   shed     80% and above: the site serves cached pages only, skips
//            cache-refresh writes, and the scheduler skips non-essential jobs
//   minimum  95% and above: only public pages and uptime checks keep running
//
// The mode is recomputed on every run, so when usage falls back under a
// threshold the mode returns to normal on its own. Clearing the flag is the
// same as a normal reading.
//
// A metric that cannot be read is "unknown". Unknown never triggers shed or
// minimum (that would switch the site off on a read error); it warns, so the
// gap is visible in the daily line.
//
// Pacing: the allowance is also pro-rated to the day of the cycle, shown as
// "pace" in each line. Pace is for reading only; it does not set the mode.

export const THRESHOLDS = Object.freeze({ warn: 0.6, shed: 0.8, minimum: 0.95 });

export const MODE_ORDER = Object.freeze(['normal', 'unknown', 'warn', 'shed', 'minimum']);

/** Mode for one fraction of allowance used (0..n). Boundaries are inclusive. */
export function modeForFraction(fraction) {
  if (!Number.isFinite(fraction)) return 'unknown';
  if (fraction >= THRESHOLDS.minimum) return 'minimum';
  if (fraction >= THRESHOLDS.shed) return 'shed';
  if (fraction >= THRESHOLDS.warn) return 'warn';
  return 'normal';
}

/** Allowance pro-rated to the day of the cycle (dayOfCycle 1..cycleDays). */
export function prorated(allowance, dayOfCycle, cycleDays) {
  if (!(allowance > 0) || !(cycleDays > 0)) return null;
  const day = Math.min(Math.max(dayOfCycle, 0), cycleDays);
  return (allowance * day) / cycleDays;
}

/**
 * One metric reading.
 *   { name, unit, used, allowance, dayOfCycle, cycleDays }
 * used === null means the reading failed.
 */
export function evaluateMetric(m) {
  const base = { name: m.name, unit: m.unit, used: m.used, allowance: m.allowance };
  if (m.used === null || m.used === undefined || !Number.isFinite(m.used) || !(m.allowance > 0)) {
    return { ...base, fraction: null, pace: null, mode: 'unknown' };
  }
  const fraction = m.used / m.allowance;
  const pace = prorated(m.allowance, m.dayOfCycle, m.cycleDays);
  return { ...base, fraction, pace, mode: modeForFraction(fraction) };
}

/**
 * Overall result for one run.
 *   { mode, metrics, flag, line }
 * mode is the worst metric mode. "unknown" ranks below "warn", so one failed
 * read never raises the mode above warn by itself.
 */
export function evaluateUsage(metrics) {
  const rows = metrics.map(evaluateMetric);
  let mode = 'normal';
  for (const r of rows) {
    if (MODE_ORDER.indexOf(r.mode) > MODE_ORDER.indexOf(mode)) mode = r.mode;
  }
  return { mode, metrics: rows, flag: flagFor(mode), line: dailyLine(mode, rows) };
}

/**
 * What the Worker and the scheduler read. Shed and minimum switch things off.
 * Unknown and warn change nothing.
 */
export function flagFor(mode) {
  return {
    mode,
    servePageCacheOnly: mode === 'shed' || mode === 'minimum',
    skipCacheRefreshWrites: mode === 'shed' || mode === 'minimum',
    schedulerEssentialOnly: mode === 'shed' || mode === 'minimum',
    publicPagesAndUptimeOnly: mode === 'minimum',
  };
}

/** One line for the existing ops alert path, for each daily run. */
export function dailyLine(mode, rows) {
  const parts = rows.map((r) => {
    if (r.fraction === null) return `${r.name} unreadable`;
    const pct = Math.round(r.fraction * 1000) / 10;
    const pace = r.pace === null ? '' : `, pace ${Math.round((r.used / r.pace) * 1000) / 10}% of pro-rated`;
    return `${r.name} ${pct}%${pace}`;
  });
  return `[usage] mode ${mode}: ${parts.join('; ')}`;
}
