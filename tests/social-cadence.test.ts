// Social automation cadence: the post-age check (technical-hygiene) and the watchdog window for
// social-automation.yml use the same eight-day window, so a weekly Monday run stays fresh all week.
import { describe, it, expect } from 'vitest';
import { socialPostStatus, SOCIAL_MAX_HOURS } from '../scripts/lib/social-cadence.mjs';
import { WATCHLIST, evaluateFreshness } from '../workers/boi-scheduler/src/freshness';

const NOW = Date.parse('2026-10-29T06:30:00Z'); // Monday 12:00 IST, the social run slot
const DAY = 24 * 3_600_000;
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

describe('social post age (technical-hygiene check)', () => {
  it('the window is eight days', () => {
    expect(SOCIAL_MAX_HOURS).toBe(192);
  });
  it('last Monday\'s post is fresh today', () => {
    const r = socialPostStatus(ago(7), NOW);
    expect(r.fresh).toBe(true);
    expect(r.hoursAgo).toBeCloseTo(168, 5);
  });
  it('a post exactly at the window edge is still fresh', () => {
    expect(socialPostStatus(ago(8), NOW).fresh).toBe(true);
  });
  it('a post older than the window is stale and reports its age', () => {
    const r = socialPostStatus(ago(8.5), NOW);
    expect(r.fresh).toBe(false);
    expect(r.hoursAgo).toBeCloseTo(204, 5);
  });
  it('the old 25-hour window is gone: a 2-day-old post is fresh', () => {
    expect(socialPostStatus(ago(2), NOW).fresh).toBe(true);
  });
});

describe('watchdog window for social-automation.yml', () => {
  it('the watchlist row uses the same eight-day window with multiple 1', () => {
    expect(WATCHLIST['social-automation.yml']).toEqual([SOCIAL_MAX_HOURS, 1]);
  });
  it('a successful run six days ago is fresh; nine days ago is stale', () => {
    const base = Object.fromEntries(Object.keys(WATCHLIST).map((f) => [f, ago(0.1)]));
    const fresh = evaluateFreshness({ ...base, 'social-automation.yml': ago(6) }, NOW);
    expect(fresh.stale.map((s) => s.file)).not.toContain('social-automation.yml');
    const stale = evaluateFreshness({ ...base, 'social-automation.yml': ago(9) }, NOW);
    expect(stale.stale.map((s) => s.file)).toContain('social-automation.yml');
  });
  it('other watched workflows are unchanged by this rule', () => {
    expect(WATCHLIST['health-check.yml']).toEqual([24, 2]);
    expect(WATCHLIST['scrape-prices.yml']).toEqual([26, 1]);
  });
});
