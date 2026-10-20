// Admin session (B6a). The admin cookie holds a random token. Only its SHA-256 hash is stored, in
// public.admin_sessions. The password never goes into the cookie. Expiry and revocation are checked on the
// server on every read. The check fails closed: if the row cannot be read, the session is not valid.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServerClient } from './supabase';

export const ADMIN_COOKIE = 'boi_admin';
export const ADMIN_SESSION_SECONDS = 60 * 60 * 8;

// 32 random bytes, base64url: 43 characters. Anything else is refused before any database call.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** The stored form of a token. Only this is written to the table. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** A new session. Returns the token for the cookie; stores only its hash and the expiry. */
export async function createAdminSession(now: number = Date.now()): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const { error } = await createServerClient()
    .from('admin_sessions')
    .insert({ token_hash: hashToken(token), expires_at: new Date(now + ADMIN_SESSION_SECONDS * 1000).toISOString() });
  if (error) throw new Error('admin session could not be stored');
  return token;
}

/** True only for an unexpired, unrevoked session. A forged, malformed, expired or revoked token is refused. */
export async function isValidAdminSession(token: string | undefined, now: number = Date.now()): Promise<boolean> {
  if (!token || !TOKEN_SHAPE.test(token)) return false;
  const { data, error } = await createServerClient()
    .from('admin_sessions')
    .select('revoked, expires_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (error || !data || data.revoked) return false;
  return Date.parse(data.expires_at) > now;
}

/** Ends a session on the server. A token of the wrong shape changes nothing. */
export async function revokeAdminSession(token: string | undefined): Promise<void> {
  if (!token || !TOKEN_SHAPE.test(token)) return;
  const { error } = await createServerClient()
    .from('admin_sessions')
    .update({ revoked: true })
    .eq('token_hash', hashToken(token));
  if (error) console.error('[admin-session] revoke failed:', error.message);
}

/**
 * Ends every admin session at once (for example after the password changes). Unlike the single revoke, a failure
 * throws: the caller asked for everything to end, so it must learn that it did not.
 */
export async function revokeAllAdminSessions(): Promise<void> {
  const { error } = await createServerClient()
    .from('admin_sessions')
    .update({ revoked: true })
    .eq('revoked', false);
  if (error) throw new Error('admin sessions could not be revoked');
}

/** Constant-time password check (both sides hashed first, so lengths never leak). */
export function adminPasswordMatches(candidate: string): boolean {
  const correct = process.env.ADMIN_PASSWORD;
  if (!correct) return false;
  const h = (s: string) => createHmac('sha256', 'boi-admin-compare').update(s).digest();
  return timingSafeEqual(h(candidate), h(correct));
}
