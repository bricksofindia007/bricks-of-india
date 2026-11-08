// Morning Brief: waiting-draft age, the known-issues card, and the card numbering (order 1580 item 4; order 1600 item 3).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WAITING_DAYS, knownIssueRows, openKnownIssues, waitingCutoffIso } from '../scripts/lib/brief-known-issues.mjs';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const register = [
  { id: 'KI-01', alertsCovered: ['social-weekly-run'], state: 'fix drafted' },
  { id: 'KI-02', alertsCovered: ['social-posting-stopped'], state: 'open' },
  { id: 'KI-09', alertsCovered: [], state: 'fix merged' },
  { id: 'KI-10', alertsCovered: [], state: 'closed' },
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
  it('each card row has id and state only (the public register has no issue text)', () => {
    expect(knownIssueRows(register)).toEqual([
      { id: 'KI-01', state: 'fix drafted' },
      { id: 'KI-02', state: 'open' },
    ]);
  });
  it('the card is card 6 after the dispatch card, and reads the register with a fallback', () => {
    const brief = read('scripts/morning-brief.mjs');
    expect(brief).toMatch(/const s6 = card\('6 &mdash; Known issues'/);
    expect(brief).toMatch(/\$\{s1\}\$\{s2\}\$\{s3\}\$\{s4\}\$\{s5\}\$\{s6\}/);
    expect(brief).toMatch(/Register unavailable/);
    expect(brief).toMatch(/config\/known-issues\.json/);
  });
});

describe('card 5 (Next Hard Deadline) is removed (G18, order 1600)', () => {
  it('the brief has no deadline card, no deadline data, and no deadline import', () => {
    const brief = read('scripts/morning-brief.mjs');
    expect(brief).not.toMatch(/Next Hard Deadline/);
    expect(brief).not.toMatch(/nextDeadline|loadDeadlines|brief-deadlines/);
  });
  it('the cards are numbered 1 to 6 with no gap', () => {
    const brief = read('scripts/morning-brief.mjs');
    for (const n of [1, 2, 3, 4, 5, 6]) expect(brief).toMatch(new RegExp(`card\\('${n} &mdash; `));
    expect(brief).not.toMatch(/card\('7 &mdash;/);
  });
});
