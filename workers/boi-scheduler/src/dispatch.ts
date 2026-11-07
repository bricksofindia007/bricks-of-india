// Workflow dispatches from the scheduler Worker (FP5.9 for the scrape; order 0970 for the video publish pollers).
// The Cloudflare cron is reliable; GitHub's own */15 schedule is best-effort and ran 3 to 4 times a day
// (5 and 6 Nov: no run fell inside the evening slot). So the Worker asks GitHub to run the publish poller at
// its slot time, and once more an hour later as a retry.
//
// Failure behaviour (G14): a dispatch that fails is recorded (meta:dispatch:<name> with the HTTP status, and
// meta:dispatch_fail). Nothing is posted by the Worker itself. A poller run that finds nothing approved, or a
// row already published today, does nothing (cadence.py). So a retry can never post a second video on the same day.
//
// Gate: inert unless BOTH the BOI_SCHEDULER_DISPATCH_TOKEN secret exists AND flag:v1.dispatch_enabled is true,
// and only on the production Worker. The same switches the scrape dispatch uses.

export const VERSION_UA = 'boi-scheduler/1';

/** The KV methods the dispatcher uses (structural, so the site's tsconfig needs no Worker types). */
export interface DispatchKv {
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
}

export interface DispatchEnv {
  BOI_SNAPSHOTS: DispatchKv;
  BOI_SCHEDULER_DISPATCH_TOKEN?: string;
  TARGET: string;
  GITHUB_REPO: string;
}

/**
 * The production cron expressions (UTC) and what each one dispatches. Each key is the cron string exactly as it is
 * configured in wrangler.jsonc, because index.ts looks the entry up by the event's cron. Day names are used because
 * Cloudflare numbers the days 1 = Sunday to 7 = Saturday and rejects 0 (cron syntax, Cloudflare Workers docs).
 * Slots are read from scripts/video/cadence.py.
 */
export const VIDEO_DISPATCH: Record<string, { file: string; name: string }> = {
  // VID-P4 slot opens 19:30 IST on Wed, Fri, Sun. Dispatch 19:35 IST (14:05 UTC); retry 20:35 IST (15:05 UTC).
  '5 14 * * SUN,WED,FRI': { file: 'video-publish-poller.yml', name: 'vidp4-slot' },
  '5 15 * * SUN,WED,FRI': { file: 'video-publish-poller.yml', name: 'vidp4-retry' },
  // VID-QP slot opens 00:00 IST on Tue, Thu, Sat (Mon, Wed, Fri in UTC). Dispatch 00:05 IST (18:35 UTC); retry 01:05 IST (19:35 UTC).
  '35 18 * * MON,WED,FRI': { file: 'video-publish-poller-quiet-panic.yml', name: 'vidqp-slot' },
  '35 19 * * MON,WED,FRI': { file: 'video-publish-poller-quiet-panic.yml', name: 'vidqp-retry' },
};

/**
 * Asks GitHub to run one workflow on main. Returns the final HTTP status, or 0 when the gate is closed.
 * `waits` are the pauses before each attempt (the scrape uses 0, 30 and 90 seconds). Tests pass zeros.
 */
export async function dispatchWorkflow(
  env: DispatchEnv,
  file: string,
  inputs: Record<string, string>,
  noteName: string,
  slot: string,
  waits: number[] = [0, 30, 90],
): Promise<number> {
  const flags = ((await env.BOI_SNAPSHOTS.get('flag:v1', 'json')) ?? {}) as { dispatch_enabled?: boolean };
  if (!env.BOI_SCHEDULER_DISPATCH_TOKEN || flags.dispatch_enabled !== true || env.TARGET !== 'production') return 0; // inert
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${file}/dispatches`;
  let status = 0;
  for (const waitS of waits) {
    if (waitS) await new Promise((r) => setTimeout(r, waitS * 1000));
    const r = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.BOI_SCHEDULER_DISPATCH_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': VERSION_UA, 'content-type': 'application/json' },
      body: JSON.stringify({ ref: 'main', inputs }),
    });
    status = r.status;
    if (r.ok) break;
  }
  const note = { slot, store: inputs.store ?? null, workflow: file, dispatched_at: new Date().toISOString(), http_status: status };
  await env.BOI_SNAPSHOTS.put(`meta:dispatch:${noteName}`, JSON.stringify(note));
  if (status < 200 || status >= 300) await env.BOI_SNAPSHOTS.put('meta:dispatch_fail', JSON.stringify(note));
  return status;
}

/** The scrape crons (UTC) and the retailer each one scrapes (FP5.9). */
export const SCRAPE_STORE_BY_CRON: Record<string, string> = { '0 3 * * *': 'mybrickhouse', '5 3 * * *': 'toycra' };

// Cloudflare cron day-of-week: 1 = Sunday to 7 = Saturday, or SUN to SAT (Cloudflare Workers cron triggers docs).
// JavaScript getUTCDay numbering is 0 = Sunday, so a number n maps to n - 1.
const DAY_NAME_JS: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

function cronDays(field: string): number[] {
  return field.split(',').map((part) => {
    const named = DAY_NAME_JS[part.toUpperCase()];
    if (named !== undefined) return named;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 1 || n > 7) throw new Error(`unsupported day-of-week "${part}"`);
    return n - 1;
  });
}

const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** "weekday hour minute" (UTC, JavaScript numbering) -> the production cron text that fires then. Built from the tables. */
export const TIME_INDEX: Record<string, string> = (() => {
  const index: Record<string, string> = {};
  for (const cron of [...Object.keys(SCRAPE_STORE_BY_CRON), ...Object.keys(VIDEO_DISPATCH)]) {
    const [minute, hour, , , dow] = cron.split(' ');
    const days = dow === '*' ? [0, 1, 2, 3, 4, 5, 6] : cronDays(dow);
    for (const day of days) {
      const k = `${day} ${Number(hour)} ${Number(minute)}`;
      if (has(index, k) && index[k] !== cron) throw new Error(`two crons fire at the same time: ${index[k]} and ${cron}`);
      index[k] = cron;
    }
  }
  return index;
})();

/**
 * Which table entry this event belongs to (order 1000). An exact match on the cron text wins. Otherwise the event's
 * scheduled time is matched against the table. 'none' means nothing is configured for that time: do nothing.
 */
export function resolveCron(cron: string, scheduledMs: number): { match: 'exact' | 'fallback' | 'none'; key: string | null } {
  if (has(VIDEO_DISPATCH, cron) || has(SCRAPE_STORE_BY_CRON, cron)) return { match: 'exact', key: cron };
  const d = new Date(scheduledMs);
  const key = has(TIME_INDEX, `${d.getUTCDay()} ${d.getUTCHours()} ${d.getUTCMinutes()}`)
    ? TIME_INDEX[`${d.getUTCDay()} ${d.getUTCHours()} ${d.getUTCMinutes()}`]
    : null;
  return key ? { match: 'fallback', key } : { match: 'none', key: null };
}

/** What one scheduled event does: which scrape and which video entry to dispatch, and how the match was made. */
export function planScheduled(cron: string, scheduledMs: number): {
  match: 'exact' | 'fallback' | 'none';
  resolved_cron: string | null;
  store: string | null;
  video: { file: string; name: string } | null;
} {
  const r = resolveCron(cron, scheduledMs);
  if (!r.key) return { match: r.match, resolved_cron: null, store: null, video: null };
  return {
    match: r.match,
    resolved_cron: r.key,
    store: has(SCRAPE_STORE_BY_CRON, r.key) ? SCRAPE_STORE_BY_CRON[r.key] : null,
    video: has(VIDEO_DISPATCH, r.key) ? VIDEO_DISPATCH[r.key] : null,
  };
}
