// Signed admin form fields (B6b): a form field works only for its own action, in its own session.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { adminFormToken, adminFormTokenValid } from '../src/lib/admin-form';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const SESSION_A = 'v2.1893456000.AAAAAAAAAAAAAAAAAAAAAA.sigA';
const SESSION_B = 'v2.1893456000.BBBBBBBBBBBBBBBBBBBBBB.sigB';

function form(value: string) {
  return new Map([['csrf', value]]).get('csrf') as unknown as FormDataEntryValue;
}

describe('admin form fields', () => {
  beforeEach(() => { process.env.ADMIN_PASSWORD = 'correct horse battery staple'; });

  it('the field for an action in this session is accepted', () => {
    const v = adminFormToken(SESSION_A, 'approveDraft');
    expect(v).not.toBe('');
    expect(adminFormTokenValid(form(v), SESSION_A, 'approveDraft')).toBe(true);
  });

  it('the field for one action is refused by another action', () => {
    const v = adminFormToken(SESSION_A, 'approveDraft');
    expect(adminFormTokenValid(form(v), SESSION_A, 'rejectDraft')).toBe(false);
  });

  it('the field from one session is refused in another session', () => {
    const v = adminFormToken(SESSION_A, 'approveDraft');
    expect(adminFormTokenValid(form(v), SESSION_B, 'approveDraft')).toBe(false);
  });

  it('a missing, empty or wrong field is refused', () => {
    expect(adminFormTokenValid(null, SESSION_A, 'approveDraft')).toBe(false);
    expect(adminFormTokenValid(form(''), SESSION_A, 'approveDraft')).toBe(false);
    expect(adminFormTokenValid(form('nope'), SESSION_A, 'approveDraft')).toBe(false);
  });

  it('no session means no field', () => {
    expect(adminFormToken(undefined, 'approveDraft')).toBe('');
    expect(adminFormTokenValid(form('anything'), undefined, 'approveDraft')).toBe(false);
  });

  it('changing the password invalidates every field', () => {
    const v = adminFormToken(SESSION_A, 'approveDraft');
    process.env.ADMIN_PASSWORD = 'a new password';
    expect(adminFormTokenValid(form(v), SESSION_A, 'approveDraft')).toBe(false);
  });
});

describe('every state-changing admin action checks its signed field, and its form renders the field', () => {
  const ACTIONS = {
    'src/app/admin/pending/actions.ts': ['approveDraft', 'rejectDraft', 'approveAll', 'generateArticle', 'publishDraft'],
    'src/app/admin/pending/newsletter/actions.ts': ['approveNewsletterDraft', 'dismissNewsletterDraft'],
  };
  for (const [file, names] of Object.entries(ACTIONS)) {
    for (const name of names) {
      it(`${name} requires its field`, () => {
        expect(read(file)).toMatch(new RegExp(`export async function ${name}\\(formData: FormData\\) \\{[\\s\\S]*?requireAdminForm\\(formData, '${name}'\\)`));
      });
    }
  }
  const FORMS = {
    'src/app/admin/pending/page.tsx': ['approveDraft', 'rejectDraft', 'generateArticle', 'publishDraft', 'approveAll'],
    'src/app/admin/pending/newsletter/page.tsx': ['approveNewsletterDraft', 'dismissNewsletterDraft'],
  };
  for (const [file, names] of Object.entries(FORMS)) {
    for (const name of names) {
      it(`the form for ${name} in ${file} renders its field`, () => {
        expect(read(file)).toMatch(new RegExp(`<form action=\\{${name}\\}[^>]*>\\s*<CsrfField action="${name}" />`));
      });
    }
  }
});
