// Privacy notice and terms (order 0050, draft PR 653 rebuild): the new copy is shown only behind accountsEnabled,
// the approved copy in legal-copy.ts is untouched, and the new copy is marked not approved.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as approved from '../src/lib/legal-copy';
import { PRIVACY_SECTIONS, TERMS_SECTIONS } from '../src/lib/legal-notices-copy';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

describe('approved legal copy is untouched', () => {
  it('still exports the approved age rule, deletion copy and helpers', () => {
    expect(approved.AGE_RULE_COPY.heading).toBe('Accounts are for grown-ups (18+)');
    expect(approved.DELETION_COPY.heading).toBe('Delete your BOI account');
    expect(typeof approved.placeholdersIn).toBe('function');
    expect(typeof (approved as Record<string, unknown>).publishBlockers).toBe('function');
  });
});

describe('new notices are behind the accounts flag', () => {
  it('the privacy and terms pages return the notice only when accountsEnabled is true', () => {
    expect(read('src/app/legal/privacy/page.tsx')).toMatch(/if \(FEATURE_FLAGS\.accountsEnabled\) return <PrivacyNotice \/>;/);
    expect(read('src/app/legal/terms/page.tsx')).toMatch(/if \(FEATURE_FLAGS\.accountsEnabled\) return <TermsNotice \/>;/);
  });
  it('accountsEnabled is false in both mirrors', () => {
    expect(read('src/lib/feature-flags.ts')).toMatch(/accountsEnabled: false,/);
    expect(read('config/feature_flags.py')).toMatch(/"accounts_enabled": False,/);
  });
});

describe('the new copy', () => {
  it('is marked not approved and holds the Mumbai courts sentence (new)', () => {
    expect(read('src/lib/legal-notices-copy.ts')).toMatch(/NOT APPROVED YET/);
    const terms = TERMS_SECTIONS.map((s) => s.text).join(' ');
    expect(terms).toContain('Indian law applies. Courts in Mumbai have jurisdiction.');
  });
  it('has the sections the draft carried', () => {
    expect(PRIVACY_SECTIONS.length).toBe(11);
    expect(TERMS_SECTIONS.length).toBe(10);
  });
});
