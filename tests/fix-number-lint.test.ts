// Fix numbering (order 1130, addendum 23:31 item I): the issue number is the identity; no new number may be shared.
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fixNumber, newDuplicateFixNumbers, LEGACY_SHARED_NUMBERS } from '../scripts/ci/fix-number-lint.mjs';

const root = join(__dirname, '..');

describe('fixNumber', () => {
  it('reads the number before the first dash', () => {
    expect(fixNumber('798-review-price-pointer-seven.sql')).toBe('798');
    expect(fixNumber('README.md')).toBeNull();
  });
});

describe('newDuplicateFixNumbers', () => {
  it('passes when every number is used once', () => {
    expect(newDuplicateFixNumbers(['798-a.sql', '799-b.sql'])).toEqual([]);
  });
  it('fails a number that a second file uses, unless it is on the legacy list', () => {
    expect(newDuplicateFixNumbers(['900-a.sql', '900-b.sql'])).toEqual(['900']);
    expect(newDuplicateFixNumbers(['471-a.sql', '471-b.sql'])).toEqual([]);
  });
  it('reports only the new duplicates when both kinds are present', () => {
    expect(newDuplicateFixNumbers(['471-x.sql', '471-y.sql', '901-a.sql', '901-b.sql'])).toEqual(['901']);
  });
  it('ignores names with no number', () => {
    expect(newDuplicateFixNumbers(['README.md', 'README.md.bak', '798-a.sql'])).toEqual([]);
  });
});

describe('the repo today', () => {
  const names = readdirSync(join(root, 'supabase/data-fixes')).filter((f) => f.endsWith('.sql'));
  it('has no number shared outside the legacy list', () => {
    expect(newDuplicateFixNumbers(names)).toEqual([]);
  });
  it('the legacy list only names numbers that are really shared (no stale entries)', () => {
    for (const num of LEGACY_SHARED_NUMBERS) {
      expect(names.filter((n) => fixNumber(n) === num).length).toBeGreaterThan(1);
    }
  });
});
