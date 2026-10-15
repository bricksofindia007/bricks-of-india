import { describe, it, expect } from 'vitest';
import { IG_HEARTBEAT_WINDOW_HOURS, isPastWindow } from '../scripts/lib/heartbeat-window.mjs';

const DAY = 24;

describe('Instagram heartbeat window', () => {
  it('is 8 days', () => {
    expect(IG_HEARTBEAT_WINDOW_HOURS).toBe(8 * DAY);
  });

  it('does not alert on a 3-day gap', () => {
    expect(isPastWindow(3 * DAY)).toBe(false);
  });

  it('alerts on a 9-day gap', () => {
    expect(isPastWindow(9 * DAY)).toBe(true);
  });

  it('does not alert exactly at 8 days', () => {
    expect(isPastWindow(8 * DAY)).toBe(false);
  });

  it('alerts just past 8 days', () => {
    expect(isPastWindow(8 * DAY + 0.1)).toBe(true);
  });
});
