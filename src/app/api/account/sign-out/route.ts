// POST /api/account/sign-out: ends this browser's account session (P4, order 0230). Off (404) unless signInOn().
// The saved sets and the browser lists are not changed. The cookie is cleared only when the session was revoked.
// Neutral codes only; no visitor text. Per visitor: no-store.
import { NextResponse, type NextRequest } from 'next/server';
import { signInOn } from '@/lib/signin-gate';
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from '@/lib/account-session';
import { createServerClient } from '@/lib/supabase';
import { handleSignOut } from '@/lib/account-lists';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!signInOn()) return new NextResponse(null, { status: 404 });
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let result: { status: 'ok' | 'unavailable' };
  try {
    result = await handleSignOut(createServerClient(), token, Date.now());
  } catch {
    result = { status: 'unavailable' };
  }
  const headers = { 'cache-control': 'no-store' };
  if (result.status === 'unavailable') {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers });
  }
  const res = NextResponse.json({ status: 'ok' }, { status: 200, headers });
  if (token) res.cookies.set(SESSION_COOKIE, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
