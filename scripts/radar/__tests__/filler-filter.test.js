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

  it('blocks "Random minifigure of the day"', () => {
    expect(isFillerPattern('Random minifigure of the day')).toBe(true);
  });

  it('blocks "Random build of the week"', () => {
    expect(isFillerPattern('Random build of the week')).toBe(true);
  });

  it('blocks "Random theme of the day"', () => {
    expect(isFillerPattern('Random theme of the day')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isFillerPattern('RANDOM FIGURE OF THE DAY')).toBe(true);
    expect(isFillerPattern('random set of the week')).toBe(true);
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

  // Regression anchor: real LEGO set name 76342. Must NOT match filler filter.
  // This test exists to prevent a regression where the regex broadens (e.g. re-adding
  // \bdaily\s which would incorrectly flag this set title as filler content).
  it('passes "The LEGO Daily Bugle (76342)" — real set name, must never be filtered', () => {
    expect(isFillerPattern('The LEGO Daily Bugle (76342)')).toBe(false);
  });

  it('passes "Random build spotlight" — has "random" but not "of the day/week"', () => {
    expect(isFillerPattern('Random build spotlight')).toBe(false);
  });

  it('passes "Set of the Day: 10332" — does not start with "Random <type>"', () => {
    expect(isFillerPattern('Set of the Day: 10332')).toBe(false);
  });

  it('passes "Figure of the Day — frnd0701" — does not start with "Random <type>"', () => {
    expect(isFillerPattern('Figure of the Day — frnd0701')).toBe(false);
  });

  it('passes "LEGO picks random charities to support in 2026" — "random" mid-sentence', () => {
    expect(isFillerPattern('LEGO picks random charities to support in 2026')).toBe(false);
  });

  it('passes null/undefined/empty without throwing', () => {
    expect(isFillerPattern(null)).toBe(false);
    expect(isFillerPattern(undefined)).toBe(false);
    expect(isFillerPattern('')).toBe(false);
  });
});
