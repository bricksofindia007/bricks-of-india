// Deploy gate, check-run rule: the most recent completed run per required check counts, and a skipped run passes only
// when the change from the measured commit touches docs/ or logs/ only. Other rules are tested in deploy-gate.test.ts.
import { describe, it, expect } from 'vitest';
import { evaluateGate, REQUIRED_CHECKS } from '../scripts/ci/deploy-gate.mjs';

const SHA = 'aaaaaaa1111111111111111111111111111111aa';
const DOCS_ONLY = ['docs/release/notes/2026-11-08-gate-proof-2.md'];
const CODE = ['src/app/page.tsx'];

// Required checks as GitHub reports them: one run per name, unless a case adds more.
const runs = (extra: Record<string, any[]> = {}) => REQUIRED_CHECKS.flatMap((name) => extra[name] ?? [
  { name, status: 'completed', conclusion: 'success', id: 1, started_at: '2026-11-08T01:00:00Z', completed_at: '2026-11-08T01:05:00Z' },
]);

// Only the check-run rule matters here, so measurement and override are left out (they fail the way they always did).
const checkFailures = (checkRuns: any[], diffFiles: string[]) =>
  evaluateGate({ sha: SHA, checkRuns, diffFiles, evidence: null, rollbackTarget: '34faed19', override: null, profileSha: '' })
    .failures.filter((f: string) => f.startsWith('check '));

const skipped = (name: string, when: string, id: number) => ({
  name, status: 'completed', conclusion: 'skipped', id, started_at: when, completed_at: when,
});
const success = (name: string, when: string, id: number) => ({
  name, status: 'completed', conclusion: 'success', id, started_at: when, completed_at: when,
});

describe('deploy gate check-run rule: latest completed run', () => {
  it('a success plus an older skipped duplicate passes (the newest run is the success)', () => {
    const checkRuns = runs({
      'snapshot-tests': [
        success('snapshot-tests', '2026-11-08T02:00:00Z', 20),
        skipped('snapshot-tests', '2026-11-08T01:00:00Z', 10),
      ],
    });
    expect(checkFailures(checkRuns, CODE)).toEqual([]);
  });

  it('a docs-only change with a skipped check passes', () => {
    const checkRuns = runs({ 'snapshot-tests': [skipped('snapshot-tests', '2026-11-08T02:00:00Z', 30)] });
    expect(checkFailures(checkRuns, DOCS_ONLY)).toEqual([]);
  });

  it('a code change with a skipped check blocks', () => {
    const checkRuns = runs({ 'snapshot-tests': [skipped('snapshot-tests', '2026-11-08T02:00:00Z', 31)] });
    expect(checkFailures(checkRuns, CODE)).toEqual(['check not green: snapshot-tests']);
  });

  it('a failed latest run blocks, even with an older success', () => {
    const checkRuns = runs({
      'g19-public-text': [
        { name: 'g19-public-text', status: 'completed', conclusion: 'failure', id: 40, started_at: '2026-11-08T03:00:00Z', completed_at: '2026-11-08T03:01:00Z' },
        success('g19-public-text', '2026-11-08T01:00:00Z', 4),
      ],
    });
    expect(checkFailures(checkRuns, DOCS_ONLY)).toEqual(['check not green: g19-public-text']);
  });

  it('a missing required check blocks', () => {
    const checkRuns = runs().filter((r) => r.name !== 'pr-text-attribution');
    expect(checkFailures(checkRuns, DOCS_ONLY)).toEqual(['check missing on the checked commit: pr-text-attribution']);
  });

  it('a run still in progress blocks, even with an older completed success', () => {
    const checkRuns = runs({
      'snapshot-tests': [
        { name: 'snapshot-tests', status: 'in_progress', conclusion: null, id: 50, started_at: '2026-11-08T04:00:00Z', completed_at: null },
        success('snapshot-tests', '2026-11-08T01:00:00Z', 5),
      ],
    });
    expect(checkFailures(checkRuns, CODE)).toEqual(['check not green: snapshot-tests (still running)']);
  });

  it('a skipped check with an empty diff blocks (nothing shows the change is docs-only)', () => {
    const checkRuns = runs({ 'snapshot-tests': [skipped('snapshot-tests', '2026-11-08T02:00:00Z', 32)] });
    expect(checkFailures(checkRuns, [])).toEqual(['check not green: snapshot-tests']);
  });
});
