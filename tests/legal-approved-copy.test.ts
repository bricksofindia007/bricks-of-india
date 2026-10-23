// Approved age-rule and deletion wording (owner approval 23 Oct 2026, 09:29 IST). Exact text (R1). The test fails if a page's
// bracketed text is still present while its flag is on.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AGE_RULE_COPY, DELETION_COPY, placeholdersIn, publishBlockers } from '../src/lib/legal-copy';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';

const root = join(__dirname, '..');

describe('approved wording is exact', () => {
  it('age rule heading, body and sign-up checkbox', () => {
    expect(AGE_RULE_COPY.heading).toBe('Accounts are for grown-ups (18+)');
    expect(AGE_RULE_COPY.body).toBe('LEGO is for everyone. Collecting your sets and wishes in an account is for people aged 18 and over, because India’s data protection rules treat under-18s’ information very carefully. Under 18? You still get everything that matters: every price, every comparison, every review, no account needed. Your wallet and your parents will both thank you.');
    expect(AGE_RULE_COPY.signUpCheckbox).toBe('I’m 18 or older.');
  });
  it('deletion heading and body', () => {
    expect(DELETION_COPY.heading).toBe('Delete your BOI account');
    expect(DELETION_COPY.body).toBe('Changed your mind? No hard feelings, and no guilt trips. We keep it quick. What gets deleted: your account, your Collection, your Wishlist, your price alerts, and your email address from our sign-in records. How: sign in, open My BOI, choose Delete my account, and confirm with the code we email you. Done within 30 days. Can’t sign in? To delete your account or data, use our contact page and choose ‘Privacy request’. Backups: our encrypted backups are overwritten on their normal schedule, so a copy can sit in an old backup for up to within 13 months before it disappears. Newsletter only? The unsubscribe link in any email takes you off the list straight away.');
  });
  it('no bracketed field is left: all three gaps are filled (18 and 23 Oct approvals)', () => {
    expect(placeholdersIn(DELETION_COPY.body)).toEqual([]);
    expect(placeholdersIn(AGE_RULE_COPY.body)).toEqual([]);
    expect(placeholdersIn(AGE_RULE_COPY.heading)).toEqual([]);
  });
  it('no email address appears in the public text', () => {
    for (const t of [AGE_RULE_COPY.heading, AGE_RULE_COPY.body, AGE_RULE_COPY.signUpCheckbox, DELETION_COPY.heading, DELETION_COPY.body]) {
      expect(t).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    }
  });
});

describe('flags and publishing', () => {
  it('both flags are off', () => {
    expect(FEATURE_FLAGS.ageRulePage).toBe(false);
    expect(FEATURE_FLAGS.dataDeletionPage).toBe(false);
  });
  it('a page with its flag off has no blockers', () => {
    expect(publishBlockers([...Object.values(DELETION_COPY)], false)).toEqual([]);
  });
  it('the test fails if bracketed text is present while the flag is on', () => {
    expect(publishBlockers(['Done within [TIMELINE TO CONFIRM] days.'], true)).toEqual(['[TIMELINE TO CONFIRM]']);
  });
  it('the deletion page has no blockers with its flag on now that the gaps are filled', () => {
    expect(publishBlockers([DELETION_COPY.heading, DELETION_COPY.body], true)).toEqual([]);
  });
  it('the age rule page has no blockers even with its flag on', () => {
    expect(publishBlockers([AGE_RULE_COPY.heading, AGE_RULE_COPY.body, AGE_RULE_COPY.signUpCheckbox], true)).toEqual([]);
  });
  it('the deletion page must not be switched on while its brackets remain (current state: flag off, so this passes)', () => {
    const blockers = publishBlockers([DELETION_COPY.heading, DELETION_COPY.body], FEATURE_FLAGS.dataDeletionPage);
    expect(blockers).toEqual([]);
  });
  it('the age rule page must not be switched on while it has brackets (current state: flag off, so this passes)', () => {
    const blockers = publishBlockers([AGE_RULE_COPY.heading, AGE_RULE_COPY.body], FEATURE_FLAGS.ageRulePage);
    expect(blockers).toEqual([]);
  });
});

describe('pages render the approved text', () => {
  it('each page renders its copy module, and its flag check is still first', () => {
    const age = readFileSync(join(root, 'src/app/legal/age-rule/page.tsx'), 'utf8');
    const del = readFileSync(join(root, 'src/app/legal/data-deletion/page.tsx'), 'utf8');
    expect(age).toContain('AGE_RULE_COPY.heading');
    expect(age).toContain('AGE_RULE_COPY.body');
    expect(age).toMatch(/if \(!FEATURE_FLAGS\.ageRulePage\) notFound\(\)/);
    expect(del).toContain('DELETION_COPY.heading');
    expect(del).toContain('DELETION_COPY.body');
    expect(del).toMatch(/if \(!FEATURE_FLAGS\.dataDeletionPage\) notFound\(\)/);
  });
  it('no placeholder copy is left in the pages', () => {
    for (const p of ['src/app/legal/age-rule/page.tsx', 'src/app/legal/data-deletion/page.tsx']) {
      const src = readFileSync(join(root, p), 'utf8');
      expect(src).not.toContain('Copy pending');
      expect(src).not.toContain('not built');
    }
  });
});
