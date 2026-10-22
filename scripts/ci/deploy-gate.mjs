#!/usr/bin/env node
// Production deploy gate (23 Oct 2026, addendum 2 of the owner decisions). Runs before the production deploy job.
// A release may deploy only when all of these hold:
//   1. Every required check passed on the commit being deployed. For a merge commit on main, the checks of the pull
//      request head (its second parent) are used, because the merge run skips the heavy jobs by design.
//   2. A measurement file exists for a commit whose code matches the deployed commit (docs-only and gate-file
//      differences are allowed). The measurement records the staging CPU per request, the page comparison, the
//      rollback target and the approver.
//   3. The measured CPU median is at or under the 108 ms line, over at least 24 hours.
// Pure rules are in evaluateGate() (unit-tested). I/O is in main(): git and the GitHub checks API, read-only.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

export const CPU_LINE_MS = 108;
export const MIN_SAMPLE_HOURS = 24;
export const REQUIRED_CHECKS = ['snapshot-tests', 'verify-no-email-in-client-bundle', 'g19-public-text', 'pr-text-attribution'];
// Files that may differ between the measured commit and the deployed commit without re-measuring.
const NON_CODE = [/^docs\//, /^logs\//];

/**
 * Pure. Returns { ok, failures }.
 * @param {object} input
 * @param {string} input.sha                 commit being deployed
 * @param {string|null} input.mergeParent2   the pull request head for a merge commit, else null
 * @param {Array<{name:string, status:string, conclusion:string|null}>} input.checkRuns  checks on the checked commit
 * @param {string[]} input.diffFiles          files that differ between the measured commit and the deployed commit
 * @param {object|null} input.evidence        the parsed measurement file, or null if missing
 * @param {string} input.measuredSha          the commit the measurement names (from evidence)
 * @param {string} input.rollbackTarget       the release the owner must be able to return to
 */
export function evaluateGate(input) {
  const failures = [];
  // 1. checks
  for (const name of REQUIRED_CHECKS) {
    const runs = input.checkRuns.filter((r) => r.name === name);
    if (runs.length === 0) failures.push(`check missing on the checked commit: ${name}`);
    else if (!runs.every((r) => r.status === 'completed' && r.conclusion === 'success')) failures.push(`check not green: ${name}`);
  }
  // 2. measurement present and matching the code
  const ev = input.evidence;
  if (!ev) {
    failures.push('no measurement file for this release');
  } else {
    if (ev.measured_sha !== input.sha) {
      const codeFiles = input.diffFiles.filter((f) => !NON_CODE.some((re) => re.test(f)));
      if (codeFiles.length > 0) failures.push(`code differs from the measured commit (${ev.measured_sha.slice(0, 7)}): re-measure`);
    }
    if (typeof ev.cpu_median_ms !== 'number') failures.push('measurement has no CPU median');
    else if (ev.cpu_median_ms > CPU_LINE_MS) failures.push(`CPU median ${ev.cpu_median_ms} ms is over the ${CPU_LINE_MS} ms line`);
    if (typeof ev.sample_hours !== 'number' || ev.sample_hours < MIN_SAMPLE_HOURS) failures.push(`sample is under ${MIN_SAMPLE_HOURS} hours`);
    if (ev.page_diff_ok !== true) failures.push('page output comparison is not marked passed');
    if (ev.rollback_target !== input.rollbackTarget) failures.push(`rollback target is not ${input.rollbackTarget}`);
    if (typeof ev.approved_by !== 'string' || ev.approved_by.trim() === '') failures.push('no approver recorded');
  }
  return { ok: failures.length === 0, failures };
}

/** Pure. Picks the commit whose checks count: the pull request head for a merge commit, else the commit itself. */
export function checkedCommit(sha, parents) {
  return parents.length >= 2 ? parents[1] : sha;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

async function fetchCheckRuns(repo, sha, token) {
  const res = await fetch(`https://api.github.com/repos/${repo}/commits/${sha}/check-runs?per_page=100`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'boi-deploy-gate' },
  });
  if (!res.ok) throw new Error(`check-runs read failed: HTTP ${res.status}`);
  const body = await res.json();
  return body.check_runs.map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion }));
}

async function main() {
  const sha = process.env.DEPLOY_SHA || git(['rev-parse', 'HEAD']);
  const repo = process.env.GITHUB_REPOSITORY || 'bricksofindia007/bricks-of-india';
  const token = process.env.GITHUB_TOKEN || '';
  const rollbackTarget = process.env.ROLLBACK_TARGET || '34faed19';
  const evidencePath = process.env.GATE_EVIDENCE || 'docs/release/gates/current.json';

  const parents = git(['rev-list', '--parents', '-n', '1', sha]).split(' ').slice(1);
  const checked = checkedCommit(sha, parents);
  const checkRuns = token ? await fetchCheckRuns(repo, checked, token) : [];
  if (!token) console.log('deploy-gate: no GITHUB_TOKEN, checks cannot be read; the gate fails closed.');

  let evidence = null;
  if (fs.existsSync(evidencePath)) evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  const measuredSha = evidence?.measured_sha ?? '';
  const diffFiles = measuredSha ? git(['diff', '--name-only', measuredSha, sha]).split('\n').filter(Boolean) : [];

  const result = evaluateGate({ sha, checkRuns, diffFiles, evidence, measuredSha, rollbackTarget, mergeParent2: parents[1] ?? null });
  if (!result.ok) {
    console.log(`deploy-gate: BLOCKED for ${sha.slice(0, 7)}`);
    for (const f of result.failures) console.log(`  - ${f}`);
    return 1;
  }
  console.log(`deploy-gate: passed for ${sha.slice(0, 7)} (checks on ${checked.slice(0, 7)}, measured ${measuredSha.slice(0, 7)})`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('deploy-gate.mjs')) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error('deploy-gate error:', e.message); process.exitCode = 1; });
}
