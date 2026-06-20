import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// filler-patterns.js is CommonJS; use createRequire to import it from ESM vitest context
const require = createRequire(import.meta.url);
const { isFillerPattern } = require('../filler-patterns.js');

// ── Should block ──────────────────────────────────────────────────────────────

describe('isFillerPattern — should block', () => {
  it('blocks "Random figure of the day: frnd0869" (the exact smoke-test case)', () => {
    expect(isFillerPattern('Random figure of the day: frnd0869')).toBe(true);
  });

  it('blocks "Random set of the day"', () => {
    expect(isFillerPattern('Random set of the day')).toBe(true);
  });

  it('blocks "Set of the Day: 10332"', () => {
    expect(isFillerPattern('Set of the Day: 10332')).toBe(true);
  });

  it('blocks "Figure of the Day — frnd0701"', () => {
    expect(isFillerPattern('Figure of the Day — frnd0701')).toBe(true);
  });

  it('blocks "Figure-of-the-Day post" (hyphen variant)', () => {
    expect(isFillerPattern('Figure-of-the-Day post')).toBe(true);
  });

  it('blocks titles starting with "Random " (any suffix)', () => {
    expect(isFillerPattern('Random build spotlight')).toBe(true);
    expect(isFillerPattern('Random mosaic from the community')).toBe(true);
  });

  it('blocks "Daily LEGO deals roundup"', () => {
    expect(isFillerPattern('Daily LEGO deals roundup')).toBe(true);
  });

  it('blocks "daily " anywhere in title (intentionally broad, same logic as COMMUNITY_RE for weekly)', () => {
    expect(isFillerPattern('Brickset daily picks')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isFillerPattern('RANDOM Figure Of The Day')).toBe(true);
    expect(isFillerPattern('random build')).toBe(true);
    expect(isFillerPattern('SET OF THE DAY')).toBe(true);
  });
});

// ── Should pass through ───────────────────────────────────────────────────────

describe('isFillerPattern — should pass through', () => {
  it('passes "LEGO Icons Bonsai Tree (10281) now shipping"', () => {
    expect(isFillerPattern('LEGO Icons Bonsai Tree (10281) now shipping')).toBe(false);
  });

  it('passes "Brickset review: 42151 Bugatti Bolide"', () => {
    expect(isFillerPattern('Brickset review: 42151 Bugatti Bolide')).toBe(false);
  });

  it('passes "Today\'s best LEGO deals" (today ≠ daily )', () => {
    expect(isFillerPattern("Today's best LEGO deals")).toBe(false);
  });

  it('passes titles containing "random" mid-sentence', () => {
    expect(isFillerPattern('LEGO picks random charities to support in 2026')).toBe(false);
  });

  it('passes null/undefined without throwing', () => {
    expect(isFillerPattern(null)).toBe(false);
    expect(isFillerPattern(undefined)).toBe(false);
    expect(isFillerPattern('')).toBe(false);
  });
});
