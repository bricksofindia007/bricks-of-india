// Sign-in by Google (OpenID Connect, authorisation code flow). Pure helpers: the URL, the state, the nonce and the claim
// checks. The network exchange is in the callback route. Off until signInOn() (both flags, and the hash key).
//
// Secrets, by name only: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (owner's OAuth client, issue 786).
// Redirect address: SITE_URL + /auth/google/callback. That address must be listed in the OAuth client by the owner.
//
// Why the ID token's signature is not checked here: the token comes straight from Google's token endpoint over TLS, in
// the server-to-server exchange, which OpenID Connect allows as the proof of origin. The claims are still checked
// (issuer, audience, expiry, nonce, verified address).
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { SITE_URL } from '@/lib/metadata';

export const GOOGLE_CLIENT_ID_NAME = 'GOOGLE_CLIENT_ID';
export const GOOGLE_CLIENT_SECRET_NAME = 'GOOGLE_CLIENT_SECRET';
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_STATE_COOKIE = 'boi_google_state';
export const GOOGLE_STATE_TTL_S = 10 * 60;

export const googleRedirectUri = () => `${SITE_URL}/auth/google/callback`;

/** A random value for state or nonce: 32 bytes, URL-safe. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Pure: the address the visitor is sent to. Scopes are the minimum: openid and email. */
export function buildAuthUrl(clientId: string, redirectUri: string, state: string, nonce: string): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

/** Constant-time comparison of two strings. Unequal lengths are unequal. */
export function sameValue(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Pure: the payload of a JWT, without checking its signature (see the note above). Null if it cannot be read. */
export function jwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    return json && typeof json === 'object' ? (json as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export type GoogleIdentity = { email: string };

/**
 * Pure: the verified address from an ID token's claims, or null. Null on any failed check: wrong issuer, wrong audience,
 * expired, wrong nonce, no verified email address.
 */
export function identityFromClaims(
  claims: Record<string, unknown> | null,
  expect: { clientId: string; nonce: string; now: number },
): GoogleIdentity | null {
  if (!claims) return null;
  const iss = claims.iss;
  if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') return null;
  if (claims.aud !== expect.clientId) return null;
  const exp = typeof claims.exp === 'number' ? claims.exp : NaN;
  if (!Number.isFinite(exp) || exp * 1000 <= expect.now) return null;
  if (typeof claims.nonce !== 'string' || !sameValue(claims.nonce, expect.nonce)) return null;
  if (claims.email_verified !== true) return null;
  if (typeof claims.email !== 'string') return null;
  const email = claims.email.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return { email };
}
