// Freshness watchdog, ported from .github/workflows/workflow-freshness-watchdog.yml (23 Oct 2026, addendum 2, job 2 of 4).
// Checks that each watched scheduled workflow has a successful run within its expected interval, and emails the alert
// contact when one has gone stale or cannot be checked. Staging first; the Actions copy stays until the Worker run is proven.
// Failure behaviour (G14): a failed read of one workflow is reported as a check error (not as stale, not as fresh).
// The read token is never written to the heartbeat, a log line, or an email. Writes its own heartbeat (G13).

export const FRESHNESS_CRON = '10 3 * * *';        // 03:10 UTC, after the scrape crons at 03:00 and 03:05
export const FRESHNESS_KEY = 'meta:freshness:heartbeat';
export const READ_TIMEOUT_MS = 10_000;

/** filename -> [expected interval hours, alert multiple]. The same list as the workflow it replaces. */
export const WATCHLIST: Record<string, [number, number]> = {
  'technical-hygiene.yml': [7 * 24, 2],
  'catalogue-audit.yml': [7 * 24, 2],
  'code-audit.yml': [7 * 24, 2],
  'health-check.yml': [24, 2],
  'social-automation.yml': [24, 2],
  'scrape-prices.yml': [26, 1],
  'generate-drafts.yml': [24, 2],
  'radar.yml': [24, 2],
  'model-canary.yml': [24, 2],
  'snapshot-prices.yml': [24, 2],
  'retiring-soon.yml': [7 * 24, 2],
  'reviews-weekly-refresh.yml': [7 * 24, 2],
  'sync-catalogue.yml': [7 * 24, 2],
  'retention-cleanup.yml': [7 * 24, 2],
  'generate-guide-weekly.yml': [7 * 24, 2],
};

export interface FreshnessEnv {
  BOI_SNAPSHOTS: { put(k: string, v: string): Promise<void> };
  TARGET: string;
  GITHUB_REPO?: string;
  GITHUB_READ_TOKEN?: string;      // Worker secret: a read-only token for workflow runs (actions:read)
  RESEND_API_KEY?: string;         // Worker secret, as the alert module uses
  BRIEF_EMAIL?: string;            // Worker secret: the alert contact
  ALERTS_ENABLED?: string;         // 'true' to send mail; drills keep it off unless intended
}

export interface Verdict { file: string; kind: 'stale' | 'no-runs' | 'error'; reason: string }
export interface FreshnessResult { checked: number; stale: Verdict[]; errors: Verdict[]; ok: boolean }

/**
 * Pure. Decides each file's state from its latest completed run time (ISO) or a read error.
 * @param {Record<string, string|null|{error:string}>} latest  per file: the run's created_at, null when there are no runs, or an error
 */
export function evaluateFreshness(latest: Record<string, string | null | { error: string }>, nowMs: number, watch = WATCHLIST): { stale: Verdict[]; errors: Verdict[] } {
  const stale: Verdict[] = [];
  const errors: Verdict[] = [];
  for (const [file, [hours, mult]] of Object.entries(watch)) {
    const v = latest[file];
    if (v && typeof v === 'object') { errors.push({ file, kind: 'error', reason: v.error.slice(0, 200) }); continue; }
    if (v === null || v === undefined) { stale.push({ file, kind: 'no-runs', reason: 'no successful run found' }); continue; }
    const ageH = (nowMs - Date.parse(v)) / 3600000;
    const limit = hours * mult;
    if (!Number.isFinite(ageH)) { errors.push({ file, kind: 'error', reason: 'run time could not be read' }); continue; }
    if (ageH > limit) stale.push({ file, kind: 'stale', reason: `last successful run ${ageH.toFixed(1)} h ago, expected within about ${limit} h (${hours} h interval x${mult})` });
  }
  return { stale, errors };
}

/** Pure. The alert mail body. Names files and reasons only. */
export function alertBody(result: FreshnessResult, repo: string): { subject: string; text: string } {
  const subject = `BOI Watchdog: ${result.stale.length} scheduled workflow(s) gone stale`;
  const lines = [
    `${result.stale.length} watched workflow(s) have gone stale: no recent run within their expected interval.`,
    '',
    ...result.stale.map((s) => `- ${s.file}: ${s.reason}`),
    ...(result.errors.length ? ['', `${result.errors.length} workflow(s) could not be checked:`, ...result.errors.map((e) => `- ${e.file}: ${e.reason}`)] : []),
    '',
    `Check: https://github.com/${repo}/actions`,
  ];
  return { subject, text: lines.join('\n') };
}

/**
 * One read of one workflow's latest successful run. A run counts only when its conclusion is success:
 * failed, cancelled and timed-out runs are not fresh. Throws on HTTP or network failure.
 */
export async function latestRun(file: string, env: FreshnessEnv, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${file}/runs?per_page=5&status=success`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      headers: { authorization: `Bearer ${env.GITHUB_READ_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'boi-freshness' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as { workflow_runs?: { created_at: string; conclusion?: string | null }[] };
    const success = (j.workflow_runs ?? []).find((r) => r.conclusion === 'success');
    return success ? success.created_at : null;
  } finally {
    clearTimeout(timer);
  }
}

/** Runs the whole check: reads every watched workflow, evaluates, records the heartbeat, and sends the alert when enabled. */
export async function runFreshnessWatchdog(
  env: FreshnessEnv,
  fetchImpl: typeof fetch = fetch,
  nowMs = Date.now(),
  sendMail: (subject: string, text: string) => Promise<void> = async () => {},
): Promise<FreshnessResult> {
  if (env.TARGET !== 'staging' && env.TARGET !== 'production') throw new Error('unknown target');
  const latest: Record<string, string | null | { error: string }> = {};
  if (!env.GITHUB_REPO || !env.GITHUB_READ_TOKEN) {
    for (const f of Object.keys(WATCHLIST)) latest[f] = { error: 'read token or repository not configured' };
  } else {
    for (const f of Object.keys(WATCHLIST)) {
      try { latest[f] = await latestRun(f, env, fetchImpl); }
      catch (e) { latest[f] = { error: (e as Error).message }; }
    }
  }
  const { stale, errors } = evaluateFreshness(latest, nowMs);
  const result: FreshnessResult = { checked: Object.keys(WATCHLIST).length, stale, errors, ok: errors.length === 0 && stale.length === 0 };
  await env.BOI_SNAPSHOTS.put(FRESHNESS_KEY, JSON.stringify({ at: new Date(nowMs).toISOString(), target: env.TARGET, checked: result.checked, stale: stale.length, errors: errors.length, ok: result.ok }));
  if ((stale.length || errors.length) && env.ALERTS_ENABLED === 'true' && env.RESEND_API_KEY && env.BRIEF_EMAIL) {
    const { subject, text } = alertBody(result, env.GITHUB_REPO ?? '');
    await sendMail(subject, text);
  }
  return result;
}

/** Sends one alert mail through the same provider and contact as the health check. Throws on a failed send. */
export async function sendAlertMail(env: FreshnessEnv, subject: string, text: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: 'BOI Alerts <alerts@bricksofindia.com>', to: [env.BRIEF_EMAIL], subject, text }),
  });
  if (!res.ok) throw new Error(`alert mail failed: HTTP ${res.status}`);
}
