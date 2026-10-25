// POST /auth/verify: checks the code and starts an account session. Off (404) unless signInOn().
// Body: JSON { email, code }. On success: creates the account if the address has none (a code was only issued to a
// new address with the 18+ box ticked), stores a hash of a new session token, and sets it in an httpOnly cookie.
// Failure behaviour: any error after a good code is the generic message, and no cookie is set.
import { NextResponse, type NextRequest } from 'next/server';
import { MSG_GENERIC, normaliseEmail, verifySignInCode } from '@/lib/signin-email';
import { SupabaseSignInStore } from '@/lib/signin-store';
import { signInHashKey, signInOn } from '@/lib/signin-gate';
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, SESSION_TTL_MS, newSessionToken, sessionTokenHash } from '@/lib/account-session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!signInOn()) return new NextResponse(null, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: MSG_GENERIC }, { status: 400 });
  }
  const b = (body ?? {}) as { email?: unknown; code?: unknown };
  const rawEmail = typeof b.email === 'string' ? b.email : '';
  const code = typeof b.code === 'string' ? b.code : '';

  const checked = await verifySignInCode({ rawEmail, code }, { store: new SupabaseSignInStore(), hashKey: signInHashKey() });
  if (!checked.ok) return NextResponse.json({ ok: false, message: checked.message }, { status: 400 });

  const email = normaliseEmail(rawEmail);
  if (!email) return NextResponse.json({ ok: false, message: MSG_GENERIC }, { status: 500 });

  try {
    const store = new SupabaseSignInStore();
    const accountId = (await store.findAccountId(email)) ?? (await store.createAccount(email));
    const token = newSessionToken();
    const signedInAt = Date.now();
    await store.createSession(accountId, sessionTokenHash(token), signedInAt + SESSION_TTL_MS, signedInAt);
    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
    return res;
  } catch {
    return NextResponse.json({ ok: false, message: MSG_GENERIC }, { status: 500 });
  }
}
