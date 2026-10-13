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

/** Never submitted, or changed after its last submission. */
export function isPending(row: SyncRow): boolean {
  if (row.indexnow_submitted_at == null) return true;
  if (row.updated_at == null) return false;
  return new Date(row.updated_at).getTime() > new Date(row.indexnow_submitted_at).getTime();
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
