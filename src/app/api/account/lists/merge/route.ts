// POST /api/account/lists/merge: the first sign-in join of the browser lists to the account (P3, order 0230).
// Off (404) unless signInOn(). Signed-in only (401 otherwise). Neutral codes only; no visitor text. Per visitor: no-store.
import { NextResponse, type NextRequest } from 'next/server';
import { signInOn } from '@/lib/signin-gate';
import { SESSION_COOKIE } from '@/lib/account-session';
import { createServerClient } from '@/lib/supabase';
import { handleMergeRequest, parseMergeBody, type MergeResult } from '@/lib/account-lists';

export const dynamic = 'force-dynamic';

const CODE: Record<MergeResult['status'], number> = { ok: 200, invalid: 400, 'signed-out': 401, limit: 409, unavailable: 503 };

export async function POST(request: NextRequest) {
  if (!signInOn()) return new NextResponse(null, { status: 404 });
  // A body over the size limit is refused before it is parsed (parseMergeBody returns null for it).
  const body = parseMergeBody(await request.text());
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ status: 'invalid' }, { status: 400, headers: { 'cache-control': 'no-store' } });
  }
  let result: MergeResult;
  try {
    result = await handleMergeRequest(createServerClient(), request.cookies.get(SESSION_COOKIE)?.value, body, Date.now());
  } catch {
    result = { status: 'unavailable' };
  }
  return NextResponse.json(result, { status: CODE[result.status], headers: { 'cache-control': 'no-store' } });
}
