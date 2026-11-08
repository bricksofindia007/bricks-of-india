// Morning Brief: waiting-draft age and the known-issues card (order 1580 item 4c, 4f, 4g).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WAITING_DAYS, knownIssueRows, openKnownIssues, waitingCutoffIso } from '../scripts/lib/brief-known-issues.mjs';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const register = [
  { id: 'KI-01', issue: 'Weekly social job checked against a daily threshold', state: 'fix drafted', fixPr: '930' },
  { id: 'KI-02', issue: 'Heartbeat rules read the weekly job', state: 'open', fixPr: 'none yet' },
  { id: 'KI-09', issue: 'Merged and clean', state: 'fix merged', fixPr: '900' },
  { id: 'KI-10', issue: 'Closed row', state: 'closed', fixPr: '901' },
];

describe('waiting drafts: older than 14 days', () => {
  it('the threshold is 14 days', () => {
    expect(WAITING_DAYS).toBe(14);
  });
  it('the cutoff is exactly 14 days before now', () => {
    const now = Date.UTC(2026, 10, 8, 4, 0, 0); // 8 Nov 2026 04:00 UTC
    expect(waitingCutoffIso(now)).toBe('2026-10-25T04:00:00.000Z');
  });
  it('the brief queries drafts older than the cutoff, with the same status filter', () => {
    const brief = read('scripts/morning-brief.mjs');
    expect(brief).toMatch(/\.eq\('status', 'draft'\)\.lt\('created_at', cutoff\)/);
    expect(brief).toMatch(/waitingCutoffIso\(Date\.now\(\), WAITING_DAYS\)/);
    expect(brief).toMatch(/Waiting more than \$\{WAITING_DAYS\} days/);
  });
});

describe('known-issues card', () => {
  it('shows only open rows: closed and fix-merged rows are not on the card', () => {
    expect(openKnownIssues(register).map((r) => r.id)).toEqual(['KI-01', 'KI-02']);
  });
  it('each card row has ID, one line, state and fix PR', () => {
    const rows = knownIssueRows(register);
    expect(rows[0]).toEqual({
      id: 'KI-01',
      issue: 'Weekly social job checked against a daily threshold',
      state: 'fix drafted',
      fixPr: '930',
    });
    expect(rows[1].fixPr).toBe('none yet');
  });
  it('the brief places the card after card 6 and reads the register with a fallback', () => {
    const brief = read('scripts/morning-brief.mjs');
    expect(brief).toMatch(/const s7 = card\('7 &mdash; Known issues'/);
    expect(brief).toMatch(/\$\{s1\}\$\{s2\}\$\{s3\}\$\{s4\}\$\{s5\}\$\{s6\}\$\{s7\}/);
    expect(brief).toMatch(/Register unavailable/);
    expect(brief).toMatch(/config\/known-issues\.json/);
  });
});
