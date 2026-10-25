// GET /auth/google/callback: Google returns here. Checks the state, exchanges the code server to server, checks the ID
// token's claims, then finds or creates the account and starts a session. Any failure sends the visitor to /auth and
// creates nothing. A new account needs the 18+ box, carried from /auth/google/start.
import { NextResponse, type NextRequest } from 'next/server';
import { getSecret } from '@/lib/get-secret';
import { signInOn } from '@/lib/signin-gate';
import { SupabaseSignInStore } from '@/lib/signin-store';
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, SESSION_TTL_MS, newSessionToken, sessionTokenHash } from '@/lib/account-session';
import {
  GOOGLE_CLIENT_ID_NAME, GOOGLE_CLIENT_SECRET_NAME, GOOGLE_STATE_COOKIE, GOOGLE_TOKEN_URL, googleRedirectUri,
  identityFromClaims, jwtPayload, sameValue,
} from '@/lib/google-signin';
import { SITE_URL } from '@/lib/metadata';

export const dynamic = 'force-dynamic';

const back = (clear = true) => {
  const res = NextResponse.redirect(`${SITE_URL}/auth`, 302);
  if (clear) res.cookies.set(GOOGLE_STATE_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/auth/google', maxAge: 0 });
  return res;
};

export async function GET(request: NextRequest) {
  if (!signInOn()) return new NextResponse(null, { status: 404 });
  const clientId = getSecret(GOOGLE_CLIENT_ID_NAME);
  const clientSecret = getSecret(GOOGLE_CLIENT_SECRET_NAME);
  if (!clientId || !clientSecret) return new NextResponse(null, { status: 404 });

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const cookie = request.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? '';
  const [savedState, nonce, age] = cookie.split('|');
  if (!code || !state || !savedState || !nonce || !sameValue(state, savedState)) return back();

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: googleRedirectUri(),
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenRes.ok) return back();
    const body = (await tokenRes.json()) as { id_token?: unknown };
    if (typeof body.id_token !== 'string') return back();

    const identity = identityFromClaims(jwtPayload(body.id_token), { clientId, nonce, now: Date.now() });
    if (!identity) return back();

    const store = new SupabaseSignInStore();
    const existing = await store.findAccountId(identity.email);
    // A new account needs the 18+ box; without it nothing is created.
    if (!existing && age !== '1') return back();
    const accountId = existing ?? (await store.createAccount(identity.email));

    const token = newSessionToken();
    const signedInAt = Date.now();
    await store.createSession(accountId, sessionTokenHash(token), signedInAt + SESSION_TTL_MS, signedInAt);
    const res = NextResponse.redirect(`${SITE_URL}/account`, 302);
    res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    res.cookies.set(GOOGLE_STATE_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/auth/google', maxAge: 0 });
    return res;
  } catch {
    return back();
  }
}
