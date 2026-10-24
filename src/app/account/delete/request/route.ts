// POST /account/delete/request: sends a code to the signed-in account's own address, to confirm deleting the account.
// Off (404) unless signInOn(). Needs the session cookie; without a live session the answer is 401 and nothing is sent.
// Reply: the sign-in reply (the same for every case), so the route does not say whether an account exists.
import { NextResponse, type NextRequest } from 'next/server';
import { MSG_GENERIC } from '@/lib/signin-email';
import { requestSignInCode } from '@/lib/signin-request';
import { SupabaseSignInStore, accountForSession } from '@/lib/signin-store';
import { ResendCodeMailer } from '@/lib/signin-mailer';
import { signInHashKey, signInOn } from '@/lib/signin-gate';
import { SESSION_COOKIE, sessionTokenHash } from '@/lib/account-session';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!signInOn()) return new NextResponse(null, { status: 404 });

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ ok: false, message: MSG_GENERIC }, { status: 401 });

  try {
    const account = await accountForSession(createServerClient(), sessionTokenHash(token), Date.now());
    if (!account) return NextResponse.json({ ok: false, message: MSG_GENERIC }, { status: 401 });

    // The account exists, so no 18+ box is needed for this code. The send goes through the same stop line as sign-in.
    const reply = requestSignInCode(
      { rawEmail: account.email, ageConfirmed: true },
      { store: new SupabaseSignInStore(), mailer: new ResendCodeMailer(), hashKey: signInHashKey() },
    );
    return NextResponse.json(reply.body, { status: reply.status });
  } catch {
    return NextResponse.json({ ok: false, message: MSG_GENERIC }, { status: 500 });
  }
}
