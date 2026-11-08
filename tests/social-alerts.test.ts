// Health check social alerts, parity expected list, and the known-issues register (order 1580 item 4, alert standard).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SOCIAL_WEEKLY_CRON, SOCIAL_WEEKLY_MAX_HOURS, SOCIAL_WORKFLOW, SOCIAL_SUCCESS_MAX_HOURS,
  emailable, isWeeklyCron, runWords, socialCauses, suppressKnown,
} from '../scripts/lib/social-alerts.mjs';
import { applyExpectedHeld } from '../scripts/ci/migration-parity.mjs';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const fresh = { neverRan: false, attemptAgeH: 2, successAgeH: 10 };
const stale = { neverRan: false, attemptAgeH: 300, successAgeH: 300 };
const okWorkflow = { conclusion: 'success', status: 'completed', ageH: 20, createdAt: '2026-11-02T06:30:00Z' };

describe('thresholds match the schedule', () => {
  it('the weekly social job is a weekly cron (Mondays 06:30 UTC, 12:00 IST)', () => {
    expect(isWeeklyCron(SOCIAL_WEEKLY_CRON)).toBe(true);
    expect(SOCIAL_WEEKLY_CRON).toBe('30 6 * * 1');
    expect(isWeeklyCron('30 1 * * *')).toBe(false);
  });
  it('the workflow file has that cron, and the limit is one week plus one day', () => {
    const wf = read('.github/workflows/social-automation.yml');
    expect(wf).toContain(`cron: '${SOCIAL_WEEKLY_CRON}'`);
    expect(SOCIAL_WEEKLY_MAX_HOURS).toBe(7 * 24 + 24);
    expect(SOCIAL_WORKFLOW).toBe('social-automation.yml');
  });
  it('the health check uses the same workflow name and the 192-hour limit for the weekly job', () => {
    const hc = read('scripts/health-check.mjs');
    expect(hc).toMatch(/const SOCIAL_ATTEMPT_MAX_HOURS = 7 \* 24 \+ 24;/);
    expect(hc).toMatch(/file: 'social-automation\.yml', label: 'Social automation',\s+maxAgeHours: 192/);
    expect(hc).toMatch(/wf\.file !== SOCIAL_WORKFLOW/);
  });
});

describe('one email per cause', () => {
  it('Instagram and YouTube both stale: one weekly-run cause, not two', () => {
    const causes = socialCauses({ ig: stale, yt: stale, workflow: okWorkflow });
    expect(causes.map((c) => c.key)).toEqual(['social-weekly-run']);
  });
  it('the workflow failed and a channel is stale: still one cause', () => {
    const causes = socialCauses({ ig: stale, yt: fresh, workflow: { ...okWorkflow, conclusion: 'failure' } });
    expect(causes).toHaveLength(1);
  });
  it('the weekly run is on time but a channel has not posted for 120 hours: a separate posting cause', () => {
    const quiet = { neverRan: false, attemptAgeH: 2, successAgeH: 200 };
    const causes = socialCauses({ ig: quiet, yt: fresh, workflow: okWorkflow });
    expect(causes.map((c) => c.key)).toEqual(['social-posting-stopped']);
    expect(causes[0].body).toContain('Instagram');
    expect(causes[0].body).not.toContain('YouTube:');
  });
  it('nothing wrong: no cause', () => {
    expect(socialCauses({ ig: fresh, yt: fresh, workflow: okWorkflow })).toEqual([]);
  });
});

describe('wording: a run that happened is "timed out" or "failed", never "not attempting"', () => {
  it('a cancelled (timed out) run says timed out', () => {
    const [c] = socialCauses({ ig: stale, yt: stale, workflow: { ...okWorkflow, conclusion: 'cancelled' } });
    expect(c.subject).toContain('timed out');
    expect(c.subject).not.toMatch(/not attempting/i);
    expect(c.body).not.toMatch(/not attempting/i);
  });
  it('a failed run says failed', () => {
    const [c] = socialCauses({ ig: stale, yt: stale, workflow: { ...okWorkflow, conclusion: 'failure' } });
    expect(runWords({ conclusion: 'failure' })).toBe('failed');
    expect(c.subject).toContain('failed');
  });
  it('names the weekly social post, not YouTube or Instagram as the workflow', () => {
    const [c] = socialCauses({ ig: stale, yt: stale, workflow: { ...okWorkflow, conclusion: 'cancelled' } });
    expect(c.subject).toContain('Weekly social post');
    expect(c.subject).not.toMatch(/YouTube|Instagram/);
  });
  it('the body states visitor impact and whether the owner must act (alert standard rules 3 and 5)', () => {
    const [c] = socialCauses({ ig: stale, yt: stale, workflow: okWorkflow });
    expect(c.body).toContain('Visitors affected: not known.');
    expect(c.body).toContain('Owner action: yes');
  });
  it('the posting-stopped threshold is 120 hours', () => {
    expect(SOCIAL_SUCCESS_MAX_HOURS).toBe(120);
  });
});

describe('known issues are not emailed again while open', () => {
  const register = JSON.parse(read('config/known-issues.json')).issues;
  it('the register lists KI-01 to KI-03 with alerts covered', () => {
    expect(register.map((r: { id: string }) => r.id)).toEqual(['KI-01', 'KI-02', 'KI-03']);
    expect(register[0].alertsCovered).toContain('social-weekly-run');
  });
  it('an open row suppresses its cause; the cause is still reported in the log, not emailed', () => {
    const causes = suppressKnown(socialCauses({ ig: stale, yt: stale, workflow: okWorkflow }), register);
    expect(causes[0].suppressedBy).toBe('KI-01');
    expect(emailable(causes)).toEqual([]);
  });
  it('a closed row does not suppress', () => {
    const closed = register.map((r: object) => ({ ...r, state: 'closed' }));
    const causes = suppressKnown(socialCauses({ ig: stale, yt: stale, workflow: okWorkflow }), closed);
    expect(emailable(causes)).toHaveLength(1);
  });
  it('a cause that no open row covers is still emailed', () => {
    const quiet = { neverRan: false, attemptAgeH: 2, successAgeH: 200 };
    const onlyWeekly = register.filter((r: { id: string }) => r.id === 'KI-01');
    const causes = suppressKnown(socialCauses({ ig: quiet, yt: fresh, workflow: okWorkflow }), onlyWeekly);
    expect(emailable(causes)).toHaveLength(1);
  });
});

describe('migration parity expected list', () => {
  const expected = JSON.parse(read('config/parity-expected-held.json')).versions as string[];
  it('lists the ten held migrations, each a 14-digit version', () => {
    expect(expected).toHaveLength(10);
    for (const v of expected) expect(v).toMatch(/^\d{14}$/);
  });
  it('passes while only the listed versions are repo-only', () => {
    const r = applyExpectedHeld({ unapplied: expected, prodOnly: [], expected });
    expect(r.ok).toBe(true);
    expect(r.expectedSeen).toHaveLength(10);
  });
  it('fails on a repo-only version that is not listed', () => {
    const r = applyExpectedHeld({ unapplied: [...expected, '20261101000000'], prodOnly: [], expected });
    expect(r.ok).toBe(false);
    expect(r.unexpected).toEqual(['20261101000000']);
  });
  it('fails on a production-only version, even if the repo-only ones are listed', () => {
    const r = applyExpectedHeld({ unapplied: expected, prodOnly: ['20260101000000'], expected });
    expect(r.ok).toBe(false);
  });
  it('reports an expected version that is now applied, so the list can be cut down', () => {
    const r = applyExpectedHeld({ unapplied: expected.slice(1), prodOnly: [], expected });
    expect(r.ok).toBe(true);
    expect(r.nowApplied).toEqual([expected[0]]);
  });
});
