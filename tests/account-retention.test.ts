// Inactive-account dates: warning at 23 months, deletion at 24 months, calendar months in UTC with day clamping.
import { describe, it, expect } from 'vitest';
import { monthsBefore, inactiveFor, warningDue, deletionDue } from '../src/lib/account-retention';

const utc = (s: string) => new Date(s);

describe('monthsBefore', () => {
  it('goes back whole calendar months', () => {
    expect(monthsBefore(utc('2026-10-25T10:00:00Z'), 23).toISOString()).toBe('2024-11-25T10:00:00.000Z');
    expect(monthsBefore(utc('2026-10-25T10:00:00Z'), 24).toISOString()).toBe('2024-10-25T10:00:00.000Z');
  });
  it('clamps the day to the end of a shorter month', () => {
    expect(monthsBefore(utc('2026-03-31T00:00:00Z'), 1).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(monthsBefore(utc('2028-02-29T00:00:00Z'), 24).toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });
  it('crosses a year boundary', () => {
    expect(monthsBefore(utc('2026-02-10T00:00:00Z'), 3).toISOString()).toBe('2025-11-10T00:00:00.000Z');
  });
});

describe('warningDue and deletionDue', () => {
  const now = utc('2026-10-25T00:00:00Z');

  it('no warning and no deletion inside 23 months', () => {
    const active = utc('2024-11-26T00:00:00Z'); // 22 months 30 days
    expect(warningDue(active, now)).toBe(false);
    expect(deletionDue(active, now)).toBe(false);
  });
  it('warning from 23 months', () => {
    const lastActive = utc('2024-11-25T00:00:00Z'); // exactly 23 months
    expect(warningDue(lastActive, now)).toBe(true);
    expect(deletionDue(lastActive, now)).toBe(false);
  });
  it('deletion from 24 months, and the warning is no longer the step', () => {
    const lastActive = utc('2024-10-25T00:00:00Z'); // exactly 24 months
    expect(deletionDue(lastActive, now)).toBe(true);
    expect(warningDue(lastActive, now)).toBe(false);
  });
  it('inactiveFor compares whole months', () => {
    expect(inactiveFor(utc('2024-10-24T23:59:59Z'), now, 24)).toBe(true);
    expect(inactiveFor(utc('2024-10-26T00:00:00Z'), now, 24)).toBe(false);
  });
});
