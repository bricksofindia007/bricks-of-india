// Production deploy gate (scripts/ci/deploy-gate.mjs): the rules, the pull request lookup for merge and squash commits,
// and the emergency override.
import { describe, it, expect } from 'vitest';
import {
  evaluateGate, resolveChecked, REQUIRED_CHECKS, CPU_LINE_MS, MIN_SAMPLE_HOURS, MIN_REQUESTS, MIN_REASON_CHARS,
} from '../scripts/ci/deploy-gate.mjs';

const SHA = 'aaaaaaa1111111111111111111111111111111aa';
const MEASURED = 'bbbbbbb2222222222222222222222222222222bb';
const HEAD = 'cccccccccccccccccccccccccccccccccccccccc';
const PROFILE = 'a'.repeat(64);
const green = () => REQUIRED_CHECKS.map((name) => ({ name, status: 'completed', conclusion: 'success' }));
const goodEvidence = (): any => ({
  measured_sha: SHA,
  cpu_median_ms: 95,
  warmup_hours: 1,
  sample_hours: 24,
  requests_measured: 86_000,
  error_rate: 0.001,
  load_profile_sha256: PROFILE,
  staging_rows: { sets: 7203, store_prices: 1000, price_history: 62000 },
  production_rows: { sets: 7203, store_prices: 1020, price_history: 63341 },
  page_diff_ok: true,
  rollback_target: '34faed19',
  approved_by: 'owner',
});
const base = (): any => ({
  sha: SHA,
  checkRuns: green(),
  diffFiles: [],
  evidence: goodEvidence(),
  rollbackTarget: '34faed19',
  profileSha: PROFILE,
  override: null,
});

describe('evaluateGate: measurement rules', () => {
  it('passes when every rule holds', () => {
    expect(evaluateGate(base())).toMatchObject({ ok: true, failures: [], overridden: false });
  });

  it('blocks a missing required check, and a check that is not green (skipped counts as not green)', () => {
    const i = base();
    i.checkRuns = i.checkRuns.filter((r: any) => r.name !== 'snapshot-tests');
    expect(evaluateGate(i).failures.join(' ')).toMatch(/missing.*snapshot-tests/);
    const j = base();
    j.checkRuns[0] = { ...j.checkRuns[0], conclusion: 'skipped' };
    expect(evaluateGate(j).ok).toBe(false);
  });

  it('blocks when there is no measurement', () => {
    const i = base();
    i.evidence = null;
    expect(evaluateGate(i).failures).toContain('no measurement file for this release');
  });

  it('CPU over the line blocks; exactly on the line passes', () => {
    const over = base();
    over.evidence = { ...goodEvidence(), cpu_median_ms: CPU_LINE_MS + 0.5 };
    expect(evaluateGate(over).failures.join(' ')).toMatch(/over the 108 ms line/);
    const on = base();
    on.evidence = { ...goodEvidence(), cpu_median_ms: CPU_LINE_MS };
    expect(evaluateGate(on).ok).toBe(true);
  });

  it(`sample under ${MIN_SAMPLE_HOURS} h blocks`, () => {
    const i = base();
    i.evidence = { ...goodEvidence(), sample_hours: MIN_SAMPLE_HOURS - 1 };
    expect(evaluateGate(i).failures.join(' ')).toMatch(/under 24 hours/);
  });

  it('no warm-up, or too few requests, blocks', () => {
    const w = base();
    w.evidence = { ...goodEvidence(), warmup_hours: 0 };
    expect(evaluateGate(w).failures.join(' ')).toMatch(/warm-up/);
    const r = base();
    r.evidence = { ...goodEvidence(), requests_measured: MIN_REQUESTS - 1 };
    expect(evaluateGate(r).failures.join(' ')).toMatch(/requests measured/);
  });

  it('error rate over 0.5% blocks', () => {
    const i = base();
    i.evidence = { ...goodEvidence(), error_rate: 0.006 };
    expect(evaluateGate(i).failures.join(' ')).toMatch(/error rate/);
  });

  it('a row count more than 5% away from production blocks; a missing count blocks', () => {
    const drift = base();
    drift.evidence = { ...goodEvidence(), staging_rows: { sets: 6000, store_prices: 1000, price_history: 60000 } };
    expect(evaluateGate(drift).failures.join(' ')).toMatch(/sets differs from production/);
    const missing = base();
    missing.evidence = { ...goodEvidence(), staging_rows: { sets: 7203, store_prices: 1000 } };
    expect(evaluateGate(missing).failures.join(' ')).toMatch(/row count missing for price_history/);
  });

  it('a load profile that differs from the committed one blocks', () => {
    const i = base();
    i.profileSha = 'b'.repeat(64);
    expect(evaluateGate(i).failures.join(' ')).toMatch(/load profile does not match/);
  });

  it('page comparison, rollback target and approver are each required', () => {
    const p = base(); p.evidence = { ...goodEvidence(), page_diff_ok: false };
    expect(evaluateGate(p).failures.join(' ')).toMatch(/page output/);
    const r = base(); r.evidence = { ...goodEvidence(), rollback_target: 'acf7f989' };
    expect(evaluateGate(r).failures.join(' ')).toMatch(/rollback target/);
    const a = base(); a.evidence = { ...goodEvidence(), approved_by: ' ' };
    expect(evaluateGate(a).failures.join(' ')).toMatch(/no approver/);
  });

  it('a different commit passes when only docs or logs differ, and blocks when code differs', () => {
    const docs = base();
    docs.evidence = { ...goodEvidence(), measured_sha: MEASURED };
    docs.diffFiles = ['docs/STATUS.md', 'logs/execution/2026-10-23.md', 'docs/release/gates/current.json'];
    expect(evaluateGate(docs).ok).toBe(true);
    const code = base();
    code.evidence = { ...goodEvidence(), measured_sha: MEASURED };
    code.diffFiles = ['docs/STATUS.md', 'src/app/sets/page.tsx'];
    expect(evaluateGate(code).failures.join(' ')).toMatch(/re-measure/);
  });
});

describe('evaluateGate: emergency override', () => {
  const over = (cls: string, reason: string): any => ({ ...base(), evidence: null, override: { class: cls, reason } });

  it('an outage override with a reason passes without a measurement, and logs the reason', () => {
    const r = evaluateGate(over('outage', 'Site returns 500 on every set page since 09:10 UTC'));
    expect(r.ok).toBe(true);
    expect(r.overridden).toBe(true);
    expect(r.log).toMatch(/^EMERGENCY OVERRIDE \(outage\) for aaaaaaa: Site returns 500/);
  });

  it('a security override passes too', () => {
    expect(evaluateGate(over('security', 'Admin session token leaked in a public response')).ok).toBe(true);
  });

  it('any other class is refused', () => {
    const r = evaluateGate(over('performance', 'Pages are slow today and we want the fix out'));
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toMatch(/override class/);
  });

  it(`a reason under ${MIN_REASON_CHARS} characters is refused`, () => {
    expect(evaluateGate(over('outage', 'too short')).ok).toBe(false);
  });

  it('an override never skips the required checks', () => {
    const i = over('outage', 'Site returns 500 on every set page since 09:10 UTC');
    i.checkRuns = i.checkRuns.map((r: any) => ({ ...r, conclusion: 'failure' }));
    const r = evaluateGate(i);
    expect(r.ok).toBe(false);
    expect(r.overridden).toBe(false);
  });
});

describe('resolveChecked: merge, squash and no pull request', () => {
  it('a merge commit resolves to the pull request head', () => {
    const prs = [{ head_sha: HEAD, merged_at: '2026-10-23T10:00:00Z', merge_commit_sha: SHA }];
    expect(resolveChecked(SHA, prs)).toEqual({ checked: HEAD, source: 'pull_request' });
  });

  it('a squash commit (one parent) resolves to the pull request head, found by its merge commit', () => {
    const prs = [{ head_sha: HEAD, merged_at: '2026-10-23T10:00:00Z', merge_commit_sha: SHA }];
    expect(resolveChecked(SHA, prs)).toEqual({ checked: HEAD, source: 'pull_request' });
  });

  it('a commit linked to several pull requests uses the one whose merge commit is this commit', () => {
    const prs = [
      { head_sha: 'dddddddddddddddddddddddddddddddddddddddd', merged_at: '2026-10-20T10:00:00Z', merge_commit_sha: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' },
      { head_sha: HEAD, merged_at: '2026-10-23T10:00:00Z', merge_commit_sha: SHA },
    ];
    expect(resolveChecked(SHA, prs).checked).toBe(HEAD);
  });

  it('a commit with no pull request is checked on its own checks', () => {
    expect(resolveChecked(SHA, [])).toEqual({ checked: SHA, source: 'commit' });
  });

  it('an unmerged pull request linked to the commit still gives its head', () => {
    const prs = [{ head_sha: HEAD, merged_at: null, merge_commit_sha: null }];
    expect(resolveChecked(SHA, prs)).toEqual({ checked: HEAD, source: 'pull_request' });
  });
});
