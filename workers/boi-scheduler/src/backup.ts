// Backup dispatch (P32). Starts five workflows at fixed Mon/Wed/Fri times, but only if GitHub's own
// schedule has not started them today (IST). Inert unless flag:v1.backup_dispatch_enabled is true AND
// the dispatch token exists AND TARGET is production.
//
// Failure behaviour (G14): if the run list cannot be read, the backup SKIPS (never guesses). If a
// dispatch is sent and the outcome is unknown, its claim is kept, so the same day is never retried
// automatically (a double start is worse than a missed backup).

// Slot time (UTC) -> workflow. GitHub's own crons start these about 5-7 h after their nominal time
// (observed 5-14 Oct 2026, gh run list), so each backup sits after the latest observed start.
export const BACKUP_JOBS: Record<number, { file: string; label: string }> = {
  9: { file: 'video-generate-daily.yml', label: 'VID-P4 generation' },
  12: { file: 'video-generate-quiet-panic.yml', label: 'VID-QP generation' },
  13: { file: 'video-publish-poller-quiet-panic.yml', label: 'VID-QP publish poller' },
  15: { file: 'video-publish-poller.yml', label: 'VID-P4 publish poller' },
  17: { file: 'social-automation.yml', label: 'Social automation' },
};
export const BACKUP_CRON = '30 9,12,13,15,17 * * 1,3,5';
const MINUTE = 30;

const IST_OFFSET_MS = 5.5 * 3600 * 1000;

/** IST calendar day (YYYY-MM-DD) for an instant. */
export function istDay(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The instant the IST day starts, as ISO with offset (accepted by the GitHub runs `created` filter). */
export function istMidnightIso(day: string): string {
  return `${day}T00:00:00+05:30`;
}

/** Map a scheduled instant to its backup job, or null if it is not a backup slot. */
export function jobForSlot(at: Date): { file: string; label: string } | null {
  const hourUtc = at.getUTCHours();
  const monWedFri = [1, 3, 5].includes(at.getUTCDay());
  if (at.getUTCMinutes() !== MINUTE || !monWedFri) return null;
  return BACKUP_JOBS[hourUtc] ?? null;
}

export type BackupInput = {
  isProduction: boolean;
  flagOn: boolean;
  hasToken: boolean;
  alreadyClaimed: boolean;
  /** Runs of this workflow created since IST midnight; null = could not read them. */
  startedToday: number | null;
};

/** Pure decision. Every skip names its reason, so the KV note says why nothing ran. */
export function decideBackup(i: BackupInput): { action: 'dispatch' | 'skip'; reason: string } {
  if (!i.isProduction) return { action: 'skip', reason: 'not production' };
  if (!i.flagOn) return { action: 'skip', reason: 'flag off' };
  if (!i.hasToken) return { action: 'skip', reason: 'no dispatch token' };
  if (i.alreadyClaimed) return { action: 'skip', reason: 'already claimed today' };
  if (i.startedToday === null) return { action: 'skip', reason: 'could not read runs (fail safe)' };
  if (i.startedToday > 0) return { action: 'skip', reason: `already started today (${i.startedToday} run(s))` };
  return { action: 'dispatch', reason: 'not started today' };
}

/** Count runs of one workflow created since IST midnight. Throws on any HTTP error. */
export async function countRunsToday(token: string, repo: string, file: string, day: string): Promise<number> {
  const q = new URLSearchParams({ created: `>=${istMidnightIso(day)}`, per_page: '1' });
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${file}/runs?${q}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'boi-scheduler/backup' },
  });
  if (!r.ok) throw new Error(`runs list HTTP ${r.status}`);
  const j = (await r.json()) as { total_count?: number };
  if (typeof j.total_count !== 'number') throw new Error('runs list: no total_count');
  return j.total_count;
}

/** Start a workflow on main with no inputs (the same as its scheduled run). Returns the HTTP status. */
export async function dispatchWorkflow(token: string, repo: string, file: string): Promise<number> {
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${file}/dispatches`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'boi-scheduler/backup', 'content-type': 'application/json' },
    body: JSON.stringify({ ref: 'main' }),
  });
  return r.status;
}
