import { describe, it, expect, beforeEach } from 'vitest';
import { ADMIN_SESSION_SECONDS, adminPasswordMatches, createAdminSession, isValidAdminSession } from '../src/lib/admin-session';

describe('admin session (signed, expiring token; the password never goes in the cookie)', () => {
  beforeEach(() => { process.env.ADMIN_PASSWORD = 'correct horse battery staple'; });

  it('login: a new token is valid and does not contain the password', () => {
    const t = createAdminSession();
    expect(isValidAdminSession(t)).toBe(true);
    expect(t).not.toContain(process.env.ADMIN_PASSWORD!);
    expect(t).toMatch(/^v1\.\d+\.[A-Za-z0-9_-]+$/);
  });

  it('expiry: valid just before 8 hours, invalid at and after', () => {
    const now = Date.UTC(2026, 9, 3, 12);
    const t = createAdminSession(now);
    expect(isValidAdminSession(t, now + (ADMIN_SESSION_SECONDS - 1) * 1000)).toBe(true);
    expect(isValidAdminSession(t, now + ADMIN_SESSION_SECONDS * 1000)).toBe(false);
  });

  it('tampering: a changed expiry or signature is rejected', () => {
    const [v, exp, sig] = createAdminSession().split('.');
    expect(isValidAdminSession(`${v}.${Number(exp) + 3600}.${sig}`)).toBe(false);
    expect(isValidAdminSession(`${v}.${exp}.${sig.slice(0, -2)}xx`)).toBe(false);
    expect(isValidAdminSession('not-a-token')).toBe(false);
    expect(isValidAdminSession(undefined)).toBe(false);
  });

  it('the old cookie (the raw password) no longer logs anyone in', () => {
    expect(isValidAdminSession(process.env.ADMIN_PASSWORD)).toBe(false);
  });

  it('changing the password ends every open session', () => {
    const t = createAdminSession();
    process.env.ADMIN_PASSWORD = 'a new password';
    expect(isValidAdminSession(t)).toBe(false);
  });

  it('logout: with no cookie there is no session', () => {
    expect(isValidAdminSession('')).toBe(false);
  });

  it('password check', () => {
    expect(adminPasswordMatches('correct horse battery staple')).toBe(true);
    expect(adminPasswordMatches('wrong')).toBe(false);
    delete process.env.ADMIN_PASSWORD;
    expect(adminPasswordMatches('')).toBe(false);
  });
});
