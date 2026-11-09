// The social posting run is weekly (social-automation.yml: Mondays 12:00 IST). The health check's attempt limit for the
// Instagram and YouTube pipelines is one week plus one day. The 120-hour success limits are unchanged.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const src = readFileSync(join(root, 'scripts/health-check.mjs'), 'utf8');
const cron = readFileSync(join(root, '.github/workflows/social-automation.yml'), 'utf8');
// Order 1690: the alert wording and the weekly limit live in the social-alerts module, which the health check imports.
const alerts = readFileSync(join(root, 'scripts/lib/social-alerts.mjs'), 'utf8');

describe('social attempt limit in the health check', () => {
  it('the workflow still runs once a week, on Monday', () => {
    expect(cron).toMatch(/cron: '30 6 \* \* 1'/);
  });
  it('the limit is one week plus one day, defined once', () => {
    expect(src).toMatch(/const SOCIAL_ATTEMPT_MAX_HOURS = 7 \* 24 \+ 24;/);
    expect(src.split('const SOCIAL_ATTEMPT_MAX_HOURS').length - 1).toBe(1);
    expect(7 * 24 + 24).toBe(192);
  });
  it('Instagram and YouTube both compare the attempt age to that limit', () => {
    expect(src).toMatch(/if \(igAttemptAge > SOCIAL_ATTEMPT_MAX_HOURS\)/);
    expect(src).toMatch(/if \(attemptAge > SOCIAL_ATTEMPT_MAX_HOURS\)/);
  });
  it('the old 26-hour attempt limit is gone from both checks', () => {
    expect(src).not.toMatch(/igAttemptAge > 26\b/);
    expect(src).not.toMatch(/attemptAge > 26\b/);
  });
  // Order 1690: the alert wording moved to scripts/lib/social-alerts.mjs (the health check imports it). Asserted there.
  it('the alert text says weekly, not daily (wording now in the social-alerts module)', () => {
    expect(alerts).toMatch(/Threshold: \$\{SOCIAL_WEEKLY_MAX_HOURS\} hours \(weekly, Mondays 12:00 IST, with one day of margin\)\./);
    expect(alerts).not.toMatch(/runs daily/);
    expect(alerts).toMatch(/export const SOCIAL_WEEKLY_MAX_HOURS = 7 \* 24 \+ 24;/);
  });
  it('the 120-hour success limits are unchanged', () => {
    expect(src).toMatch(/if \(igSuccessAge > 120\)/);
    expect(src).toMatch(/if \(successAge > 120\)/);
  });
});
