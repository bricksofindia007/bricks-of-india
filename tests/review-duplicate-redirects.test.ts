// Queue item 14: the prepared duplicate-review options are well formed; the review-policy route is off by default.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OPTION_A, OPTION_B, redirectRules } from '../src/lib/review-duplicate-redirects';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';

const root = join(__dirname, '..');

describe('duplicate review options', () => {
  it('each option keeps exactly one review per pair and redirects the other', () => {
    for (const opt of [OPTION_A, OPTION_B]) {
      for (const p of opt) expect(p.keep).not.toBe(p.redirect);
    }
  });
  it('option B is the mirror of option A', () => {
    OPTION_A.forEach((p, i) => {
      expect(OPTION_B[i].keep).toBe(p.redirect);
      expect(OPTION_B[i].redirect).toBe(p.keep);
    });
  });
  it('rules are permanent and point under /reviews', () => {
    for (const r of redirectRules(OPTION_A)) {
      expect(r.source.startsWith('/reviews/')).toBe(true);
      expect(r.destination.startsWith('/reviews/')).toBe(true);
      expect(r.permanent).toBe(true);
    }
  });
  it('nothing imports the redirect module yet', () => {
    const next = readFileSync(join(root, 'next.config.mjs'), 'utf8');
    expect(next).not.toMatch(/review-duplicate-redirects/);
  });
});

describe('review policy page', () => {
  it('is off by default in both flag files', () => {
    expect(FEATURE_FLAGS.reviewPolicyPage).toBe(false);
    const py = readFileSync(join(root, 'config/feature_flags.py'), 'utf8');
    expect(py).toMatch(/"review_policy_page": False/);
  });
  it('is not indexed while it is a placeholder', () => {
    const src = readFileSync(join(root, 'src/app/review-policy/page.tsx'), 'utf8');
    expect(src).toMatch(/index: false/);
  });
});
