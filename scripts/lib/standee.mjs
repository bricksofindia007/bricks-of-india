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

export const STANDEE_START = '2026-10-15';   // the day the QR went up; the since-start window
// Source tag of the seeded baseline rows: the last follower read before the standee (see the growth migration).
export const PRE_STANDEE_SOURCE = 'pre_standee_seed';
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

/**
 * Baseline = the seeded pre-standee read for the platform (source PRE_STANDEE_SOURCE), which is the last
 * count taken before the standee went up. Latest = the most recent read after it.
 * No seeded baseline -> "baseline pending". A baseline with no newer read -> "no read since".
 */
export function followerChange(rows, platform) {
  const mine = rows.filter((r) => r.platform === platform).sort((a, b) => a.captured_on.localeCompare(b.captured_on));
  const base = mine.find((r) => r.source === PRE_STANDEE_SOURCE);
  if (!base) return { platform, status: 'baseline pending' };
  const baseline = {
    followers: num(base.followers),
    capturedAt: base.captured_at,
  };
  const after = mine.filter((r) => r.captured_on > base.captured_on);
  const latest = after.at(-1);
  if (!latest) return { platform, status: 'no read since', baseline };
  return {
    platform,
    status: 'ok',
    baseline,
    latest: { followers: num(latest.followers), capturedOn: latest.captured_on },
    change: num(latest.followers) - baseline.followers,
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
    const name = label(f.platform);
    if (f.status === 'baseline pending') {
      out.push(`${name} followers: baseline pending (no pre-standee read on record).`);
    } else if (f.status === 'no read since') {
      out.push(`${name} followers: ${f.baseline.followers} at the last pre-standee read (${fmtWhen(f.baseline.capturedAt)}). No newer read yet.`);
    } else {
      const sign = f.change > 0 ? '+' : '';
      out.push(`${name} followers: ${f.latest.followers} as of ${fmtDate(f.latest.capturedOn)}, ` +
        `${sign}${f.change} since the last pre-standee read (${f.baseline.followers}, read ${fmtWhen(f.baseline.capturedAt)}).`);
    }
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

/** ISO UTC timestamp -> "8 Oct, 01:11 UTC". */
function fmtWhen(iso) {
  return `${fmtDate(iso.slice(0, 10))}, ${iso.slice(11, 16)} UTC`;
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
      // All rows, not just since 15 Oct: the seeded pre-standee baselines are dated before it.
      q(`select platform, captured_on::text as captured_on, source, followers,
                to_char(captured_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as captured_at
           from growth.follower_snapshots`),
    ]);
    return { today, campaignSessions, siteSessions, pageViews, clicks, followers };
  } finally {
    await client.end();
  }
}
