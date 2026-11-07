#!/usr/bin/env node
// Same-day guard for scheduled and Worker-dispatched workflow runs (order 1060).
//
// A run goes ahead unless an EARLIER run of the same workflow, created on the same IST day, has succeeded or is still
// running. The earliest run of the day always goes ahead; a later duplicate skips. A run that failed does not block a
// later one, so a failed slot gets its one retry. A manual run (not a schedule and not a Worker dispatch) is never guarded.
//
// Usage (in a workflow step): node scripts/ci/same-day-guard.mjs <workflow file> <run id> <event name> <source input>
// Prints "run=true" or "run=false" on stdout (for GITHUB_OUTPUT) and the reason on stderr.
//
// Failure behaviour (G14): if the runs cannot be read, the guard prints run=true (nothing is skipped silently).
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const IST_OFFSET_MS = 330 * 60 * 1000;
const LIVE = ['in_progress', 'queued', 'waiting'];

/** The IST calendar day (YYYY-MM-DD) of an ISO timestamp. */
export function istDay(iso) {
  return new Date(Date.parse(iso) + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Pure decision. `runs` is the list from `gh run list --json databaseId,status,conclusion,createdAt`. */
export function decide({ runId, mine, runs }) {
  const today = istDay(mine);
  const hit = runs.find((r) =>
    String(r.databaseId) !== String(runId) &&
    Date.parse(r.createdAt) < Date.parse(mine) &&
    istDay(r.createdAt) === today &&
    (r.conclusion === 'success' || LIVE.includes(r.status)));
  if (hit) {
    return { run: false, reason: `earlier run ${hit.databaseId} today is ${hit.conclusion || hit.status}; skipping this duplicate` };
  }
  return { run: true, reason: 'no earlier run today succeeded or is running' };
}

function main() {
  const [workflow, runId, event, source] = process.argv.slice(2);
  const say = (run, reason) => {
    process.stdout.write(`run=${run}\n`);
    process.stderr.write(`same-day guard: ${reason}\n`);
  };
  if (event !== 'schedule' && source !== 'worker') return say(true, 'manual run, guard not applied');
  try {
    const repo = process.env.GITHUB_REPOSITORY;
    const mine = JSON.parse(execFileSync('gh', ['api', `repos/${repo}/actions/runs/${runId}`], { encoding: 'utf8' })).created_at;
    const runs = JSON.parse(execFileSync('gh', ['run', 'list', '--repo', repo, '--workflow', workflow, '--limit', '40',
      '--json', 'databaseId,status,conclusion,createdAt'], { encoding: 'utf8' }));
    const d = decide({ runId, mine, runs });
    return say(d.run, d.reason);
  } catch (e) {
    return say(true, `cannot read the runs (${String(e.message).split('\n')[0]}); the run goes ahead`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
