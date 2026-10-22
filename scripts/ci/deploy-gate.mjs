#!/usr/bin/env node
// Production deploy gate. Runs before the production deploy job (deploy-cloudflare.yml, job deploy-gate).
// A release deploys only when:
//   1. Every required check passed on the pull request head that produced the commit being deployed. The pull
//      request is found from the commit itself (GitHub's commit-to-pulls link), so merge, squash and rebase merges
//      all work. A commit with no pull request is checked on its own checks (push runs skip the heavy jobs, so
//      such a commit fails closed unless it has real checks).
//   2. A measurement exists for a commit whose code matches the deployed commit (docs, logs and the measurement
//      file may differ). The measurement is defined in docs/release/gates/MEASUREMENT.md.
//   3. Or the owner has set an emergency override: a class of outage or security, and a reason of at least 20
//      characters. An override skips rule 2 only. Required checks still must pass. The reason is logged, and the
//      production environment approval on the deploy job still applies.
// Pure rules are in evaluateGate() and resolveChecked() (unit-tested). I/O is in main(): git and the GitHub API,
// read-only.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

export const CPU_LINE_MS = 108;
export const MIN_SAMPLE_HOURS = 24;
export const MIN_REQUESTS = 50_000;          // at 1 request per second for 24 hours, 86,400 are sent; the minimum allows for errors and gaps
export const MAX_ERROR_RATE = 0.005;
export const MIN_WARMUP_HOURS = 1;
export const MAX_ROW_DRIFT = 0.05;           // staging row counts must be within 5% of production
export const PARITY_TABLES = ['sets', 'store_prices', 'price_history'];
export const OVERRIDE_CLASSES = ['outage', 'security'];
export const MIN_REASON_CHARS = 20;
export const REQUIRED_CHECKS = ['snapshot-tests', 'verify-no-email-in-client-bundle', 'g19-public-text', 'pr-text-attribution'];
// Files that may differ between the measured commit and the deployed commit without re-measuring.
const NON_CODE = [/^docs\//, /^logs\//];

/**
 * Pure. Chooses the commit whose checks count.
 * @param {string} sha            the commit being deployed
 * @param {Array<{head_sha:string, merged_at:string|null, merge_commit_sha:string|null}>} prs  pull requests linked to the commit
 * @returns {{checked: string, source: 'pull_request'|'commit'}}
 */
export function resolveChecked(sha, prs) {
  const merged = prs.filter((p) => p.merged_at);
  // A squash or merge commit is the merge_commit_sha of the pull request. Prefer that match, then any merged pull request.
  const pr = merged.find((p) => p.merge_commit_sha === sha) ?? merged[0] ?? prs[0];
  if (pr && pr.head_sha) return { checked: pr.head_sha, source: 'pull_request' };
  return { checked: sha, source: 'commit' };
}

/**
 * Pure. Returns { ok, failures, overridden, log }.
 * @param {object} input
 * @param {string} input.sha
 * @param {Array<{name:string, status:string, conclusion:string|null}>} input.checkRuns   checks on the checked commit
 * @param {string[]} input.diffFiles       files that differ between the measured commit and the deployed commit
 * @param {object|null} input.evidence     parsed measurement file, or null
 * @param {string} input.rollbackTarget
 * @param {{class:string, reason:string}|null} [input.override]
 * @param {string} input.profileSha         SHA-256 of the committed load profile ('' if missing)
 */
export function evaluateGate(input) {
  const failures = [];
  // 1. checks: always required, override or not
  for (const name of REQUIRED_CHECKS) {
    const runs = input.checkRuns.filter((r) => r.name === name);
    if (runs.length === 0) failures.push(`check missing on the checked commit: ${name}`);
    else if (!runs.every((r) => r.status === 'completed' && r.conclusion === 'success')) failures.push(`check not green: ${name}`);
  }
  // 2. emergency override: skips the measurement rule only
  if (input.override) {
    const o = input.override;
    if (!OVERRIDE_CLASSES.includes(o.class)) failures.push(`override class must be one of ${OVERRIDE_CLASSES.join(', ')}`);
    if (typeof o.reason !== 'string' || o.reason.trim().length < MIN_REASON_CHARS) failures.push(`override reason must be at least ${MIN_REASON_CHARS} characters`);
    if (failures.length === 0) {
      const log = `EMERGENCY OVERRIDE (${o.class}) for ${input.sha.slice(0, 7)}: ${o.reason.trim()}`;
      return { ok: true, failures, overridden: true, log };
    }
    return { ok: false, failures, overridden: false, log: null };
  }
  // 3. measurement present and matching the code
  const ev = input.evidence;
  if (!ev) {
    failures.push('no measurement file for this release');
  } else {
    if (ev.measured_sha !== input.sha) {
      const codeFiles = input.diffFiles.filter((f) => !NON_CODE.some((re) => re.test(f)));
      if (codeFiles.length > 0) failures.push(`code differs from the measured commit (${String(ev.measured_sha).slice(0, 7)}): re-measure`);
    }
    if (typeof ev.cpu_median_ms !== 'number') failures.push('measurement has no CPU median');
    else if (ev.cpu_median_ms > CPU_LINE_MS) failures.push(`CPU median ${ev.cpu_median_ms} ms is over the ${CPU_LINE_MS} ms line`);
    if (typeof ev.sample_hours !== 'number' || ev.sample_hours < MIN_SAMPLE_HOURS) failures.push(`sample is under ${MIN_SAMPLE_HOURS} hours`);
    if (typeof ev.warmup_hours !== 'number' || ev.warmup_hours < MIN_WARMUP_HOURS) failures.push(`warm-up is under ${MIN_WARMUP_HOURS} hour (excluded from the sample)`);
    if (typeof ev.requests_measured !== 'number' || ev.requests_measured < MIN_REQUESTS) failures.push(`requests measured is under ${MIN_REQUESTS}`);
    if (typeof ev.error_rate !== 'number' || ev.error_rate > MAX_ERROR_RATE) failures.push(`error rate is over ${MAX_ERROR_RATE * 100}%`);
    if (typeof ev.load_profile_sha256 !== 'string' || ev.load_profile_sha256 !== input.profileSha) failures.push('load profile does not match the committed profile');
    for (const t of PARITY_TABLES) {
      const s = ev.staging_rows?.[t], p = ev.production_rows?.[t];
      if (typeof s !== 'number' || typeof p !== 'number' || p <= 0) failures.push(`row count missing for ${t}`);
      else if (Math.abs(s - p) / p > MAX_ROW_DRIFT) failures.push(`staging ${t} differs from production by more than ${MAX_ROW_DRIFT * 100}%`);
    }
    if (ev.page_diff_ok !== true) failures.push('page output comparison is not marked passed');
    if (ev.rollback_target !== input.rollbackTarget) failures.push(`rollback target is not ${input.rollbackTarget}`);
    if (typeof ev.approved_by !== 'string' || ev.approved_by.trim() === '') failures.push('no approver recorded');
  }
  return { ok: failures.length === 0, failures, overridden: false, log: null };
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

async function gh(path, token) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'boi-deploy-gate' },
  });
  if (!res.ok) throw new Error(`GitHub API read failed: HTTP ${res.status} for ${path.split('?')[0]}`);
  return res.json();
}

async function main() {
  const sha = process.env.DEPLOY_SHA || git(['rev-parse', 'HEAD']);
  const repo = process.env.GITHUB_REPOSITORY || 'bricksofindia007/bricks-of-india';
  const token = process.env.GITHUB_TOKEN || '';
  const rollbackTarget = process.env.ROLLBACK_TARGET || '34faed19';
  const evidencePath = process.env.GATE_EVIDENCE || 'docs/release/gates/current.json';
  const override = process.env.EMERGENCY_CLASS && process.env.EMERGENCY_CLASS !== 'none'
    ? { class: process.env.EMERGENCY_CLASS, reason: process.env.EMERGENCY_REASON || '' }
    : null;

  if (!token) { console.log('deploy-gate: no GITHUB_TOKEN; checks cannot be read; the gate fails closed.'); return 1; }

  const prs = await gh(`/repos/${repo}/commits/${sha}/pulls`, token);
  const { checked, source } = resolveChecked(sha, prs.map((p) => ({ head_sha: p.head?.sha, merged_at: p.merged_at, merge_commit_sha: p.merge_commit_sha })));
  const runs = (await gh(`/repos/${repo}/commits/${checked}/check-runs?per_page=100`, token)).check_runs;
  const checkRuns = runs.map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion }));

  let evidence = null;
  if (fs.existsSync(evidencePath)) evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  const measuredSha = evidence?.measured_sha ?? '';
  const diffFiles = measuredSha ? git(['diff', '--name-only', measuredSha, sha]).split('\n').filter(Boolean) : [];

  const profilePath = process.env.LOAD_PROFILE || 'docs/release/gates/load-profile.json';
  const profileSha = fs.existsSync(profilePath)
    ? (await import('node:crypto')).createHash('sha256').update(fs.readFileSync(profilePath)).digest('hex')
    : '';
  const result = evaluateGate({ sha, checkRuns, diffFiles, evidence, rollbackTarget, override, profileSha });
  if (!result.ok) {
    console.log(`deploy-gate: BLOCKED for ${sha.slice(0, 7)} (checks from ${source} ${checked.slice(0, 7)})`);
    for (const f of result.failures) console.log(`  - ${f}`);
    return 1;
  }
  if (result.overridden) console.log(result.log);
  console.log(`deploy-gate: passed for ${sha.slice(0, 7)} (checks from ${source} ${checked.slice(0, 7)}${result.overridden ? ', measurement overridden' : `, measured ${measuredSha.slice(0, 7)}`})`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('deploy-gate.mjs')) {
  main().then((code) => { process.exitCode = code; }, (e) => { console.error('deploy-gate error:', e.message); process.exitCode = 1; });
}
