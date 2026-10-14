// Admin session (3 Oct 2026): the admin cookie holds a signed, expiring token, never the password.
// Token = "v1.<expiry unix seconds>.<HMAC-SHA256 signature>". The signing key is derived from ADMIN_PASSWORD,
// so changing the password ends every open session. No new secret is needed.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE = 'boi_admin';
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8;

function signingKey(): Buffer | null {
  const pw = process.env.ADMIN_PASSWORD;
  return pw ? createHmac('sha256', pw).update('boi-admin-session-v1').digest() : null;
}

function sign(payload: string, key: Buffer): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

/** A new session token valid for ADMIN_SESSION_SECONDS. */
export function createAdminSession(now: number = Date.now()): string {
  const key = signingKey();
  if (!key) throw new Error('ADMIN_PASSWORD env var not set');
  const payload = `v1.${Math.floor(now / 1000) + ADMIN_SESSION_SECONDS}`;
  return `${payload}.${sign(payload, key)}`;
}

/** True only for an unexpired token signed with the current key. */
export function isValidAdminSession(token: string | undefined, now: number = Date.now()): boolean {
  const key = signingKey();
  if (!key || !token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || !/^\d+$/.test(parts[1])) return false;
  if (Number(parts[1]) * 1000 <= now) return false;
  const expected = Buffer.from(sign(`v1.${parts[1]}`, key));
  const got = Buffer.from(parts[2]);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Constant-time password check (both sides hashed first, so lengths never leak). */
export function adminPasswordMatches(candidate: string): boolean {
  const correct = process.env.ADMIN_PASSWORD;
  if (!correct) return false;
  const h = (s: string) => createHmac('sha256', 'boi-admin-compare').update(s).digest();
  return timingSafeEqual(h(candidate), h(correct));
}
