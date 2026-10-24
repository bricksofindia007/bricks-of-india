// POST /account/delete/confirm: checks the emailed code and deletes the signed-in account, with its saved lists and
// sessions. Sign-in codes for the address are removed too. Off (404) unless signInOn(). Body: JSON { code }.
// Failure behaviour: a bad or expired code deletes nothing and says so. Any other failure says the generic line and
// deletes nothing it cannot finish. The session cookie is cleared only after the account is gone.
import { NextResponse, type NextRequest } from 'next/server';
import { MSG_BAD_CODE, MSG_GENERIC, emailHash, verifySignInCode } from '@/lib/signin-email';
import { SupabaseSignInStore, accountForSession, deleteAccountAndCodes } from '@/lib/signin-store';
import { signInHashKey, signInOn } from '@/lib/signin-gate';
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, sessionTokenHash } from '@/lib/account-session';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!signInOn()) return new NextResponse(null, { status: 404 });

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ ok: false, message: MSG_GENERIC }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: MSG_BAD_CODE }, { status: 400 });
  }
  const code = typeof (body as { code?: unknown })?.code === 'string' ? (body as { code: string }).code : '';

  try {
    const db = createServerClient();
    const account = await accountForSession(db, sessionTokenHash(token), Date.now());
    if (!account) return NextResponse.json({ ok: false, message: MSG_GENERIC }, { status: 401 });

    const hashKey = signInHashKey();
    const checked = await verifySignInCode(
      { rawEmail: account.email, code },
      { store: new SupabaseSignInStore(db), hashKey },
    );
    if (!checked.ok) return NextResponse.json({ ok: false, message: checked.message }, { status: 400 });

    await deleteAccountAndCodes(db, account.id, emailHash(account.email, hashKey));
    const res = NextResponse.json({ ok: true, message: 'Your account has been deleted.' }, { status: 200 });
    res.cookies.set(SESSION_COOKIE, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
    return res;
  } catch {
    return NextResponse.json({ ok: false, message: MSG_GENERIC }, { status: 500 });
  }
}
