// Sign-in by Google (pillar H, flag off). The owner's OAuth client is not set up yet (issue 786), so these tests cover the
// pure rules and the route gates. Nothing here calls Google.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAuthUrl, identityFromClaims, jwtPayload, sameValue, GOOGLE_STATE_COOKIE } from '../src/lib/google-signin';
import { GET as startGoogle } from '../src/app/auth/google/start/route';
import { GET as callbackGoogle } from '../src/app/auth/google/callback/route';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const CLIENT = 'client-id-not-a-secret.apps.example';
const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const good = (over: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  aud: CLIENT,
  exp: Math.floor(NOW / 1000) + 600,
  nonce: 'n-123',
  email: 'Reader@Example.com',
  email_verified: true,
  ...over,
});
const expectArgs = { clientId: CLIENT, nonce: 'n-123', now: NOW };

describe('the authorisation address', () => {
  it('asks for openid and email only, with state, nonce and the account chooser', () => {
    const url = new URL(buildAuthUrl(CLIENT, 'https://bricksofindia.com/auth/google/callback', 's1', 'n1'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('scope')).toBe('openid email');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('s1');
    expect(url.searchParams.get('nonce')).toBe('n1');
    expect(url.searchParams.get('prompt')).toBe('select_account');
  });
});

describe('the ID token checks', () => {
  it('a good token gives the address, lower-cased', () => {
    expect(identityFromClaims(good(), expectArgs)).toEqual({ email: 'reader@example.com' });
  });
  it('accepts the issuer written without the scheme', () => {
    expect(identityFromClaims(good({ iss: 'accounts.google.com' }), expectArgs)).not.toBeNull();
  });
  it('refuses another issuer', () => {
    expect(identityFromClaims(good({ iss: 'https://evil.example' }), expectArgs)).toBeNull();
  });
  it('refuses a token for another client', () => {
    expect(identityFromClaims(good({ aud: 'someone-else' }), expectArgs)).toBeNull();
  });
  it('refuses an expired token', () => {
    expect(identityFromClaims(good({ exp: Math.floor(NOW / 1000) - 1 }), expectArgs)).toBeNull();
  });
  it('refuses a wrong nonce', () => {
    expect(identityFromClaims(good({ nonce: 'other' }), expectArgs)).toBeNull();
  });
  it('refuses an address Google has not verified', () => {
    expect(identityFromClaims(good({ email_verified: false }), expectArgs)).toBeNull();
  });
  it('refuses a token with no address', () => {
    expect(identityFromClaims(good({ email: undefined }), expectArgs)).toBeNull();
  });
  it('refuses no claims at all', () => {
    expect(identityFromClaims(null, expectArgs)).toBeNull();
  });
});

describe('reading and comparing', () => {
  it('reads a JWT payload without checking its signature (documented in the module)', () => {
    const payload = Buffer.from(JSON.stringify({ sub: '1' })).toString('base64url');
    expect(jwtPayload(`aaa.${payload}.bbb`)).toEqual({ sub: '1' });
  });
  it('a malformed token reads as nothing', () => {
    expect(jwtPayload('not-a-token')).toBeNull();
    expect(jwtPayload('a.!!!.c')).toBeNull();
  });
  it('compares values in full; unequal lengths are unequal', () => {
    expect(sameValue('abc', 'abc')).toBe(true);
    expect(sameValue('abc', 'abd')).toBe(false);
    expect(sameValue('abc', 'abcd')).toBe(false);
  });
});

describe('the routes: off by default', () => {
  it('the start route answers 404 while sign-in is off', async () => {
    const res = await startGoogle({ nextUrl: new URL('https://bricksofindia.com/auth/google/start?age=1') } as any);
    expect(res.status).toBe(404);
  });
  it('the callback answers 404 while sign-in is off', async () => {
    const res = await callbackGoogle({ nextUrl: new URL('https://bricksofindia.com/auth/google/callback?code=x&state=y'), cookies: { get: () => undefined } } as any);
    expect(res.status).toBe(404);
  });
  it('the flags stay off in both mirrored files', () => {
    expect(FEATURE_FLAGS.signInByEmail).toBe(false);
    expect(read('config/feature_flags.py')).toMatch(/"sign_in_by_email": False,/);
  });
});

describe('the callback rules, in order', () => {
  const src = read('src/app/auth/google/callback/route.ts');
  it('checks the state before any network call', () => {
    expect(src.indexOf('sameValue(state, savedState)')).toBeLessThan(src.indexOf('fetch(GOOGLE_TOKEN_URL'));
  });
  it('checks the ID token before any account is touched', () => {
    expect(src.indexOf('identityFromClaims(')).toBeLessThan(src.indexOf('store.findAccountId'));
  });
  it('a new account needs the 18+ box, and nothing is created without it', () => {
    expect(src).toMatch(/if \(!existing && age !== '1'\) return back\(\);/);
    expect(src.indexOf("age !== '1'")).toBeLessThan(src.indexOf('store.createAccount'));
  });
  it('the state cookie is cleared on every answer that ends the flow', () => {
    expect((src.match(/GOOGLE_STATE_COOKIE, '', \{/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
  it('the start route sets the state cookie for the Google path only, httpOnly and secure', () => {
    const start = read('src/app/auth/google/start/route.ts');
    expect(start).toMatch(/httpOnly: true,\s*secure: true,\s*sameSite: 'lax',\s*path: '\/auth\/google'/);
    expect(GOOGLE_STATE_COOKIE).toBe('boi_google_state');
  });
  it('secrets are named, never printed', () => {
    const all = [src, read('src/app/auth/google/start/route.ts'), read('src/lib/google-signin.ts')].join('\n');
    expect(all).toMatch(/GOOGLE_CLIENT_SECRET_NAME/);
    expect(all).not.toMatch(/console\.(log|info|warn|error)\(/);
  });
});
