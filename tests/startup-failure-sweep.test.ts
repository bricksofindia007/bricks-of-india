// Stop-line alert: which failed scheduled runs count as start-up failures.
import { describe, it, expect } from 'vitest';
import { classifyStartupFailure, issueFor, secondsBetween, START_UP_MAX_SECONDS } from '../scripts/ci/startup-failure-sweep.mjs';

const T0 = '2026-10-23T02:00:00Z';
const after = (s: number) => new Date(Date.parse(T0) + s * 1000).toISOString();
const sched = { event: 'schedule', conclusion: 'failure' };

describe('classifyStartupFailure', () => {
  it('a failed job that ran for under the start-up limit is a start-up failure', () => {
    const v = classifyStartupFailure(sched, [{ name: 'generate', conclusion: 'failure', started_at: T0, completed_at: after(20), steps: [] }]);
    expect(v.startUp).toBe(true);
    expect(v.job).toBe('generate');
    expect(v.reason).toMatch(/after 20 s/);
  });

  it('a failed job that ran long is not a start-up failure', () => {
    const v = classifyStartupFailure(sched, [{ name: 'generate', conclusion: 'failure', started_at: T0, completed_at: after(START_UP_MAX_SECONDS + 600), steps: [] }]);
    expect(v.startUp).toBe(false);
  });

  it('a failed set-up step is a start-up failure even when the job ran long', () => {
    const v = classifyStartupFailure(sched, [{
      name: 'generate', conclusion: 'failure', started_at: T0, completed_at: after(900),
      steps: [{ name: 'Install dependencies', conclusion: 'failure' }],
    }]);
    expect(v.startUp).toBe(true);
    expect(v.reason).toMatch(/set-up step failed: Install dependencies/);
  });

  it('a run that is not scheduled is ignored', () => {
    const v = classifyStartupFailure({ event: 'workflow_dispatch', conclusion: 'failure' }, [{ name: 'g', conclusion: 'failure', started_at: T0, completed_at: after(5), steps: [] }]);
    expect(v.startUp).toBe(false);
  });

  it('a run that succeeded is ignored', () => {
    const v = classifyStartupFailure({ event: 'schedule', conclusion: 'success' }, []);
    expect(v.startUp).toBe(false);
  });

  it('a job with no timestamps is not judged a start-up failure on time alone', () => {
    const v = classifyStartupFailure(sched, [{ name: 'g', conclusion: 'failure', started_at: null, completed_at: null, steps: [] }]);
    expect(v.startUp).toBe(false);
  });
});

describe('issueFor', () => {
  it('names the workflow, run and reason, and contains no link to secret values', () => {
    const run = { name: 'Generate drafts', id: 123, html_url: 'https://github.com/x/y/actions/runs/123' };
    const { title, body } = issueFor(run, { job: 'generate', reason: 'job failed after 20 s' });
    expect(title).toBe('Scheduled workflow failed at start-up: Generate drafts (run 123)');
    expect(body).toContain('Reason: job failed after 20 s');
    expect(body).toContain('https://github.com/x/y/actions/runs/123');
  });
});

describe('secondsBetween', () => {
  it('returns null for missing or invalid times', () => {
    expect(secondsBetween(null, T0)).toBeNull();
    expect(secondsBetween(T0, 'nope')).toBeNull();
    expect(secondsBetween(T0, after(7))).toBe(7);
  });
});
