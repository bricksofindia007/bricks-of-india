// GET /auth/google/start?age=1|0: sends the visitor to Google. Off (404) unless signInOn() and the Google client is set.
// The age box is carried in the state cookie: a new account can only be made from a sign-in with the box ticked.
import { NextResponse, type NextRequest } from 'next/server';
import { getSecret } from '@/lib/get-secret';
import { signInOn } from '@/lib/signin-gate';
import { buildAuthUrl, GOOGLE_CLIENT_ID_NAME, GOOGLE_STATE_COOKIE, GOOGLE_STATE_TTL_S, googleRedirectUri, randomToken } from '@/lib/google-signin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const clientId = getSecret(GOOGLE_CLIENT_ID_NAME);
  if (!signInOn() || !clientId) return new NextResponse(null, { status: 404 });

  const age = request.nextUrl.searchParams.get('age') === '1' ? '1' : '0';
  const state = randomToken();
  const nonce = randomToken();
  const res = NextResponse.redirect(buildAuthUrl(clientId, googleRedirectUri(), state, nonce), 302);
  res.cookies.set(GOOGLE_STATE_COOKIE, `${state}|${nonce}|${age}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/auth/google',
    maxAge: GOOGLE_STATE_TTL_S,
  });
  return res;
}
