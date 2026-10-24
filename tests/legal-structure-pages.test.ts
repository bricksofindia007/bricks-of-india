// Queue item 4: the deletion and age-rule pages are structure only, off by default, and not indexed.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';

const root = join(__dirname, '..');
const pages = ['src/app/legal/data-deletion/page.tsx', 'src/app/legal/age-rule/page.tsx'];

describe('legal structure pages', () => {
  it('are off by default in both flag files', () => {
    expect(FEATURE_FLAGS.dataDeletionPage).toBe(false);
    expect(FEATURE_FLAGS.ageRulePage).toBe(false);
    const py = readFileSync(join(root, 'config/feature_flags.py'), 'utf8');
    expect(py).toMatch(/"data_deletion_page": False/);
    expect(py).toMatch(/"age_rule_page": False/);
  });
  for (const p of pages) {
    it(`${p} returns 404 when its flag is off and is not indexed`, () => {
      const src = readFileSync(join(root, p), 'utf8');
      expect(src).toMatch(/if \(!FEATURE_FLAGS\.\w+\) notFound\(\)/);
      expect(src).toMatch(/index: false/);
    });
    it(`${p} renders its approved text from the copy module`, () => {
      const src = readFileSync(join(root, p), 'utf8');
      expect(src).toMatch(/from '@\/lib\/legal-copy'/);
      expect(src).not.toMatch(/\[Copy pending/);
    });
  }
});
