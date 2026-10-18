// Admin session (B6a, 17 Oct 2026). The admin cookie holds a signed, expiring token with a random session
// id, never the password. Each session is also a row in public.admin_sessions, so logout (and any later
// revocation) ends it on the server, not only in the browser. The check fails closed: if the row cannot
// be read, the session is not valid.
// Token = "v2.<expiry unix seconds>.<session id>.<HMAC-SHA256 signature>". The signing key is derived from
// ADMIN_PASSWORD, so changing the password ends every open session. No new secret is needed.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServerClient } from './supabase';

export const ADMIN_COOKIE = 'boi_admin';
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8;

const SESSION_ID = /^[A-Za-z0-9_-]{22}$/;

function signingKey(): Buffer | null {
  const pw = process.env.ADMIN_PASSWORD;
  return pw ? createHmac('sha256', pw).update('boi-admin-session-v2').digest() : null;
}

function sign(payload: string, key: Buffer): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

/** Parses and checks the token's shape, expiry and signature. Returns the session id, or null. */
function verifyToken(token: string | undefined, now: number): string | null {
  const key = signingKey();
  if (!key || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v2' || !/^\d+$/.test(parts[1]) || !SESSION_ID.test(parts[2])) return null;
  if (Number(parts[1]) * 1000 <= now) return null;
  const expected = Buffer.from(sign(`v2.${parts[1]}.${parts[2]}`, key));
  const got = Buffer.from(parts[3]);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  return parts[2];
}

/** A new session: a stored row and a signed token valid for ADMIN_SESSION_SECONDS. */
export async function createAdminSession(now: number = Date.now()): Promise<string> {
  const key = signingKey();
  if (!key) throw new Error('ADMIN_PASSWORD env var not set');
  const id = randomBytes(16).toString('base64url');
  const exp = Math.floor(now / 1000) + ADMIN_SESSION_SECONDS;
  const { error } = await createServerClient()
    .from('admin_sessions')
    .insert({ id, expires_at: new Date(exp * 1000).toISOString() });
  if (error) throw new Error('admin session could not be stored');
  const payload = `v2.${exp}.${id}`;
  return `${payload}.${sign(payload, key)}`;
}

/** True only for an unexpired, unrevoked session with a valid signature. Fails closed on any read error. */
export async function isValidAdminSession(token: string | undefined, now: number = Date.now()): Promise<boolean> {
  const id = verifyToken(token, now);
  if (!id) return false;
  const { data, error } = await createServerClient()
    .from('admin_sessions')
    .select('revoked_at, expires_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return false;
  return data.revoked_at == null && Date.parse(data.expires_at) > now;
}

/** Ends the session on the server. A token that does not verify revokes nothing. */
export async function revokeAdminSession(token: string | undefined, now: number = Date.now()): Promise<void> {
  const id = verifyToken(token, now);
  if (!id) return;
  await createServerClient()
    .from('admin_sessions')
    .update({ revoked_at: new Date(now).toISOString() })
    .eq('id', id)
    .is('revoked_at', null);
}

/** Constant-time password check (both sides hashed first, so lengths never leak). */
export function adminPasswordMatches(candidate: string): boolean {
  const correct = process.env.ADMIN_PASSWORD;
  if (!correct) return false;
  const h = (s: string) => createHmac('sha256', 'boi-admin-compare').update(s).digest();
  return timingSafeEqual(h(candidate), h(correct));
}
