// POST /auth/code: asks for a sign-in code. Returns the same reply for every address that passes the format check.
// Off (404) unless signInOn(). Body: JSON { email, ageConfirmed }. Nothing about the address is logged here.
import { NextResponse, type NextRequest } from 'next/server';
import { MSG_INVALID, MSG_GENERIC } from '@/lib/signin-email';
import { requestSignInCode } from '@/lib/signin-request';
import { SupabaseSignInStore } from '@/lib/signin-store';
import { ResendCodeMailer } from '@/lib/signin-mailer';
import { signInHashKey, signInOn } from '@/lib/signin-gate';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!signInOn()) return new NextResponse(null, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: MSG_INVALID }, { status: 400 });
  }
  const b = (body ?? {}) as { email?: unknown; ageConfirmed?: unknown };
  try {
    const reply = requestSignInCode(
      { rawEmail: typeof b.email === 'string' ? b.email : '', ageConfirmed: b.ageConfirmed === true },
      { store: new SupabaseSignInStore(), mailer: new ResendCodeMailer(), hashKey: signInHashKey() },
    );
    return NextResponse.json(reply.body, { status: reply.status });
  } catch {
    return NextResponse.json({ ok: false, message: MSG_GENERIC }, { status: 500 });
  }
}
