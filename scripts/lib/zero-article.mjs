// Zero-article alert: a completed generation run that attempted drafts but
// published none. A run with nothing queued is not an alert (no work to do).
// Pure function; the health check reads the latest run and calls this.

/**
 * @param {{ started_at: string, ended_at: string | null, drafts_attempted: number, drafts_succeeded: number } | null} run
 * @returns {{ alert: boolean, reason: string }}
 */
export function zeroArticleAlert(run) {
  if (!run) return { alert: false, reason: 'no run recorded' };
  if (!run.ended_at) return { alert: false, reason: 'run still in progress' };
  if (!(run.drafts_attempted > 0)) return { alert: false, reason: 'run had nothing to attempt' };
  if (run.drafts_succeeded > 0) return { alert: false, reason: `run published ${run.drafts_succeeded}` };
  return {
    alert: true,
    reason: `run started ${run.started_at} attempted ${run.drafts_attempted} and published 0`,
  };
}
