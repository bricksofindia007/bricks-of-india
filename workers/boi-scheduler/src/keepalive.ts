// Staging keep-alive, ported from .github/workflows/staging-keepalive.yml (23 Oct 2026, addendum 2, job 1 of 6).
// One read of one staging row, twice a week, so the staging database is not paused for inactivity.
// Staging only: on the production target this is inert (no staging key there). Writes its own heartbeat (G13).
// Failure behaviour (G14): a failed read is recorded in the heartbeat as ok=false with the HTTP status; nothing
// else changes. The key is never written to the heartbeat, a log line or a response.

export const KEEPALIVE_CRON = '17 6 * * 1,4';   // Mondays and Thursdays 06:17 UTC, as the Actions copy
export const KEEPALIVE_KEY = 'meta:keepalive:heartbeat';
export const KEEPALIVE_TIMEOUT_MS = 20_000;     // the Actions copy used a 20 s cap

// The KV surface this module uses (the Worker's own type is not visible to the site typecheck).
export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface KeepAliveEnv {
  BOI_SNAPSHOTS: KvLike;
  TARGET: string;
  STAGING_SUPABASE_URL?: string;
  STAGING_SUPABASE_PUBLISHABLE_KEY?: string;
}

export interface KeepAliveResult {
  ok: boolean;
  status: number;        // 0 when no response (timeout or network error) or when skipped
  skipped: boolean;
}

/** Pure: the heartbeat record written to KV. Carries no secret. */
export function heartbeatRecord(result: KeepAliveResult, at: string, target: string) {
  return { at, target, ok: result.ok, status: result.status, skipped: result.skipped };
}

/** Pure: the request the keep-alive sends. */
export function keepAliveRequest(url: string, key: string): { url: string; init: RequestInit } {
  return {
    url: `${url.replace(/\/$/, '')}/rest/v1/blog_posts?select=id&limit=1`,
    init: { method: 'GET', headers: { apikey: key, Authorization: `Bearer ${key}` } },
  };
}

export async function runKeepAlive(env: KeepAliveEnv, fetchImpl: typeof fetch = fetch, nowIso = new Date().toISOString()): Promise<KeepAliveResult> {
  if (env.TARGET !== 'staging' || !env.STAGING_SUPABASE_URL || !env.STAGING_SUPABASE_PUBLISHABLE_KEY) {
    const skipped = { ok: true, status: 0, skipped: true };
    await env.BOI_SNAPSHOTS.put(KEEPALIVE_KEY, JSON.stringify(heartbeatRecord(skipped, nowIso, env.TARGET)));
    return skipped;
  }
  const req = keepAliveRequest(env.STAGING_SUPABASE_URL, env.STAGING_SUPABASE_PUBLISHABLE_KEY);
  let result: KeepAliveResult;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KEEPALIVE_TIMEOUT_MS);
  try {
    const res = await fetchImpl(req.url, { ...req.init, signal: controller.signal });
    await res.body?.cancel();   // discard the body; only the status is needed
    result = { ok: res.status === 200, status: res.status, skipped: false };
  } catch {
    // Network error or timeout. The error text is not logged: it can echo request details.
    result = { ok: false, status: 0, skipped: false };
  } finally {
    clearTimeout(timer);
  }
  await env.BOI_SNAPSHOTS.put(KEEPALIVE_KEY, JSON.stringify(heartbeatRecord(result, nowIso, env.TARGET)));
  return result;
}
