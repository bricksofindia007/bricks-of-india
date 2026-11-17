// FP6.4: what the usage gate does when the egress figure cannot be read.
// Pure functions only. scripts/quota-gate.mjs does the I/O (state file, alert send).
//
// Rules:
//  (a) A live reading always wins and is remembered. An unreadable reading uses the
//      last remembered egress figure only if it is under 24 hours old. With no recent
//      figure, the egress question fails closed, as before.
//      Readings at or above the thresholds still block (quota-guard.mjs decides that).
//  (b) At most one usage-unreadable notice per calendar day (IST).
//  (c) A blocked video generation run sends a no-video-today notice with the reason.
//  (d) Publishing is not behind the gate, so nothing here changes it.

export const LAST_KNOWN_MAX_HOURS = 24;
const HOUR_MS = 3600e3;
const IST_OFFSET_MS = 5.5 * HOUR_MS;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Calendar day in IST as YYYY-MM-DD. */
export function istDay(now) {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Clock time in IST, for example "17 Nov 2026 10:05 IST". */
export function istClock(now) {
  const s = new Date(now.getTime() + IST_OFFSET_MS).toISOString();
  return `${Number(s.slice(8, 10))} ${MONTHS[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)} ${s.slice(11, 16)} IST`;
}

/**
 * Pick the egress figure for this run.
 * @param {number|null} liveGb  projected egress from the live reading, or null if unreadable
 * @param {object} state        { lastEgress?: {gb, at}, egressUnreadableSince?, unreadableNoticeDay? }
 * @param {Date} now
 * @returns {{ egressProjectedGb: number|null, source: 'live'|'last-known'|'none',
 *            ageHours: number|null, liveUnreadable: boolean, sinceIso: string|null, nextState: object }}
 */
export function resolveEgress(liveGb, state = {}, now = new Date()) {
  const nowIso = now.toISOString();
  if (Number.isFinite(liveGb)) {
    return {
      egressProjectedGb: liveGb, source: 'live', ageHours: 0, liveUnreadable: false, sinceIso: null,
      nextState: { ...state, lastEgress: { gb: liveGb, at: nowIso }, egressUnreadableSince: null },
    };
  }
  const sinceIso = state.egressUnreadableSince ?? nowIso;
  const last = state.lastEgress;
  const ageHours = last && Number.isFinite(last.gb) ? (now.getTime() - new Date(last.at).getTime()) / HOUR_MS : null;
  const nextState = { ...state, egressUnreadableSince: sinceIso };
  if (ageHours !== null && ageHours >= 0 && ageHours < LAST_KNOWN_MAX_HOURS) {
    return { egressProjectedGb: last.gb, source: 'last-known', ageHours, liveUnreadable: true, sinceIso, nextState };
  }
  return { egressProjectedGb: null, source: 'none', ageHours: ageHours ?? null, liveUnreadable: true, sinceIso, nextState };
}

/** Rule (b): send the usage-unreadable notice at most once per IST day. */
export function takeUnreadableNotice(state = {}, now = new Date()) {
  const day = istDay(now);
  if (state.unreadableNoticeDay === day) return { send: false, nextState: state };
  return { send: true, nextState: { ...state, unreadableNoticeDay: day } };
}

const VIDEO_LABELS = Object.freeze({
  'video-generate-daily': 'VID-P4',
  'video-generate-quiet-panic': 'Quiet Panic',
});
export const isVideoGeneration = (job) => Object.prototype.hasOwnProperty.call(VIDEO_LABELS, job);
export const videoLabel = (job) => VIDEO_LABELS[job] ?? job;

/** Rule (b) text, standard alert format: what, since when, visitors affected, owner action. */
export function unreadableNotice({ now, sinceIso, resolved }) {
  const since = sinceIso ? istClock(new Date(sinceIso)) : 'unknown';
  const what = resolved.source === 'last-known'
    ? `The egress figure could not be read. The usage gate is using the last figure, from ${istClock(new Date(resolved.lastAtIso))}, which is ${resolved.ageHours.toFixed(1)} hours old.`
    : 'The egress figure could not be read, and there is no figure from the last 24 hours. Jobs that need the egress figure are paused.';
  const visitors = resolved.source === 'last-known'
    ? 'Not affected. Pages, published videos and publishing all run as normal.'
    : 'Pages and published videos are not affected. New videos, the morning brief and the approval digest may not run today.';
  const owner = 'Check the egress figure on the Supabase usage page. No action is needed if this notice stops once the figure reads again.';
  return {
    subject: '⚠️ BOI usage figure unreadable: egress',
    body: `What: ${what}\nSince: ${since} (checked ${istClock(now)})\nVisitors affected: ${visitors}\nOwner action: ${owner}`,
  };
}

/** Rule (c) text: a blocked video generation run always says there is no video today, and why. */
export function noVideoTodayNotice({ job, now, reasonLines }) {
  const label = videoLabel(job);
  return {
    subject: `⚠️ ${label} no video today: usage gate paused generation`,
    body: `What: ${label} video was not generated today (${istClock(now)}). The usage gate blocked the run.\n` +
      `Reason: ${reasonLines}\n` +
      `Since: ${istClock(now)}\n` +
      `Visitors affected: Yes for the next ${label} slot. No new video is ready for it. Videos already published are not affected.\n` +
      `Owner action: Check the usage figure. The next scheduled run tries again. If the reason is an unreadable egress figure, the figure is the thing to check.`,
  };
}
