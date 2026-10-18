// Sign-in attempt limit: 10 failures in 10 minutes blocks for 10 minutes. Covers the counting rules, the block,
// the fail-closed read, hashed keys, and the order of checks in the login action.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fake = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>>, readError: false }));
vi.mock('../src/lib/supabase', () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({
        in: async () => (fake.readError ? { data: null, error: { message: 'down' } } : { data: fake.rows, error: null }),
      }),
    }),
  }),
}));

import { afterFailure, isBlocked, limitKey, loginBlocked, LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS, LOGIN_BLOCK_MS } from '../src/lib/login-limit';

const T0 = Date.parse('2026-10-18T07:00:00Z');
const root = join(__dirname, '..');

beforeEach(() => {
  fake.rows = [];
  fake.readError = false;
});

describe('counting', () => {
  it('limits are 10 failures, a 10-minute window and a 10-minute block', () => {
    expect(LOGIN_MAX_FAILURES).toBe(10);
    expect(LOGIN_WINDOW_MS).toBe(10 * 60 * 1000);
    expect(LOGIN_BLOCK_MS).toBe(10 * 60 * 1000);
  });
  it('nine failures do not block; the tenth does', () => {
    let row = null as ReturnType<typeof afterFailure> | null;
    for (let i = 0; i < 9; i++) row = afterFailure(row, T0 + i * 1000);
    expect(row!.failures).toBe(9);
    expect(isBlocked(row, T0 + 9000)).toBe(false);
    row = afterFailure(row, T0 + 9000);
    expect(row!.failures).toBe(10);
    expect(row!.blocked_until).toBe(T0 + 9000 + LOGIN_BLOCK_MS);
    expect(isBlocked(row, T0 + 9001)).toBe(true);
  });
  it('the block ends after 10 minutes', () => {
    const blocked = { failures: 10, window_start: T0, blocked_until: T0 + LOGIN_BLOCK_MS };
    expect(isBlocked(blocked, T0 + LOGIN_BLOCK_MS - 1)).toBe(true);
    expect(isBlocked(blocked, T0 + LOGIN_BLOCK_MS)).toBe(false);
  });
  it('failures spread over more than 10 minutes start a new window and do not block', () => {
    let row = null as ReturnType<typeof afterFailure> | null;
    for (let i = 0; i < 9; i++) row = afterFailure(row, T0 + i * 1000);
    // The window opened at T0 has run out; this one is the first failure of a new window.
    row = afterFailure(row, T0 + LOGIN_WINDOW_MS);
    expect(row).toEqual({ failures: 1, window_start: T0 + LOGIN_WINDOW_MS, blocked_until: null });
  });
  it('no earlier row means the first failure', () => {
    expect(afterFailure(null, T0)).toEqual({ failures: 1, window_start: T0, blocked_until: null });
  });
});

describe('keys', () => {
  it('a key is stable for the same client, and does not contain the address', () => {
    const k = limitKey('ip', '203.0.113.9');
    expect(k).toBe(limitKey('ip', '203.0.113.9'));
    expect(k).not.toContain('203.0.113.9');
    expect(k).toMatch(/^[0-9a-f]{64}$/);
  });
  it('an address key and an account key differ', () => {
    expect(limitKey('ip', 'admin')).not.toBe(limitKey('account', 'admin'));
  });
});

describe('the blocked check', () => {
  it('no row: not blocked', async () => {
    expect(await loginBlocked([limitKey('ip', '1.2.3.4')], T0)).toBe(false);
  });
  it('a row in its block: blocked', async () => {
    fake.rows = [{ key: 'k', window_start: new Date(T0).toISOString(), failures: 10, blocked_until: new Date(T0 + LOGIN_BLOCK_MS).toISOString() }];
    expect(await loginBlocked(['k'], T0 + 1000)).toBe(true);
  });
  it('a row whose block has ended: not blocked', async () => {
    fake.rows = [{ key: 'k', window_start: new Date(T0).toISOString(), failures: 10, blocked_until: new Date(T0 + LOGIN_BLOCK_MS).toISOString() }];
    expect(await loginBlocked(['k'], T0 + LOGIN_BLOCK_MS + 1)).toBe(false);
  });
  it('fails closed when the counter cannot be read', async () => {
    fake.readError = true;
    expect(await loginBlocked(['k'], T0)).toBe(true);
  });
});

describe('the login action and the migration', () => {
  const action = readFileSync(join(root, 'src/app/admin/pending/actions.ts'), 'utf8');
  const sql = readFileSync(join(root, 'supabase/migrations/20261018140000_login_attempts.sql'), 'utf8');
  it('the blocked check runs before the password is compared', () => {
    const blocked = action.indexOf('if (await loginBlocked(keys)) redirect');
    const compare = action.indexOf('if (adminPasswordMatches(pw))');
    expect(blocked).toBeGreaterThan(0);
    expect(compare).toBeGreaterThan(blocked);
  });
  it('a blocked attempt redirects as a wrong password does; no cookie is set', () => {
    const body = action.slice(action.indexOf('export async function login'), action.indexOf('export async function logout'));
    expect(body).toMatch(/if \(await loginBlocked\(keys\)\) redirect\('\/admin\/pending'\);/);
    expect(body).not.toMatch(/block(ed)?.*error|too many/i);
  });
  it('row security on, no policies, anon and authenticated revoked, server role only', () => {
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).toMatch(/REVOKE ALL ON public\.login_attempts FROM PUBLIC, anon, authenticated;/);
    expect(sql).not.toMatch(/TO (anon|authenticated|PUBLIC)\b/i);
  });
});
