import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// auto-approve-policy.js is CommonJS; use createRequire to import it from ESM vitest context
const require = createRequire(import.meta.url);
const { isAutoApproveTier, AUTO_APPROVE_TIERS } = require('../auto-approve-policy.js');

// 2026-06-29, Abhinav, explicit policy: "I want a system that automates it...
// do not auto select reddit or youtube videos." Tier 1/2 (editorial +
// official/catalogue sources) skip manual signal approval; Tier 3 (Reddit),
// Tier 4 (YouTube), Tier 5 (topic-only) are explicitly unchanged.
//
// This module was extracted specifically because an earlier inline version
// of this check had a real bug caught during review: a ternary used the
// function reference (always truthy) instead of calling it, which would have
// auto-approved every tier, not just 1/2. These tests exist to make that
// exact class of regression structurally impossible to ship unnoticed again.

describe('isAutoApproveTier — Tier 1/2 (editorial + official) auto-approve', () => {
  it('returns true for Tier 1 (editorial outlets: Brothers Brick, Jay\'s Brick Blog, New Elementary, BrickNerd)', () => {
    expect(isAutoApproveTier(1)).toBe(true);
  });

  it('returns true for Tier 2 (official/catalogue: Brickset, Rebrickable, LEGO.com)', () => {
    expect(isAutoApproveTier(2)).toBe(true);
  });
});

describe('isAutoApproveTier — Tier 3/4/5 require manual approval, explicitly unchanged', () => {
  it('returns false for Tier 3 (r/lego) — Abhinav: "do not auto select reddit"', () => {
    expect(isAutoApproveTier(3)).toBe(false);
  });

  it('returns false for Tier 4 (YouTube channels) — Abhinav: "do not auto select... youtube videos"', () => {
    expect(isAutoApproveTier(4)).toBe(false);
  });

  it('returns false for Tier 5 (topic-only outlets)', () => {
    expect(isAutoApproveTier(5)).toBe(false);
  });
});

describe('isAutoApproveTier — edge cases', () => {
  it('returns false for an unrecognized tier number (fail closed, not open)', () => {
    expect(isAutoApproveTier(6)).toBe(false);
    expect(isAutoApproveTier(0)).toBe(false);
    expect(isAutoApproveTier(-1)).toBe(false);
  });

  it('returns false for undefined/null/non-numeric input (fail closed)', () => {
    expect(isAutoApproveTier(undefined)).toBe(false);
    expect(isAutoApproveTier(null)).toBe(false);
    expect(isAutoApproveTier('1')).toBe(false); // string '1' !== number 1 — Set.has() is strict
  });

  it('exposes exactly {1, 2} as the auto-approve tier set — guards against silent scope creep', () => {
    expect(Array.from(AUTO_APPROVE_TIERS).sort()).toEqual([1, 2]);
  });
});
