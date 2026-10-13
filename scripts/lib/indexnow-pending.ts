// Pure helpers for the set-page IndexNow sync (scripts/indexnow-sync-sets.ts).
// The pending check runs in code, not in the query: PostgREST cannot compare
// two columns in one filter, so the old `updated_at.gt.indexnow_submitted_at`
// was read as a literal timestamp and failed on every run.

/** Upper bound per IndexNow request (matches src/lib/indexnow.ts). */
export const MAX_URLS_PER_REQUEST = 10_000;

/** Rows per UPDATE .in() call, so the request URL stays short. */
export const UPDATE_BATCH = 500;

export type SyncRow = {
  updated_at: string | null;
  indexnow_submitted_at: string | null;
};

/** Most URLs one run sends (P24). Never-submitted sets go first, then oldest change. */
export const MAX_URLS_PER_RUN = 5_000;

/**
 * Margin for "changed after submission". A trigger sets updated_at to now()
 * on every update, so the stamp we write when marking a set as submitted
 * moves updated_at forward by a few milliseconds. Only a change later than
 * this margin counts as new.
 */
export const CHANGE_MARGIN_MS = 5 * 60 * 1000;

/** Never submitted, or changed more than CHANGE_MARGIN_MS after its last submission. */
export function isPending(row: SyncRow): boolean {
  if (row.indexnow_submitted_at == null) return true;
  if (row.updated_at == null) return false;
  const changed = new Date(row.updated_at).getTime();
  const submitted = new Date(row.indexnow_submitted_at).getTime();
  return changed > submitted + CHANGE_MARGIN_MS;
}

/**
 * The pending rows this run sends: never-submitted first (by set number),
 * then changed rows oldest change first, capped at `cap`.
 */
export function selectForRun<T extends SyncRow & { set_number: string }>(rows: T[], cap: number): T[] {
  const never = rows
    .filter((r) => r.indexnow_submitted_at == null)
    .sort((a, b) => a.set_number.localeCompare(b.set_number));
  const changed = rows
    .filter((r) => r.indexnow_submitted_at != null)
    .sort((a, b) => new Date(a.updated_at ?? 0).getTime() - new Date(b.updated_at ?? 0).getTime());
  return [...never, ...changed].slice(0, cap);
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
