// Staging load generator for the deploy gate measurement (docs/release/gates/MEASUREMENT.md; addendum 2, 23 Oct 2026).
// Staging only. It sends the committed production load profile to the staging site at a fixed rate for a fixed
// window, and writes a heartbeat (G13) with the counts for each minute. Nothing is sent outside the window, and nothing
// is sent when the target is not staging or the site address is missing (G14: fail honest, never send to production).
// Request volume (G2): 60 requests per minute while the window is open, 1 request per second (about 86,400 a day).

export const LOADGEN_CRON = '* * * * *';
export const LOADGEN_KEY = 'meta:loadgen:heartbeat';
export const PER_MINUTE = 60;
export const REQUEST_TIMEOUT_MS = 15_000;

export interface Profile { classes: { template: string; share: number }[] }
export type Samples = Record<string, string[]>;   // route template -> concrete paths on staging, from the staging sitemap

export interface LoadgenEnv {
  BOI_SNAPSHOTS: { get(k: string): Promise<string | null>; put(k: string, v: string): Promise<void> };
  TARGET: string;
  STAGING_SITE_URL?: string;     // e.g. the staging site address (a variable, not a secret)
  LOADGEN_START?: string;        // ISO time; the window opens here
  LOADGEN_END?: string;          // ISO time; the window closes here
  LOADGEN_ENABLED?: boolean;     // the flag (flag:v1.loadgen_enabled); off unless exactly true, so nothing is sent
}

/** Pure. Seeded pseudo-random numbers in [0, 1) (mulberry32), so the same seed gives the same sequence. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pure. The window is open for start <= now < end, and only if both times parse and end is after start. */
export function inWindow(nowMs: number, startIso?: string, endIso?: string): boolean {
  const s = startIso ? Date.parse(startIso) : NaN;
  const e = endIso ? Date.parse(endIso) : NaN;
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return false;
  return nowMs >= s && nowMs < e;
}

/** Pure. Picks a route template by its share of the profile. Templates with no sample paths are skipped and their share is renormalised. */
export function pickTemplate(profile: Profile, samples: Samples, rand: () => number): string | null {
  const usable = profile.classes.filter((c) => (samples[c.template] ?? []).length > 0 && c.share > 0);
  const total = usable.reduce((n, c) => n + c.share, 0);
  if (total <= 0) return null;
  let x = rand() * total;
  for (const c of usable) {
    x -= c.share;
    if (x < 0) return c.template;
  }
  return usable[usable.length - 1].template;
}

/** Pure. The paths to request in one minute: PER_MINUTE picks from the profile, each with a seeded choice of sample path. */
export function planMinute(profile: Profile, samples: Samples, seed: number, count = PER_MINUTE): { paths: string[]; skipped: number } {
  const rand = seededRandom(seed);
  const paths: string[] = [];
  let skipped = 0;
  for (let i = 0; i < count; i++) {
    const t = pickTemplate(profile, samples, rand);
    if (!t) { skipped++; continue; }
    const list = samples[t];
    paths.push(list[Math.floor(rand() * list.length)]);
  }
  return { paths, skipped };
}

export interface MinuteResult { minute: string; planned: number; sent: number; ok: number; errors: number; skipped: number; state: 'sent' | 'closed' | 'refused' | 'off' }

/** Sends one minute's plan to the staging site and records the counts. Never sends outside the window or off staging. */
export async function runMinute(
  env: LoadgenEnv,
  profile: Profile,
  samples: Samples,
  nowMs: number,
  fetchImpl: typeof fetch = fetch,
  spacingMs = 60000 / PER_MINUTE,   // one request about every second; tests pass 0
): Promise<MinuteResult> {
  const minute = new Date(Math.floor(nowMs / 60000) * 60000).toISOString();
  // Flag first: when off, no request is built or sent. The heartbeat still records the minute.
  if (env.LOADGEN_ENABLED !== true) {
    const r: MinuteResult = { minute, planned: 0, sent: 0, ok: 0, errors: 0, skipped: 0, state: 'off' };
    await env.BOI_SNAPSHOTS.put(LOADGEN_KEY, JSON.stringify(r));
    return r;
  }
  const base = (env.STAGING_SITE_URL ?? '').replace(/\/$/, '');
  if (env.TARGET !== 'staging' || !base) {
    const r: MinuteResult = { minute, planned: 0, sent: 0, ok: 0, errors: 0, skipped: 0, state: 'refused' };
    await env.BOI_SNAPSHOTS.put(LOADGEN_KEY, JSON.stringify(r));
    return r;
  }
  if (!inWindow(nowMs, env.LOADGEN_START, env.LOADGEN_END)) {
    const r: MinuteResult = { minute, planned: 0, sent: 0, ok: 0, errors: 0, skipped: 0, state: 'closed' };
    await env.BOI_SNAPSHOTS.put(LOADGEN_KEY, JSON.stringify(r));
    return r;
  }
  const seed = Math.floor(nowMs / 60000);
  const plan = planMinute(profile, samples, seed);
  let ok = 0, errors = 0;
  // Spread the requests across the minute: one every 1000 ms / PER_MINUTE * 60 (about one per second).
  await Promise.all(plan.paths.map(async (p, i) => {
    await new Promise((res) => setTimeout(res, Math.floor(i * spacingMs)));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetchImpl(base + p, { method: 'GET', redirect: 'manual', signal: controller.signal });
      await res.body?.cancel();
      if (res.status < 400) ok++; else errors++;
    } catch {
      errors++;  // the error text is not recorded: it can echo request details
    } finally {
      clearTimeout(timer);
    }
  }));
  const r: MinuteResult = { minute, planned: PER_MINUTE, sent: plan.paths.length, ok, errors, skipped: plan.skipped, state: 'sent' };
  await env.BOI_SNAPSHOTS.put(LOADGEN_KEY, JSON.stringify(r));
  return r;
}
