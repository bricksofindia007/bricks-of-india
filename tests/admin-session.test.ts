// Admin sessions (B6a): the cookie holds a random token, only its hash is stored, expiry and revocation are
// enforced on the server, a forged or malformed token is refused, and a failed read fails closed.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// In-memory stand-in for public.admin_sessions. The mock is hoisted, so the state lives on the mocked module.
vi.mock('../src/lib/supabase', () => {
  const state = { rows: new Map<string, { token_hash: string; expires_at: string; revoked: boolean }>(), fail: null as null | 'insert' | 'select' | 'update', selects: 0 };
  const table = () => ({
    insert(row: { token_hash: string; expires_at: string }) {
      if (state.fail === 'insert') return Promise.resolve({ error: { message: 'down' } });
      state.rows.set(row.token_hash, { ...row, revoked: false });
      return Promise.resolve({ error: null });
    },
    select() {
      return {
        eq(_col: string, hash: string) {
          return {
            maybeSingle() {
              state.selects++;
              if (state.fail === 'select') return Promise.resolve({ data: null, error: { message: 'down' } });
              const r = state.rows.get(hash);
              return Promise.resolve({ data: r ? { revoked: r.revoked, expires_at: r.expires_at } : null, error: null });
            },
          };
        },
      };
    },
    update(patch: { revoked: boolean }) {
      return {
        eq(col: string, value: string | boolean) {
          if (state.fail === 'update') return Promise.resolve({ error: { message: 'down' } });
          if (col === 'revoked') {
            for (const r of state.rows.values()) if (!r.revoked) Object.assign(r, patch);
            return Promise.resolve({ error: null });
          }
          const r = state.rows.get(value as string);
          if (r) Object.assign(r, patch);
          return Promise.resolve({ error: null });
        },
      };
    },
  });
  return { createServerClient: () => ({ from: () => table() }), __state: state };
});

import * as sup from '../src/lib/supabase';
import { createAdminSession, isValidAdminSession, revokeAdminSession, revokeAllAdminSessions, hashToken, ADMIN_SESSION_SECONDS } from '../src/lib/admin-session';

const state = (sup as unknown as { __state: { rows: Map<string, unknown>; fail: string | null; selects: number } }).__state;
const PASSWORD = 'correct horse battery staple';
const NOW = Date.parse('2026-10-18T07:00:00Z');
const root = join(__dirname, '..');

beforeEach(() => {
  state.rows.clear();
  state.fail = null;
  state.selects = 0;
  process.env.ADMIN_PASSWORD = PASSWORD;
});

describe('token and storage', () => {
  it('the token is 32 random bytes, base64url (43 characters)', async () => {
    const t = await createAdminSession(NOW);
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it('only the hash of the token is stored, never the token', async () => {
    const t = await createAdminSession(NOW);
    const keys = [...state.rows.keys()];
    expect(keys).toEqual([hashToken(t)]);
    expect(keys).not.toContain(t);
  });
  it('the password never appears in the cookie value', async () => {
    const t = await createAdminSession(NOW);
    expect(t).not.toContain(PASSWORD);
    expect(t.includes(process.env.ADMIN_PASSWORD!)).toBe(false);
  });
  it('two sessions get different tokens', async () => {
    const a = await createAdminSession(NOW);
    const b = await createAdminSession(NOW);
    expect(a).not.toBe(b);
  });
});

describe('validity', () => {
  it('a fresh session is accepted', async () => {
    const t = await createAdminSession(NOW);
    expect(await isValidAdminSession(t, NOW + 1000)).toBe(true);
  });
  it('an expired session is refused (expiry enforced on the server)', async () => {
    const t = await createAdminSession(NOW - (ADMIN_SESSION_SECONDS + 60) * 1000);
    expect(await isValidAdminSession(t, NOW)).toBe(false);
  });
  it('a session is refused at exactly its expiry', async () => {
    const t = await createAdminSession(NOW - ADMIN_SESSION_SECONDS * 1000);
    expect(await isValidAdminSession(t, NOW)).toBe(false);
  });
  it('a revoked session is refused', async () => {
    const t = await createAdminSession(NOW);
    await revokeAdminSession(t);
    expect(await isValidAdminSession(t, NOW + 1000)).toBe(false);
  });
  it('a forged token is refused: a random token of the right shape', async () => {
    await createAdminSession(NOW);
    const forged = 'A'.repeat(43);
    expect(await isValidAdminSession(forged, NOW)).toBe(false);
  });
  it('a password used as a token is refused', async () => {
    await createAdminSession(NOW);
    expect(await isValidAdminSession(PASSWORD, NOW)).toBe(false);
  });
  it('a malformed value is refused without any database read', async () => {
    expect(await isValidAdminSession('v1.123.abc', NOW)).toBe(false);
    expect(await isValidAdminSession('', NOW)).toBe(false);
    expect(await isValidAdminSession(undefined, NOW)).toBe(false);
    expect(state.selects).toBe(0);
  });
  it('fails closed when the read errors', async () => {
    const t = await createAdminSession(NOW);
    state.fail = 'select';
    expect(await isValidAdminSession(t, NOW + 1000)).toBe(false);
  });
});

describe('sign-out and failure', () => {
  it('signing out revokes the session on the server', async () => {
    const t = await createAdminSession(NOW);
    await revokeAdminSession(t);
    expect(state.rows.get(hashToken(t))).toMatchObject({ revoked: true });
  });
  it('revoking a malformed token changes nothing and does not throw', async () => {
    await createAdminSession(NOW);
    await expect(revokeAdminSession('nope')).resolves.toBeUndefined();
    expect([...state.rows.values()].every((r) => (r as { revoked: boolean }).revoked === false)).toBe(true);
  });
  it('sign-in throws when the session cannot be stored (no cookie is issued)', async () => {
    state.fail = 'insert';
    await expect(createAdminSession(NOW)).rejects.toThrow('admin session could not be stored');
  });
});

describe('migration and rollback', () => {
  const sql = readFileSync(join(root, 'supabase/migrations/20261018130000_admin_sessions.sql'), 'utf8');
  const down = readFileSync(join(root, 'supabase/rollbacks/20261018130000_admin_sessions.down.sql'), 'utf8');
  it('row security is on, with no policies', () => {
    expect(sql).toMatch(/ALTER TABLE public\.admin_sessions ENABLE ROW LEVEL SECURITY;/);
    expect(sql).not.toMatch(/CREATE POLICY/i);
  });
  it('anon and authenticated are revoked, and the only grant is to the server role', () => {
    expect(sql).toMatch(/REVOKE ALL ON public\.admin_sessions FROM PUBLIC, anon, authenticated;/);
    expect(sql).toMatch(/GRANT SELECT, INSERT, UPDATE ON public\.admin_sessions TO service_role;/);
    expect(sql).not.toMatch(/TO (anon|authenticated|PUBLIC)\b/i);
  });
  it('stores a hash column, not a token column', () => {
    expect(sql).toMatch(/token_hash text PRIMARY KEY/);
    expect(sql).not.toMatch(/\btoken text\b/);
  });
  it('the rollback drops the table in one transaction', () => {
    expect(down).toMatch(/begin;[\s\S]*DROP TABLE IF EXISTS public\.admin_sessions;[\s\S]*commit;/);
  });
});

describe('every caller awaits the check', () => {
  it('no call site uses the session check without await', () => {
    const { execSync } = require('node:child_process') as typeof import('node:child_process');
    const out = execSync(`git grep -n "isValidAdminSession(" -- src`, { cwd: root, encoding: 'utf8' });
    // A helper may return the promise (`return isValidAdminSession(...)` inside an async-returning helper);
    // its callers await the helper. Any other use without await is an offender.
    const lines = out.split('\n').filter((l) => l && !l.includes('admin-session.ts'));
    const offenders = lines.filter((l) => !/await isValidAdminSession\(/.test(l) && !/^\S+:\d+:\s*return isValidAdminSession\(/.test(l));
    expect(offenders).toEqual([]);
  });
});

describe('revoke all sessions', () => {
  it('ends every session that is still open, and none of them is valid afterwards', async () => {
    const a = await createAdminSession(NOW);
    const b = await createAdminSession(NOW);
    const c = await createAdminSession(NOW);
    await revokeAdminSession(c); // already revoked: stays revoked, not counted twice
    await revokeAllAdminSessions();
    expect(await isValidAdminSession(a, NOW)).toBe(false);
    expect(await isValidAdminSession(b, NOW)).toBe(false);
    expect(await isValidAdminSession(c, NOW)).toBe(false);
    expect([...(state.rows as Map<string, { revoked: boolean }>).values()].every((r) => r.revoked)).toBe(true);
  });
  it('a session created after revoke-all is valid again (revocation ends sessions, it does not ban the password)', async () => {
    await createAdminSession(NOW);
    await revokeAllAdminSessions();
    const fresh = await createAdminSession(NOW);
    expect(await isValidAdminSession(fresh, NOW)).toBe(true);
  });
  it('a failed write throws, so the caller knows the sessions are still open', async () => {
    const t = await createAdminSession(NOW);
    state.fail = 'update';
    await expect(revokeAllAdminSessions()).rejects.toThrow('admin sessions could not be revoked');
    state.fail = null;
    expect(await isValidAdminSession(t, NOW)).toBe(true);
  });
  it('the logout-everywhere action checks the caller first, revokes all, then clears the cookie', () => {
    const src = readFileSync(join(root, 'src/app/admin/pending/actions.ts'), 'utf8');
    const body = src.slice(src.indexOf('export async function logoutEverywhere'));
    const first = body.indexOf('await requireAdmin()');
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(body.indexOf('await revokeAllAdminSessions()'));
    expect(body.indexOf('await revokeAllAdminSessions()')).toBeLessThan(body.indexOf('.delete(ADMIN_COOKIE)'));
  });
});
