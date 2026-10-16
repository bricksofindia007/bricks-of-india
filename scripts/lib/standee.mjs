/**
 * Standee performance block for the morning brief (growth engine data).
 *
 * Source: the growth schema in the BOI Supabase project, read by the read-only
 * growth_brief role (see the growth repo's migrations/2026-10-16_standee_tracking.sql).
 * Only this file and morning-brief.mjs know about that schema; the brief itself
 * never writes anything.
 *
 * Failure rule: a missing or failing read must never stop the brief from sending.
 * The caller turns any error into one "unavailable" line (see standeeLines).
 */

export const STANDEE_START = '2026-10-15';   // the day the QR went up; also the follower baseline day
export const CLICK_EVENTS = ['click'];        // standee click event name is UNCONFIRMED (growth issue); widen once confirmed
const PAGES = ['/about', '/sets'];

const num = (v) => (v == null ? null : Number(v));

/**
 * @param {object} input
 * @param {string} input.today  IST date, YYYY-MM-DD
 * @param {Array<{metric_date:string, geo:string, value:any}>} input.campaignSessions  campaign sessions, geo all|india
 * @param {Array<{metric_date:string, geo:string, value:any}>} input.siteSessions      site-wide sessions, geo all|india
 * @param {Array<{metric_date:string, dimension_value:string, value:any}>} input.pageViews  /about, /sets (geo all)
 * @param {Array<{metric_date:string, value:any}>} input.clicks   summed CLICK_EVENTS per day (geo all)
 * @param {Array<{platform:string, captured_on:string, followers:any}>} input.followers
 */
export function summariseStandee({ today, campaignSessions, siteSessions, pageViews, clicks, followers }) {
  const days = new Set([
    ...campaignSessions.map((r) => r.metric_date),
    ...clicks.map((r) => r.metric_date),
    ...pageViews.map((r) => r.metric_date),
  ]);
  const latestDay = days.size ? [...days].sort().at(-1) : null;

  const dayTotals = (date) => {
    if (!date) return null;
    const sessions = campaignSessions.filter((r) => r.metric_date === date);
    if (!sessions.length) return null;
    const sum = (rows) => rows.reduce((a, r) => a + num(r.value), 0);
    return {
      date,
      sessions: sum(sessions.filter((r) => r.geo === 'all')),
      sessionsIndia: sum(sessions.filter((r) => r.geo === 'india')),
      clicks: sum(clicks.filter((r) => r.metric_date === date)),
      about: sum(pageViews.filter((r) => r.metric_date === date && r.dimension_value === '/about')),
      sets: sum(pageViews.filter((r) => r.metric_date === date && r.dimension_value === '/sets')),
    };
  };

  // Since-start totals. Only additive measures are summed: sessions, clicks and page
  // views. activeUsers is deliberately NOT summed across days (a person counts on each day).
  const sinceFrom = (rows, geo) => rows.filter((r) => r.metric_date >= STANDEE_START && (geo == null || r.geo === geo));
  const since = {
    sessions: sinceFrom(campaignSessions, 'all').reduce((a, r) => a + num(r.value), 0),
    sessionsIndia: sinceFrom(campaignSessions, 'india').reduce((a, r) => a + num(r.value), 0),
    clicks: clicks.filter((r) => r.metric_date >= STANDEE_START).reduce((a, r) => a + num(r.value), 0),
    about: pageViews.filter((r) => r.metric_date >= STANDEE_START && r.dimension_value === '/about')
      .reduce((a, r) => a + num(r.value), 0),
    sets: pageViews.filter((r) => r.metric_date >= STANDEE_START && r.dimension_value === '/sets')
      .reduce((a, r) => a + num(r.value), 0),
    siteSessions: sinceFrom(siteSessions, 'all').reduce((a, r) => a + num(r.value), 0),
  };

  return {
    today,
    yesterday: shiftDay(today, -1),
    latest: dayTotals(latestDay),
    since,
    followers: ['instagram', 'youtube'].map((p) => followerChange(followers, p)),
  };
}

/** Baseline = the snapshot on STANDEE_START. Failing that, the first one after it, flagged approximate. */
export function followerChange(rows, platform) {
  const mine = rows.filter((r) => r.platform === platform).sort((a, b) => a.captured_on.localeCompare(b.captured_on));
  const base = mine.find((r) => r.captured_on === STANDEE_START) ?? mine.find((r) => r.captured_on > STANDEE_START);
  const latest = mine.at(-1);
  if (!base || !latest) return { platform, status: 'baseline pending' };
  return {
    platform,
    status: 'ok',
    baselineDate: base.captured_on,
    baselineExact: base.captured_on === STANDEE_START,
    baseline: num(base.followers),
    latestDate: latest.captured_on,
    latest: num(latest.followers),
    change: num(latest.followers) - num(base.followers),
  };
}

/** Plain-wording lines for the brief card. Each line is one <p>. */
export function standeeLines(summary) {
  if (summary.error) return [`Unavailable: ${summary.error}`];
  const out = [];
  const L = summary.latest;
  if (!L) {
    out.push('No GA4 data for the standee campaign has been reported yet (GA4 runs 1–2 days behind).');
  } else {
    const which = L.date === summary.yesterday ? 'Yesterday' : 'Latest GA4 day';
    out.push(`${which} (${fmtDate(L.date)}): ${L.sessions} sessions (${L.sessionsIndia} from India), ` +
      `${L.clicks} clicks, ${L.about} /about visits, ${L.sets} /sets visits.`);
  }
  const s = summary.since;
  const share = s.siteSessions > 0 ? ` That is ${((s.sessions / s.siteSessions) * 100).toFixed(1)}% of all site sessions.` : '';
  out.push(`Since 15 Oct: ${s.sessions} sessions (${s.sessionsIndia} from India), ${s.clicks} clicks, ` +
    `${s.about} /about visits, ${s.sets} /sets visits.${share}`);
  for (const f of summary.followers) {
    if (f.status !== 'ok') {
      out.push(`${label(f.platform)} followers: baseline pending (no snapshot yet).`);
      continue;
    }
    const sign = f.change > 0 ? '+' : '';
    const basis = f.baselineExact ? '15 Oct' : `${fmtDate(f.baselineDate)}, not 15 Oct`;
    out.push(`${label(f.platform)} followers: ${f.latest} now, ${sign}${f.change} vs ${f.baseline} on ${basis}.`);
  }
  return out;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const label = (p) => (p === 'instagram' ? 'Instagram' : 'YouTube');

function shiftDay(ymd, delta) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function fmtDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

// ── DB read (the only part that touches the network) ──────────────────────────

/**
 * Reads the six small queries the summary needs, through the read-only growth_brief role.
 * `pg` is loaded lazily so the pure functions above (and their tests) never need it.
 */
export async function fetchStandeeData(connectionString, { today }) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({
    connectionString,
    statement_timeout: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  try {
    const q = (text, params) => client.query(text, params).then((r) => r.rows);
    const [campaignSessions, siteSessions, pageViews, clicks, followers] = await Promise.all([
      q(`select metric_date::text as metric_date, geo, value from growth.ga4_campaign_metrics
           where scope = 'campaign' and breakdown = 'total' and metric = 'sessions' and metric_date >= $1`, [STANDEE_START]),
      q(`select metric_date::text as metric_date, geo, value from growth.ga4_campaign_metrics
           where scope = 'site_wide' and breakdown = 'total' and metric = 'sessions' and geo = 'all' and metric_date >= $1`, [STANDEE_START]),
      q(`select metric_date::text as metric_date, dimension_value, value from growth.ga4_campaign_metrics
           where scope = 'campaign' and geo = 'all' and breakdown = 'page' and metric = 'page_view'
             and dimension_value = any($1) and metric_date >= $2`, [PAGES, STANDEE_START]),
      q(`select metric_date::text as metric_date, sum(value) as value from growth.ga4_campaign_metrics
           where scope = 'campaign' and geo = 'all' and breakdown = 'event' and metric = 'eventCount'
             and dimension_value = any($1) and metric_date >= $2 group by metric_date`, [CLICK_EVENTS, STANDEE_START]),
      q(`select platform, captured_on::text as captured_on, followers from growth.follower_snapshots
           where captured_on >= $1`, [STANDEE_START]),
    ]);
    return { today, campaignSessions, siteSessions, pageViews, clicks, followers };
  } finally {
    await client.end();
  }
}
