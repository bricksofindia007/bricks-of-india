import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ADMIN_SESSION_SECONDS, adminPasswordMatches, createAdminSession, isValidAdminSession, revokeAdminSession } from '../src/lib/admin-session';

// An in-memory stand-in for public.admin_sessions. failRead makes every read fail (the check must fail closed).
const state = vi.hoisted(() => ({ rows: new Map<string, { id: string; expires_at: string; revoked_at: string | null }>(), failRead: false }));

vi.mock('../src/lib/supabase', () => {
  const client = {
    from: () => ({
      insert: async (row: { id: string; expires_at: string }) => {
        state.rows.set(row.id, { id: row.id, expires_at: row.expires_at, revoked_at: null });
        return { error: null };
      },
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: async () => (state.failRead
            ? { data: null, error: { message: 'database unreachable' } }
            : { data: state.rows.get(id) ?? null, error: null }),
        }),
      }),
      update: (patch: { revoked_at: string }) => ({
        eq: (_col: string, id: string) => ({
          is: async () => {
            const r = state.rows.get(id);
            if (r && r.revoked_at === null) r.revoked_at = patch.revoked_at;
            return { error: null };
          },
        }),
      }),
    }),
  };
  return { createServerClient: () => client };
});

describe('admin session (signed token, server-side row; the password never goes in the cookie)', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'correct horse battery staple';
    state.rows.clear();
    state.failRead = false;
  });

  it('login: a new token is valid, stores a session row, and does not contain the password', async () => {
    const t = await createAdminSession();
    expect(await isValidAdminSession(t)).toBe(true);
    expect(t).not.toContain(process.env.ADMIN_PASSWORD!);
    expect(t).toMatch(/^v2\.\d+\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$/);
    expect(state.rows.size).toBe(1);
  });

  it('expiry: valid just before 8 hours, invalid at and after', async () => {
    const now = Date.UTC(2026, 9, 3, 12);
    const t = await createAdminSession(now);
    expect(await isValidAdminSession(t, now + (ADMIN_SESSION_SECONDS - 1) * 1000)).toBe(true);
    expect(await isValidAdminSession(t, now + ADMIN_SESSION_SECONDS * 1000)).toBe(false);
  });

  it('tampering: a changed expiry, a changed id or a bad signature is rejected', async () => {
    const [v, exp, id, sig] = (await createAdminSession()).split('.');
    expect(await isValidAdminSession(`${v}.${Number(exp) + 3600}.${id}.${sig}`)).toBe(false);
    expect(await isValidAdminSession(`${v}.${exp}.${'A'.repeat(22)}.${sig}`)).toBe(false);
    expect(await isValidAdminSession(`${v}.${exp}.${id}.${sig.slice(0, -2)}xx`)).toBe(false);
    expect(await isValidAdminSession('not-a-token')).toBe(false);
    expect(await isValidAdminSession(undefined)).toBe(false);
  });

  it('the old cookie formats no longer log anyone in', async () => {
    expect(await isValidAdminSession(process.env.ADMIN_PASSWORD)).toBe(false);
    expect(await isValidAdminSession('v1.9999999999.abc')).toBe(false);
  });

  it('logout: revoking the session ends it on the server', async () => {
    const t = await createAdminSession();
    expect(await isValidAdminSession(t)).toBe(true);
    await revokeAdminSession(t);
    expect(await isValidAdminSession(t)).toBe(false);
  });

  it('a token with no stored row is not a session', async () => {
    const t = await createAdminSession();
    state.rows.clear();
    expect(await isValidAdminSession(t)).toBe(false);
  });

  it('fails closed: an unreadable session table means no access', async () => {
    const t = await createAdminSession();
    state.failRead = true;
    expect(await isValidAdminSession(t)).toBe(false);
  });

  it('changing the password ends every open session', async () => {
    const t = await createAdminSession();
    process.env.ADMIN_PASSWORD = 'a new password';
    expect(await isValidAdminSession(t)).toBe(false);
  });

  it('password check', () => {
    expect(adminPasswordMatches('correct horse battery staple')).toBe(true);
    expect(adminPasswordMatches('wrong')).toBe(false);
    delete process.env.ADMIN_PASSWORD;
    expect(adminPasswordMatches('')).toBe(false);
  });
});
