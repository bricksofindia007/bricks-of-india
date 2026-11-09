// The workflow freshness watchdog (order 1750): the social job's threshold matches its weekly schedule, and the paused list
// holds exactly the two workflows that resume after the 16 Nov catalogue run.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const watchdog = read('.github/workflows/workflow-freshness-watchdog.yml');
const social = read('.github/workflows/social-automation.yml');

// The block between "const WATCHLIST = {" and its closing "};".
const watchlistBlock = watchdog.slice(watchdog.indexOf('const WATCHLIST = {'), watchdog.indexOf('};', watchdog.indexOf('const WATCHLIST = {')));
const pausedBlock = watchdog.slice(watchdog.indexOf('const PAUSED = {'), watchdog.indexOf('};', watchdog.indexOf('const PAUSED = {')));

describe('social job threshold matches its weekly schedule', () => {
  it('the social workflow is a weekly cron, Mondays 06:30 UTC (12:00 IST)', () => {
    expect(social).toMatch(/cron: '30 6 \* \* 1'/);
  });
  it('the watchdog entry is 192 hours: one week plus one day, at a multiple of 1', () => {
    const m = watchlistBlock.match(/"social-automation\.yml":\s*\[([^\]]+)\]/);
    expect(m, 'social-automation.yml entry').not.toBeNull();
    const [hours, mult] = m![1].split(',').map((s) => s.trim());
    expect(hours).toBe('7 * 24 + 24');
    expect(mult).toBe('1');
    expect(7 * 24 + 24 * 1).toBe(192);
  });
  it('the watchdog threshold equals the health check social limit', () => {
    const hc = read('scripts/health-check.mjs');
    expect(hc).toMatch(/const SOCIAL_ATTEMPT_MAX_HOURS = 7 \* 24 \+ 24;/);
  });
  it('no daily threshold is left on the social job', () => {
    expect(watchlistBlock).not.toMatch(/"social-automation\.yml":\s*\[24,/);
  });
});

describe('paused list is exactly the two workflows that resume after 16 Nov', () => {
  it('lists retiring-soon.yml and sync-catalogue.yml, and no other workflow', () => {
    const keys = [...pausedBlock.matchAll(/"([^"]+\.yml)":/g)].map((x) => x[1]).sort();
    expect(keys).toEqual(['retiring-soon.yml', 'sync-catalogue.yml']);
  });
  it('each paused note says they resume after the 16 Nov 2026 catalogue run', () => {
    const notes = [...pausedBlock.matchAll(/"[^"]+\.yml":\s*"([^"]+)"/g)].map((x) => x[1]);
    expect(notes).toHaveLength(2);
    for (const n of notes) expect(n).toMatch(/resumes after the 16 Nov 2026 catalogue run/);
  });
  it('the paused check skips the alert and logs it', () => {
    expect(watchdog).toMatch(/if \(PAUSED\[file\]\) \{\s*console\.log\(`  PAUSED \(not alerted\)/);
  });
});

describe('the rest of the watchlist is unchanged', () => {
  it('the watchlist still has its 15 entries', () => {
    const entries = [...watchlistBlock.matchAll(/^\s*"[^"]+\.yml":/gm)];
    expect(entries).toHaveLength(15);
  });
});
