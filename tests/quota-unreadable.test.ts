import { describe, it, expect } from 'vitest';
import { mayReadNonEssential } from '../scripts/lib/quota-guard.mjs';
import {
  resolveEgress, takeUnreadableNotice, istDay, istClock, noVideoTodayNotice, isVideoGeneration, LAST_KNOWN_MAX_HOURS,
} from '../scripts/lib/quota-unreadable.mjs';

// Fixed clock: 17 Nov 2026 10:00 IST (04:30 UTC).
const NOW = new Date('2026-11-17T04:30:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600e3).toISOString();

describe('readable egress', () => {
  it('a low reading is used live and remembered', () => {
    const r = resolveEgress(1.2, {}, NOW);
    expect([r.source, r.egressProjectedGb, r.liveUnreadable]).toEqual(['live', 1.2, false]);
    expect(r.nextState.lastEgress).toEqual({ gb: 1.2, at: NOW.toISOString() });
    expect(mayReadNonEssential({ egressProjectedGb: r.egressProjectedGb })).toMatchObject({ allowed: true, level: 'ok' });
  });

  it('a high reading (4.2 GB) is used live and still blocks', () => {
    const r = resolveEgress(4.2, {}, NOW);
    expect([r.source, r.egressProjectedGb]).toEqual(['live', 4.2]);
    expect(mayReadNonEssential({ egressProjectedGb: r.egressProjectedGb })).toMatchObject({ allowed: false, reason: 'egress-block' });
  });
});

describe('unreadable egress', () => {
  it('with a last figure 10 hours old (1.5 GB) it uses that figure and proceeds', () => {
    const state = { lastEgress: { gb: 1.5, at: hoursAgo(10) } };
    const r = resolveEgress(null, state, NOW);
    expect([r.source, r.egressProjectedGb]).toEqual(['last-known', 1.5]);
    expect(r.ageHours).toBeCloseTo(10, 5);
    expect(mayReadNonEssential({ egressProjectedGb: r.egressProjectedGb })).toMatchObject({ allowed: true });
  });

  it('with a last figure 10 hours old that is over the block line (4.3 GB) it still blocks', () => {
    const state = { lastEgress: { gb: 4.3, at: hoursAgo(10) } };
    const r = resolveEgress(null, state, NOW);
    expect(mayReadNonEssential({ egressProjectedGb: r.egressProjectedGb })).toMatchObject({ allowed: false, reason: 'egress-block' });
  });

  it('with no last figure it fails closed, as before', () => {
    const r = resolveEgress(null, {}, NOW);
    expect([r.source, r.egressProjectedGb, r.liveUnreadable]).toEqual(['none', null, true]);
    expect(mayReadNonEssential({ egressProjectedGb: r.egressProjectedGb })).toMatchObject({ allowed: false, reason: 'usage-unreadable' });
  });

  it('a last figure 25 hours old is not used: fail closed', () => {
    const state = { lastEgress: { gb: 1.5, at: hoursAgo(25) } };
    const r = resolveEgress(null, state, NOW);
    expect(r.source).toBe('none');
    expect(mayReadNonEssential({ egressProjectedGb: r.egressProjectedGb })).toMatchObject({ allowed: false });
  });

  it('the 24-hour line is exclusive: a figure exactly 24 hours old is not used', () => {
    const state = { lastEgress: { gb: 1.5, at: hoursAgo(LAST_KNOWN_MAX_HOURS) } };
    expect(resolveEgress(null, state, NOW).source).toBe('none');
  });

  it('records when the figure first became unreadable and keeps that time while it stays unreadable', () => {
    const first = resolveEgress(null, {}, NOW);
    const later = resolveEgress(null, first.nextState, new Date(NOW.getTime() + 3600e3));
    expect(later.sinceIso).toBe(NOW.toISOString());
  });
});

describe('usage-unreadable notice: at most once a day (IST)', () => {
  it('the first call sends; a second call the same IST day does not', () => {
    const a = takeUnreadableNotice({}, NOW);
    expect(a.send).toBe(true);
    const b = takeUnreadableNotice(a.nextState, new Date(NOW.getTime() + 2 * 3600e3));
    expect(b.send).toBe(false);
  });

  it('the next IST day sends again (boundary at 18:30 UTC = 00:00 IST)', () => {
    const before = new Date('2026-11-17T18:29:00Z'); // 23:59 IST on 17 Nov
    const after = new Date('2026-11-17T18:31:00Z');  // 00:01 IST on 18 Nov
    expect(istDay(before)).toBe('2026-11-17');
    expect(istDay(after)).toBe('2026-11-18');
    const a = takeUnreadableNotice({}, before);
    expect(takeUnreadableNotice(a.nextState, after).send).toBe(true);
  });

  it('the clock text is in IST', () => {
    expect(istClock(NOW)).toBe('17 Nov 2026 10:00 IST');
  });
});

describe('blocked video generation says there is no video today, with the reason', () => {
  it('names the slot label, the reason and the owner action', () => {
    expect(isVideoGeneration('video-generate-daily')).toBe(true);
    expect(isVideoGeneration('brief')).toBe(false);
    const n = noVideoTodayNotice({ job: 'video-generate-daily', now: NOW, reasonLines: 'read: CLOSED (critical) egress usage could not be read' });
    expect(n.subject).toContain('VID-P4 no video today');
    expect(n.body).toContain('Reason: read: CLOSED (critical) egress usage could not be read');
    expect(n.body).toContain('Owner action:');
    expect(n.body).toContain('10:00 IST');
  });

  it('the Quiet Panic job gets its own label', () => {
    const n = noVideoTodayNotice({ job: 'video-generate-quiet-panic', now: NOW, reasonLines: 'x' });
    expect(n.subject).toContain('Quiet Panic no video today');
  });
});
