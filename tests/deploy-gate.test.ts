// Production deploy gate (scripts/ci/deploy-gate.mjs): each rule blocks on its own, and a complete measurement passes.
import { describe, it, expect } from 'vitest';
import { evaluateGate, checkedCommit, REQUIRED_CHECKS, CPU_LINE_MS, MIN_SAMPLE_HOURS } from '../scripts/ci/deploy-gate.mjs';

const SHA = 'aaaaaaa1111111111111111111111111111111aa';
const MEASURED = 'bbbbbbb2222222222222222222222222222222bb';
const green = () => REQUIRED_CHECKS.map((name) => ({ name, status: 'completed', conclusion: 'success' }));
const goodEvidence = (): any => ({
  measured_sha: SHA,
  cpu_median_ms: 95,
  sample_hours: 24,
  page_diff_ok: true,
  rollback_target: '34faed19',
  approved_by: 'owner',
});
// Fixtures are loosely typed on purpose: each test overrides one field to break one rule.
const base = (): any => ({
  sha: SHA,
  mergeParent2: null,
  checkRuns: green(),
  diffFiles: [],
  evidence: goodEvidence(),
  measuredSha: SHA,
  rollbackTarget: '34faed19',
});

describe('evaluateGate', () => {
  it('passes when every rule holds', () => {
    expect(evaluateGate(base())).toEqual({ ok: true, failures: [] });
  });

  it('blocks when a required check is missing', () => {
    const i = base();
    i.checkRuns = i.checkRuns.filter((r: { name: string }) => r.name !== 'snapshot-tests');
    const r = evaluateGate(i);
    expect(r.ok).toBe(false);
    expect(r.failures.join(' ')).toMatch(/missing.*snapshot-tests/);
  });

  it('blocks when a required check is not green (skipped counts as not green)', () => {
    const i = base();
    i.checkRuns[0] = { ...i.checkRuns[0], conclusion: 'failure' };
    expect(evaluateGate(i).failures.join(' ')).toMatch(/not green/);
    const j = base();
    j.checkRuns[0] = { ...j.checkRuns[0], conclusion: 'skipped' };
    expect(evaluateGate(j).ok).toBe(false);
  });

  it('blocks when there is no measurement', () => {
    const i = base();
    i.evidence = null;
    expect(evaluateGate(i).failures).toContain('no measurement file for this release');
  });

  it('blocks when CPU is over the line', () => {
    const i = base();
    i.evidence = { ...goodEvidence(), cpu_median_ms: CPU_LINE_MS + 0.5 };
    expect(evaluateGate(i).failures.join(' ')).toMatch(/over the 108 ms line/);
  });

  it('accepts CPU exactly on the line', () => {
    const i = base();
    i.evidence = { ...goodEvidence(), cpu_median_ms: CPU_LINE_MS };
    expect(evaluateGate(i).ok).toBe(true);
  });

  it(`blocks when the sample is under ${MIN_SAMPLE_HOURS} hours`, () => {
    const i = base();
    i.evidence = { ...goodEvidence(), sample_hours: MIN_SAMPLE_HOURS - 1 };
    expect(evaluateGate(i).failures.join(' ')).toMatch(/under 24 hours/);
  });

  it('blocks when the page comparison is not marked passed', () => {
    const i = base();
    i.evidence = { ...goodEvidence(), page_diff_ok: false };
    expect(evaluateGate(i).failures.join(' ')).toMatch(/page output/);
  });

  it('blocks when the rollback target is not the named release', () => {
    const i = base();
    i.evidence = { ...goodEvidence(), rollback_target: 'acf7f989' };
    expect(evaluateGate(i).failures.join(' ')).toMatch(/rollback target/);
  });

  it('blocks when no approver is recorded', () => {
    const i = base();
    i.evidence = { ...goodEvidence(), approved_by: '  ' };
    expect(evaluateGate(i).failures.join(' ')).toMatch(/no approver/);
  });

  it('allows a different commit when only docs or logs differ from the measured one', () => {
    const i = base();
    i.measuredSha = MEASURED;
    i.evidence = { ...goodEvidence(), measured_sha: MEASURED };
    i.diffFiles = ['docs/STATUS.md', 'logs/execution/2026-10-23.md', 'docs/release/gates/x.json'];
    expect(evaluateGate(i).ok).toBe(true);
  });

  it('blocks a different commit when code differs from the measured one', () => {
    const i = base();
    i.evidence = { ...goodEvidence(), measured_sha: MEASURED };
    i.diffFiles = ['docs/STATUS.md', 'src/app/sets/page.tsx'];
    expect(evaluateGate(i).failures.join(' ')).toMatch(/re-measure/);
  });
});

describe('checkedCommit', () => {
  it('uses the commit itself when it is not a merge', () => {
    expect(checkedCommit(SHA, [MEASURED])).toBe(SHA);
    expect(checkedCommit(SHA, [])).toBe(SHA);
  });
  it('uses the pull request head (second parent) for a merge commit', () => {
    expect(checkedCommit(SHA, [MEASURED, 'cccccccccccccccccccccccccccccccccccccccc'])).toBe('cccccccccccccccccccccccccccccccccccccccc');
  });
});
