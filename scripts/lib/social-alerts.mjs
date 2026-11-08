// Social alerts for the health check (order 1580 item 4; alert standard rules 1 to 7, boi-ops docs/specs/alert-standard.md).
// Pure: no network, no email. The health check records facts, then calls socialCauses() once, and sends one email per cause.
//
// Causes (rule 6: one email per root cause):
//   'social-weekly-run'      the weekly social post (social-automation.yml) did not run on time, or its last run failed or timed out
//   'social-posting-stopped' the weekly run happens, but Instagram or YouTube has not posted for more than 120 hours
//
// Wording (rule 1 and the alert standard): when a run happened, say "timed out" or "failed", never "not attempting".
// The weekly job is named as the weekly social post; the daily video pipeline posts to both channels too, so it is not named here.

// The job runs weekly: cron "30 6 * * 1" (Mondays 06:30 UTC = 12:00 IST). One week plus one day of margin.
export const SOCIAL_WORKFLOW = 'social-automation.yml';
export const SOCIAL_WEEKLY_CRON = '30 6 * * 1';
export const SOCIAL_WEEKLY_MAX_HOURS = 7 * 24 + 24; // 192
export const SOCIAL_SUCCESS_MAX_HOURS = 120;

/** Pure: true when a cron expression is weekly (one day of week, fixed time). */
export function isWeeklyCron(cron) {
  const parts = String(cron).trim().split(/\s+/);
  return parts.length === 5 && /^\d+$/.test(parts[4]) && parts[2] === '*' && parts[3] === '*';
}

/** Pure: the human words for how the last weekly run ended. A run that happened is "timed out" or "failed". */
export function runWords(workflow) {
  if (!workflow) return 'has not run';
  if (workflow.conclusion === 'cancelled') return 'timed out';
  if (workflow.conclusion === 'failure') return 'failed';
  return 'has not run on time';
}

/**
 * Pure: the causes to report, from the facts the health check recorded.
 * facts = {
 *   ig: { neverRan, attemptAgeH, successAgeH }, yt: { neverRan, attemptAgeH, successAgeH },   (successAgeH may be null)
 *   workflow: { conclusion, status, ageH, createdAt } | null   (the last run of social-automation.yml)
 * }
 */
export function socialCauses(facts) {
  const channels = [['Instagram', facts.ig], ['YouTube', facts.yt]].filter(([, c]) => c);
  const stale = channels.filter(([, c]) => c.neverRan || c.attemptAgeH > SOCIAL_WEEKLY_MAX_HOURS);
  const workflowStale = facts.workflow && facts.workflow.ageH > SOCIAL_WEEKLY_MAX_HOURS;
  const workflowBad = facts.workflow && (facts.workflow.conclusion === 'failure' || facts.workflow.conclusion === 'cancelled');
  const causes = [];

  if (stale.length || workflowStale || workflowBad) {
    const words = runWords(facts.workflow);
    const when = facts.workflow?.createdAt ? ` (last run ${facts.workflow.createdAt} UTC)` : '';
    const lines = [
      `The weekly social post ${words}${when}.`,
      `Threshold: ${SOCIAL_WEEKLY_MAX_HOURS} hours (weekly, Mondays 12:00 IST, with one day of margin).`,
      ...channels.map(([name, c]) => (c.neverRan
        ? `${name}: no heartbeat has ever been written.`
        : `${name}: last attempt ${c.attemptAgeH.toFixed(1)} hours ago.`)),
      'Visitors affected: not known.',
      'Cause not known. Check GitHub Actions for social-automation.yml.',
      'Owner action: yes, check the run.',
    ];
    causes.push({
      key: 'social-weekly-run',
      subject: `⚠️ BOI Health Alert — Weekly social post ${words}`,
      body: lines.join('\n'),
    });
  }

  const quiet = channels.filter(([, c]) => !c.neverRan && c.successAgeH != null && c.successAgeH > SOCIAL_SUCCESS_MAX_HOURS);
  if (quiet.length && !causes.length) {
    const names = quiet.map(([n]) => n).join(' and ');
    causes.push({
      key: 'social-posting-stopped',
      subject: `⚠️ BOI Health Alert — ${names} not posting`,
      body: [
        `The weekly social run is on time, but ${names} has no successful post for more than ${SOCIAL_SUCCESS_MAX_HOURS} hours.`,
        ...quiet.map(([n, c]) => `${n}: last successful post ${c.successAgeH.toFixed(1)} hours ago.`),
        'Visitors affected: not known.',
        'Cause not known. Check GitHub Actions for social-automation.yml logs.',
        'Owner action: yes, check the logs.',
      ].join('\n'),
    });
  }
  return causes;
}

/**
 * Pure: drops causes whose rule keys are covered by an open known issue (alert standard section 2).
 * register = [{ id, state, alertsCovered: [keys] }]. A row that is not open does not suppress anything.
 */
export function suppressKnown(causes, register) {
  const open = (register || []).filter((r) => r.state !== 'closed' && r.state !== 'fix merged');
  return causes.map((c) => {
    const row = open.find((r) => (r.alertsCovered || []).includes(c.key));
    return row ? { ...c, suppressedBy: row.id } : c;
  });
}

/** Pure: the causes that should be emailed now (not suppressed). */
export function emailable(causes) {
  return causes.filter((c) => !c.suppressedBy);
}
