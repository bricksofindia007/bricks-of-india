// Social alert thresholds (weekly social run: a week plus a day) and the egress projection state-change rule.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SOCIAL_SUCCESS_MAX_HOURS, SOCIAL_WEEKLY_MAX_HOURS } from '../scripts/lib/social-alerts.mjs';
import { egressAlertDecision } from '../scripts/lib/egress-alert.mjs';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('social alert thresholds', () => {
  it('the weekly limit and the posting-stopped limit are both 192 hours', () => {
    expect(SOCIAL_WEEKLY_MAX_HOURS).toBe(192);
    expect(SOCIAL_SUCCESS_MAX_HOURS).toBe(192);
  });

  it('the weekly site check uses the weekly limit and says weekly social run, not daily pipeline', () => {
    const all = read('scripts/technical-hygiene.mjs');
    // Scope to the social block only (15i up to Check 16); the store-price checks keep their own 25-hour cutoff.
    const start = all.indexOf('// 15i: Social automation');
    const end = all.indexOf('// ── Check 16', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const social = all.slice(start, end);
    expect(social).toMatch(/if \(hoursAgo > SOCIAL_WEEKLY_MAX_HOURS\)/);
    expect(social).toMatch(/weekly social run may be failing/);
    expect(social).not.toMatch(/daily pipeline/);
    expect(social).not.toMatch(/25 \* 3_600_000/);
  });
});

describe('egress projection alert: email on state change only', () => {
  it('below the line: no email, state stays empty', () => {
    expect(egressAlertDecision(null, null)).toMatchObject({ emit: false, nextState: null });
    expect(egressAlertDecision(null, 'warning')).toMatchObject({ emit: false, nextState: null });
  });

  it('first crossing into warning emails once', () => {
    expect(egressAlertDecision('warning', null)).toMatchObject({ emit: true, nextState: 'warning' });
  });

  it('staying in warning does not email again (the daily repeat this fixes)', () => {
    expect(egressAlertDecision('warning', 'warning')).toMatchObject({ emit: false, nextState: 'warning' });
  });

  it('a new higher band (critical) emails once', () => {
    expect(egressAlertDecision('critical', 'warning')).toMatchObject({ emit: true, nextState: 'critical' });
  });

  it('staying critical does not email again', () => {
    expect(egressAlertDecision('critical', 'critical')).toMatchObject({ emit: false, nextState: 'critical' });
  });

  it('a drop from critical to warning does not email, and keeps critical as the open state', () => {
    expect(egressAlertDecision('warning', 'critical')).toMatchObject({ emit: false, nextState: 'critical' });
  });

  it('after dropping below the line, the next crossing emails again', () => {
    const cleared = egressAlertDecision(null, 'warning');
    expect(egressAlertDecision('warning', cleared.nextState)).toMatchObject({ emit: true });
  });

  it('rejects an unknown band rather than guessing', () => {
    expect(() => egressAlertDecision('severe', null)).toThrow(/unknown egress band/);
  });
});
