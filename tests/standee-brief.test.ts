import { describe, it, expect } from 'vitest';
import { summariseStandee, standeeLines, followerChange, STANDEE_START } from '../scripts/lib/standee.mjs';

// Fixtures use the same row shapes fetchStandeeData() returns (metric_date as text, values as strings: pg returns numeric as string).
const base = {
  today: '2026-10-16',
  campaignSessions: [
    { metric_date: '2026-10-14', geo: 'all', value: '12' },
    { metric_date: '2026-10-14', geo: 'india', value: '3' },
    { metric_date: '2026-10-15', geo: 'all', value: '20' },
    { metric_date: '2026-10-15', geo: 'india', value: '5' },
  ],
  siteSessions: [
    { metric_date: '2026-10-14', geo: 'all', value: '400' },
    { metric_date: '2026-10-15', geo: 'all', value: '600' },
  ],
  pageViews: [
    { metric_date: '2026-10-14', dimension_value: '/about', value: '1' },
    { metric_date: '2026-10-14', dimension_value: '/sets', value: '0' },
    { metric_date: '2026-10-15', dimension_value: '/about', value: '4' },
    { metric_date: '2026-10-15', dimension_value: '/sets', value: '2' },
  ],
  clicks: [
    { metric_date: '2026-10-14', value: '2' },
    { metric_date: '2026-10-15', value: '5' },
  ],
  followers: [
    { platform: 'instagram', captured_on: '2026-10-15', followers: 188 },
    { platform: 'instagram', captured_on: '2026-10-16', followers: 190 },
    { platform: 'youtube', captured_on: '2026-10-15', followers: 290 },
    { platform: 'youtube', captured_on: '2026-10-16', followers: 293 },
  ],
};

describe('summariseStandee', () => {
  it('reports the latest GA4 day and the since-15-Oct totals', () => {
    const s = summariseStandee(base);
    expect(s.latest).toEqual({ date: '2026-10-15', sessions: 20, sessionsIndia: 5, clicks: 5, about: 4, sets: 2 });
    // Since-start totals count only 15 Oct onward; the 14 Oct rows are excluded.
    expect(s.since.sessions).toBe(20);
    expect(s.since.sessionsIndia).toBe(5);
    expect(s.since.clicks).toBe(5);
    expect(s.since.about).toBe(4);
    expect(s.since.sets).toBe(2);
    expect(s.since.siteSessions).toBe(600);
  });

  it('labels yesterday correctly and leaves the latest day as its own date when GA4 is behind', () => {
    const s = summariseStandee(base);
    expect(s.yesterday).toBe('2026-10-15');
    const lagged = summariseStandee({ ...base, today: '2026-10-17' });
    expect(lagged.yesterday).toBe('2026-10-16');
    expect(lagged.latest.date).toBe('2026-10-15');
  });

  it('returns no latest day and zero totals when GA4 has reported nothing yet', () => {
    const s = summariseStandee({ ...base, campaignSessions: [], pageViews: [], clicks: [] });
    expect(s.latest).toBeNull();
    expect(s.since.sessions).toBe(0);
  });

  it('does not sum activeUsers across days (the inputs do not carry it at all)', () => {
    // Structural: the summary's since-totals are built only from sessions, clicks and page views.
    const s = summariseStandee(base);
    expect(Object.keys(s.since).sort()).toEqual(['about', 'clicks', 'sessions', 'sessionsIndia', 'sets', 'siteSessions']);
  });
});

describe('followerChange', () => {
  it('uses the exact 15 Oct snapshot as the baseline when there is one', () => {
    const f = followerChange(base.followers, 'instagram');
    expect(f).toMatchObject({ status: 'ok', baseline: 188, baselineExact: true, latest: 190, change: 2, latestDate: '2026-10-16' });
  });

  it('falls back to the first later snapshot and says so, rather than pretending it is 15 Oct', () => {
    const rows = [{ platform: 'youtube', captured_on: '2026-10-17', followers: 300 }, { platform: 'youtube', captured_on: '2026-10-18', followers: 302 }];
    const f = followerChange(rows, 'youtube');
    expect(f).toMatchObject({ status: 'ok', baselineDate: '2026-10-17', baselineExact: false, change: 2 });
  });

  it('is baseline pending with no snapshots at all', () => {
    expect(followerChange([], 'instagram')).toEqual({ platform: 'instagram', status: 'baseline pending' });
  });

  it('a single snapshot is the baseline with zero change, not a fabricated trend', () => {
    const f = followerChange([{ platform: 'instagram', captured_on: '2026-10-15', followers: 188 }], 'instagram');
    expect(f.change).toBe(0);
    expect(f.latestDate).toBe(f.baselineDate);
  });
});

describe('standeeLines', () => {
  it('renders plain wording with the day label, the since line, and follower changes', () => {
    const lines = standeeLines(summariseStandee(base));
    expect(lines[0]).toBe('Yesterday (15 Oct): 20 sessions (5 from India), 5 clicks, 4 /about visits, 2 /sets visits.');
    expect(lines[1]).toBe('Since 15 Oct: 20 sessions (5 from India), 5 clicks, 4 /about visits, 2 /sets visits. That is 3.3% of all site sessions.');
    expect(lines[2]).toBe('Instagram followers: 190 now, +2 vs 188 on 15 Oct.');
    expect(lines[3]).toBe('YouTube followers: 293 now, +3 vs 290 on 15 Oct.');
  });

  it('says "Latest GA4 day" when the reported day is not yesterday', () => {
    const lines = standeeLines(summariseStandee({ ...base, today: '2026-10-17' }));
    expect(lines[0].startsWith('Latest GA4 day (15 Oct):')).toBe(true);
  });

  it('is honest when there is no GA4 data and no follower baseline', () => {
    const lines = standeeLines(summariseStandee({ ...base, campaignSessions: [], pageViews: [], clicks: [], followers: [] }));
    expect(lines[0]).toBe('No GA4 data for the standee campaign has been reported yet (GA4 runs 1–2 days behind).');
    expect(lines).toContain('Instagram followers: baseline pending (no snapshot yet).');
    expect(lines).toContain('YouTube followers: baseline pending (no snapshot yet).');
  });

  it('marks a non-15-Oct baseline as such', () => {
    const rows = [{ platform: 'instagram', captured_on: '2026-10-17', followers: 191 }, { platform: 'instagram', captured_on: '2026-10-18', followers: 193 }];
    const lines = standeeLines(summariseStandee({ ...base, followers: rows }));
    expect(lines).toContain('Instagram followers: 193 now, +2 vs 191 on 17 Oct, not 15 Oct.');
  });

  it('renders an unavailable line for a failed read, and never throws', () => {
    expect(standeeLines({ error: 'query failed (ECONNREFUSED)' })).toEqual(['Unavailable: query failed (ECONNREFUSED)']);
  });
});

describe('constants', () => {
  it('the standee window starts on 15 Oct 2026', () => {
    expect(STANDEE_START).toBe('2026-10-15');
  });
});
