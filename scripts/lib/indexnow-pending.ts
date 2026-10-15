// Which sets the search-engine ping needs to send. Pure: no database, no network, so it can be tested.
//
// The ping needs four columns per set. A set is pending when it has never been sent, or when it changed
// after it was last sent. The change test runs here, in code: a comparison between two columns cannot be
// written as a filter on the query.

export const PING_COLUMNS = 'set_number,name,updated_at,indexnow_submitted_at';
export const PING_TIERS = ['tier1', 'tier2'] as const;
// Sets changed in this window are read. The ping runs every few hours, so a day covers a missed run.
export const CHANGED_WINDOW_HOURS = 24;

export type PingRow = {
  set_number: string;
  name: string;
  updated_at: string | null;
  indexnow_submitted_at: string | null;
};

export function changedSince(nowMs: number): string {
  return new Date(nowMs - CHANGED_WINDOW_HOURS * 3600e3).toISOString();
}

/** A row is pending if it was never sent, or was changed after it was last sent. Duplicates are dropped. */
export function pendingFromRows(rows: PingRow[]): PingRow[] {
  const seen = new Set<string>();
  const out: PingRow[] = [];
  for (const r of rows) {
    if (seen.has(r.set_number)) continue;
    const never = r.indexnow_submitted_at == null;
    const changed = !never && r.updated_at != null && Date.parse(r.updated_at) > Date.parse(r.indexnow_submitted_at as string);
    if (never || changed) {
      seen.add(r.set_number);
      out.push(r);
    }
  }
  return out;
}
