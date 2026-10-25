// Account session tokens. The token is random and lives only in the visitor's cookie; the server keeps a hash of it.
// Pure helpers: no storage, no request handling.
import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'boi_account';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** A new session token: 32 random bytes, URL-safe. */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** The stored form of a token: a SHA-256 hex digest. A stolen table row is not a usable cookie. */
export function sessionTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Cookie settings: not readable by page scripts, sent only over HTTPS, and only on the account paths. */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/account',
  maxAge: SESSION_TTL_MS / 1000,
};
