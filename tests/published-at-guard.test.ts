import { describe, it, expect } from 'vitest';
import { assertPublishedAtNotFuture, MAX_PUBLISHED_AT_SKEW_MS } from '../src/lib/publish-draft';

const NOW = Date.parse('2026-09-30T06:00:00Z');
const at = (ms: number) => new Date(NOW + ms).toISOString();

describe('#446 publish-draft refuses a future published_at', () => {
  it('accepts now, the past and up to 5 minutes of skew', () => {
    expect(() => assertPublishedAtNotFuture(at(0), NOW)).not.toThrow();
    expect(() => assertPublishedAtNotFuture(at(-86_400_000), NOW)).not.toThrow();
    expect(() => assertPublishedAtNotFuture(at(MAX_PUBLISHED_AT_SKEW_MS), NOW)).not.toThrow();
  });
  it('refuses anything later (same limit as the database trigger)', () => {
    expect(() => assertPublishedAtNotFuture(at(MAX_PUBLISHED_AT_SKEW_MS + 1000), NOW)).toThrow(/in the future/);
    expect(() => assertPublishedAtNotFuture(at(86_400_000), NOW)).toThrow(/#446/);
  });
  it('refuses an unparseable timestamp', () => {
    expect(() => assertPublishedAtNotFuture('not-a-date', NOW)).toThrow(/valid timestamp/);
  });
});
