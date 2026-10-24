import { describe, it, expect } from 'vitest';
import { summariseStandee, standeeLines, followerChange, STANDEE_START, PRE_STANDEE_SOURCE } from '../scripts/lib/standee.mjs';

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
  // Seeded pre-standee baselines (the last reads before the standee) plus one post-standee read each.
  followers: [
    { platform: 'instagram', captured_on: '2026-10-08', captured_at: '2026-10-08T01:11:00Z', followers: '184', source: PRE_STANDEE_SOURCE },
    { platform: 'instagram', captured_on: '2026-10-16', captured_at: '2026-10-16T21:31:00Z', followers: '190', source: 'followers_snapshot' },
    { platform: 'youtube', captured_on: '2026-10-14', captured_at: '2026-10-14T00:29:00Z', followers: '289', source: PRE_STANDEE_SOURCE },
    { platform: 'youtube', captured_on: '2026-10-16', captured_at: '2026-10-16T21:31:00Z', followers: '293', source: 'followers_snapshot' },
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

  it('does not sum activeUsers across days (the since-totals are built only from additive measures)', () => {
    const s = summariseStandee(base);
    expect(Object.keys(s.since).sort()).toEqual(['about', 'clicks', 'sessions', 'sessionsIndia', 'sets', 'siteSessions']);
  });
});

describe('followerChange', () => {
  it('uses the seeded pre-standee read as the baseline and the newest read as latest', () => {
    const f = followerChange(base.followers, 'instagram');
    expect(f).toMatchObject({
      status: 'ok',
      baseline: { followers: 184, capturedAt: '2026-10-08T01:11:00Z' },
      latest: { followers: 190, capturedOn: '2026-10-16' },
      change: 6,
    });
  });

  it('computes YouTube against its own seeded baseline (14 Oct read), not Instagram\'s', () => {
    const f = followerChange(base.followers, 'youtube');
    expect(f).toMatchObject({ status: 'ok', baseline: { followers: 289, capturedAt: '2026-10-14T00:29:00Z' }, change: 4 });
  });

  it('is baseline pending when no pre-standee read has been seeded', () => {
    const rows = base.followers.filter((r) => r.source !== PRE_STANDEE_SOURCE);
    expect(followerChange(rows, 'instagram')).toEqual({ platform: 'instagram', status: 'baseline pending' });
  });

  it('is "no read since" when the baseline is the only read', () => {
    const rows = base.followers.filter((r) => r.platform === 'youtube' && r.source === PRE_STANDEE_SOURCE);
    const f = followerChange(rows, 'youtube');
    expect(f.status).toBe('no read since');
    expect(f.baseline.followers).toBe(289);
    expect(f.change).toBeUndefined();
  });

  it('does not treat a post-standee read as the baseline', () => {
    const rows = [{ platform: 'youtube', captured_on: '2026-10-17', captured_at: '2026-10-17T21:31:00Z', followers: '300', source: 'followers_snapshot' }];
    expect(followerChange(rows, 'youtube').status).toBe('baseline pending');
  });
});

describe('standeeLines: follower wording', () => {
  it('says "since the last pre-standee read" and gives the baseline date and time in plain words', () => {
    const lines = standeeLines(summariseStandee(base));
    expect(lines[2]).toBe('Instagram followers: 190 as of 16 Oct, +6 since the last pre-standee read (184, read 8 Oct, 01:11 UTC).');
    expect(lines[3]).toBe('YouTube followers: 293 as of 16 Oct, +4 since the last pre-standee read (289, read 14 Oct, 00:29 UTC).');
  });

  it('says there is no newer read when only the baseline exists', () => {
    const rows = base.followers.filter((r) => r.source === PRE_STANDEE_SOURCE);
    const lines = standeeLines(summariseStandee({ ...base, followers: rows }));
    expect(lines).toContain('Instagram followers: 184 at the last pre-standee read (8 Oct, 01:11 UTC). No newer read yet.');
  });

  it('says baseline pending, not a number, when nothing is seeded', () => {
    const rows = base.followers.filter((r) => r.source !== PRE_STANDEE_SOURCE);
    const lines = standeeLines(summariseStandee({ ...base, followers: rows }));
    expect(lines).toContain('Instagram followers: baseline pending (no pre-standee read on record).');
    expect(lines).toContain('YouTube followers: baseline pending (no pre-standee read on record).');
  });
});

describe('standeeLines: other wording', () => {
  it('renders the day label and the since line', () => {
    const lines = standeeLines(summariseStandee(base));
    expect(lines[0]).toBe('Yesterday (15 Oct): 20 sessions (5 from India), 5 clicks, 4 /about visits, 2 /sets visits.');
    expect(lines[1]).toBe('Since 15 Oct: 20 sessions (5 from India), 5 clicks, 4 /about visits, 2 /sets visits. That is 3.3% of all site sessions.');
  });

  it('says "Latest GA4 day" when the reported day is not yesterday', () => {
    const lines = standeeLines(summariseStandee({ ...base, today: '2026-10-17' }));
    expect(lines[0].startsWith('Latest GA4 day (15 Oct):')).toBe(true);
  });

  it('is honest when there is no GA4 data', () => {
    const lines = standeeLines(summariseStandee({ ...base, campaignSessions: [], pageViews: [], clicks: [] }));
    expect(lines[0]).toBe('No GA4 data for the standee campaign has been reported yet (GA4 runs 1–2 days behind).');
  });

  it('renders an unavailable line for a failed read, and never throws', () => {
    expect(standeeLines({ error: 'query failed (ECONNREFUSED)' })).toEqual(['Unavailable: query failed (ECONNREFUSED)']);
  });
});

describe('constants', () => {
  it('the standee window starts on 15 Oct 2026, and the baseline source tag is fixed', () => {
    expect(STANDEE_START).toBe('2026-10-15');
    expect(PRE_STANDEE_SOURCE).toBe('pre_standee_seed');
  });
});
