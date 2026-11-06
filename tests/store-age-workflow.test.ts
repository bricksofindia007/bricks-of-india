/**
 * The daily age workflow must send the alert AND turn the run red (order 0570, PR 894 fix).
 * Parses the real workflow file; no network.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parse } from 'yaml';

const wf = parse(fs.readFileSync('.github/workflows/store-age-daily.yml', 'utf8'));
const steps: any[] = wf.jobs.age.steps;
const idx = (pred: (s: any) => boolean) => steps.findIndex(pred);

describe('store-age-daily workflow: alert and red run', () => {
  it('the age step continues on error, so the alert step can run', () => {
    const age = steps.find((s) => s.id === 'age');
    expect(age).toBeDefined();
    expect(age['continue-on-error']).toBe(true);
    expect(age.run).toMatch(/store-age-check\.mjs/);
  });

  it('the failure mail step runs only when the age step failed', () => {
    const mail = steps.find((s) => s.run === 'node scripts/workflow-failure-notify.mjs');
    expect(mail).toBeDefined();
    expect(mail.if).toBe("steps.age.outcome == 'failure'");
    expect(mail['continue-on-error']).toBe(true);
  });

  it('a last step fails the job when the age step failed', () => {
    const last = steps[steps.length - 1];
    expect(last.if).toBe("steps.age.outcome == 'failure'");
    expect(last.run).toMatch(/exit 1/);
  });

  it('the failing step comes after the mail step, and the mail step comes after the age step', () => {
    const ageAt = idx((s) => s.id === 'age');
    const mailAt = idx((s) => s.run === 'node scripts/workflow-failure-notify.mjs');
    const redAt = steps.length - 1;
    expect(ageAt).toBeLessThan(mailAt);
    expect(mailAt).toBeLessThan(redAt);
  });

  it('the job keeps its timeout and the schedule is daily', () => {
    expect(wf.jobs.age['timeout-minutes']).toBe(5);
    expect(wf.on.schedule[0].cron).toBe('40 3 * * *');
  });
});
