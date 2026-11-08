import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nextDeadlineFrom, loadDeadlines } from '../scripts/lib/brief-deadlines.mjs';

const NOW = Date.parse('2026-11-08T03:00:00Z');
const FILE = new URL('../config/brief-deadlines.json', import.meta.url);

describe('nextDeadlineFrom: the nearest future date', () => {
  const list = [
    { label: 'past', date: '2026-06-01' },
    { label: 'soon', date: '2026-12-01' },
    { label: 'later', date: '2027-02-01' },
  ];

  it('picks the nearest deadline still in the future', () => {
    const d = nextDeadlineFrom(list, NOW);
    expect(d?.label).toBe('soon');
    expect(d?.daysLeft).toBeGreaterThan(20);
  });

  it('returns null when every date has passed (no stale "upcoming" line)', () => {
    expect(nextDeadlineFrom([{ label: 'old', date: '2026-06-01' }], NOW)).toBeNull();
  });

  it('a date that is exactly now is not upcoming', () => {
    expect(nextDeadlineFrom([{ label: 'now', date: '2026-11-08' }], Date.parse('2026-11-08T00:00:00Z'))).toBeNull();
  });
});

describe('brief deadlines data file', () => {
  it('loads and every row has a label and a real date', () => {
    const rows = loadDeadlines(FILE);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(typeof r.label).toBe('string');
      expect(Number.isNaN(new Date(r.date).getTime())).toBe(false);
    }
  });

  it('holds only dates after 8 Nov 2026 (no passed dates left in the file)', () => {
    for (const r of loadDeadlines(FILE)) {
      expect(new Date(r.date).getTime()).toBeGreaterThan(Date.parse('2026-11-08T00:00:00Z'));
    }
  });

  it('is the four dates the owner listed', () => {
    const labels = loadDeadlines(FILE).map((r: { label: string }) => r.label).sort();
    expect(labels).toEqual(['Cloudflare Observability', 'ElevenLabs', 'Gemini 2.5 Flash model change', 'npm exception review']);
  });

  it('the brief reads the file and no longer has the old hard-coded list', () => {
    const src = readFileSync(join(__dirname, '..', 'scripts', 'morning-brief.mjs'), 'utf8');
    expect(src).toMatch(/loadDeadlines\(new URL\('\.\.\/config\/brief-deadlines\.json', import\.meta\.url\)\)/);
    expect(src).not.toMatch(/CE-01 subjects|Fan CoLab/);
    expect(src).not.toMatch(/table: 'blog_posts'/);
    expect(src).toMatch(/table: 'guides'/);
  });
});
