// The issue 796 rehearsal script refuses everything except staging, and prints no code, hash, address or key.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { guardTarget } from '../scripts/rehearsal/signin-parallel-guesses';

const root = join(__dirname, '..');
const src = readFileSync(join(root, 'scripts/rehearsal/signin-parallel-guesses.ts'), 'utf8');
const PROD = 'abcdefghijklmnopqrst';

describe('rehearsal guard', () => {
  it('runs against a staging address when the target is staging', () => {
    expect(guardTarget({ REHEARSAL_TARGET: 'staging', NEXT_PUBLIC_SUPABASE_URL: 'https://stagingref12345678901.supabase.co' }, PROD).ok).toBe(true);
  });
  it('refuses when the target is not staging, including when it is unset', () => {
    expect(guardTarget({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' }, PROD).ok).toBe(false);
    expect(guardTarget({ REHEARSAL_TARGET: 'production', NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' }, PROD).ok).toBe(false);
  });
  it('refuses a production address even if the target says staging', () => {
    const r = guardTarget({ REHEARSAL_TARGET: 'staging', NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co` }, PROD);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/production project/);
  });
  it('refuses when no address is given', () => {
    expect(guardTarget({ REHEARSAL_TARGET: 'staging' }, PROD).ok).toBe(false);
  });
});

describe('rehearsal output', () => {
  it('prints results only: the script never logs a code, hash, address or key value', () => {
    const logs = src.split('\n').filter((l) => /console\.(log|error)/.test(l));
    expect(logs.length).toBeGreaterThan(0);
    for (const l of logs) expect(l).not.toMatch(/\b(code|hash|email|key)\b/i);
  });
  it('deletes its own rows at the end, whatever happened', () => {
    expect(src).toMatch(/finally \{[\s\S]*delete\(\)\.eq\('email_hash', eh\)/);
  });
});
