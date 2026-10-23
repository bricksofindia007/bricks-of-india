#!/usr/bin/env node
// Stop-line alert (23 Oct 2026): a scheduled workflow run that fails at start-up opens an issue, so it cannot go unseen.
// Start-up failure = the run concluded failure AND (a job failed within START_UP_MAX_SECONDS of starting, OR a failed step
// is a set-up step: install, setup, checkout, dependencies, environment). Each such run gets one issue (deduplicated by run id).
// Read-only except for the issues it opens. Runs every few hours (see .github/workflows/startup-failure-alert.yml).
import { pathToFileURL } from 'node:url';

export const START_UP_MAX_SECONDS = 180;
const SET_UP_STEP = /install|setup|set up|checkout|dependenc|environment|prepare/i;

/** Pure. Seconds between two ISO times, or null when either is missing. */
export function secondsBetween(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const s = Date.parse(startIso), e = Date.parse(endIso);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  return Math.round((e - s) / 1000);
}

/**
 * Pure. Decides whether a scheduled run failed at start-up.
 * @param {{event:string, conclusion:string|null}} run
 * @param {Array<{name:string, conclusion:string|null, started_at:string|null, completed_at:string|null, steps?:Array<{name:string, conclusion:string|null}>}>} jobs
 * @returns {{startUp:boolean, reason:string|null, job:string|null}}
 */
export function classifyStartupFailure(run, jobs) {
  if (run.event !== 'schedule' || run.conclusion !== 'failure') return { startUp: false, reason: null, job: null };
  for (const job of jobs) {
    if (job.conclusion !== 'failure') continue;
    const secs = secondsBetween(job.started_at, job.completed_at);
    if (secs !== null && secs <= START_UP_MAX_SECONDS) {
      return { startUp: true, reason: `job failed after ${secs} s`, job: job.name };
    }
    const failedStep = (job.steps ?? []).find((s) => s.conclusion === 'failure' && SET_UP_STEP.test(s.name));
    if (failedStep) return { startUp: true, reason: `set-up step failed: ${failedStep.name}`, job: job.name };
  }
  return { startUp: false, reason: null, job: null };
}

/** Pure. The issue title and body for one start-up failure. Names only; no secret values. */
export function issueFor(run, verdict) {
  const title = `Scheduled workflow failed at start-up: ${run.name} (run ${run.id})`;
  const body = [
    `The scheduled run **${run.name}** (run ${run.id}) failed at start-up.`,
    '',
    `- Job: ${verdict.job}`,
    `- Reason: ${verdict.reason}`,
    `- Run: ${run.html_url}`,
    '',
    'Start-up failures stop a job before its work begins, so they are easy to miss. Check the failing step, fix the cause, and rerun.',
  ].join('\n');
  return { title, body };
}

async function gh(path, token, method = 'GET', body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'boi-startup-sweep', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`GitHub API ${method} ${path.split('?')[0]} failed: HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const dry = process.env.DRY_RUN === '1';
  const hours = Number(process.env.LOOKBACK_HOURS || 3);
  if (!token || !repo) { console.log('sweep: GITHUB_TOKEN and GITHUB_REPOSITORY are required'); return 1; }
  const since = new Date(Date.now() - hours * 3600e3).toISOString();
  const runs = (await gh(`/repos/${repo}/actions/runs?event=schedule&status=failure&created=>=${since}&per_page=100`, token)).workflow_runs;
  let opened = 0;
  for (const run of runs) {
    const jobs = (await gh(`/repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`, token)).jobs;
    const verdict = classifyStartupFailure(run, jobs);
    if (!verdict.startUp) continue;
    const { title, body } = issueFor(run, verdict);
    const existing = await gh(`/search/issues?q=${encodeURIComponent(`repo:${repo} is:issue "run ${run.id}" in:title`)}`, token);
    if (existing.total_count > 0) { console.log(`already open for run ${run.id}`); continue; }
    if (dry) { console.log(`DRY RUN would open: ${title}`); continue; }
    const issue = await gh(`/repos/${repo}/issues`, token, 'POST', { title, body });
    console.log(`opened issue #${issue.number} for run ${run.id}`);
    opened++;
  }
  console.log(`sweep done: ${runs.length} failed scheduled run(s) in the last ${hours} h; ${opened} issue(s) opened`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error('sweep error:', e.message); process.exitCode = 1; });
}
