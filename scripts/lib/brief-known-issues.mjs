// Morning Brief helpers (order 1580 item 4f and alert standard section 3). Pure: no database, no network.

export const WAITING_DAYS = 14;

/** Pure: the ISO time before which a waiting draft counts as older than `days` days. */
export function waitingCutoffIso(nowMs, days = WAITING_DAYS) {
  return new Date(nowMs - days * 24 * 3600 * 1000).toISOString();
}

/** Pure: the rows of the register that are still open (not closed, not merged-and-clean). */
export function openKnownIssues(register) {
  return (register || []).filter((r) => r.state !== 'closed' && r.state !== 'fix merged');
}

/** Pure: the card rows for the known-issues section: ID, one line, state, fix PR. */
export function knownIssueRows(register) {
  return openKnownIssues(register).map((r) => ({
    id: r.id,
    issue: r.issue,
    state: r.state,
    fixPr: r.fixPr ?? 'none yet',
  }));
}
