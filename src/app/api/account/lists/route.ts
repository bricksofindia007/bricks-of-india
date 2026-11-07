// /api/account/lists: the signed-in account's saved sets (P2, order 0230). Off (404) unless signInOn(), which needs the
// accounts and sign-in flags and their secret. Answers carry neutral codes only, never visitor text. Per visitor: no-store.
import { NextResponse, type NextRequest } from 'next/server';
import { signInOn } from '@/lib/signin-gate';
import { SESSION_COOKIE } from '@/lib/account-session';
import { createServerClient } from '@/lib/supabase';
import { handleListsRequest, type ListsRequest, type ListResult } from '@/lib/account-lists';

export const dynamic = 'force-dynamic';

const CODE: Record<ListResult['status'], number> = { ok: 200, limit: 409, invalid: 400, 'signed-out': 401, unavailable: 503 };

function reply(r: ListResult) {
  const body = r.status === 'ok' && r.lists ? { status: r.status, lists: r.lists } : { status: r.status };
  return NextResponse.json(body, { status: CODE[r.status], headers: { 'cache-control': 'no-store' } });
}

async function run(request: NextRequest, req: ListsRequest): Promise<ListResult> {
  try {
    return await handleListsRequest(createServerClient(), request.cookies.get(SESSION_COOKIE)?.value, req, Date.now());
  } catch {
    return { status: 'unavailable' };
  }
}

export async function GET(request: NextRequest) {
  if (!signInOn()) return new NextResponse(null, { status: 404 });
  return reply(await run(request, { method: 'GET' }));
}

export async function POST(request: NextRequest) {
  if (!signInOn()) return new NextResponse(null, { status: 404 });
  const body = (await request.json().catch(() => null)) as { list?: unknown; set?: unknown; qty?: unknown } | null;
  if (!body) return reply({ status: 'invalid' });
  return reply(await run(request, { method: 'POST', list: body.list, set: body.set, qty: body.qty }));
}

export async function DELETE(request: NextRequest) {
  if (!signInOn()) return new NextResponse(null, { status: 404 });
  const body = (await request.json().catch(() => null)) as { list?: unknown; set?: unknown } | null;
  if (!body) return reply({ status: 'invalid' });
  return reply(await run(request, { method: 'DELETE', list: body.list, set: body.set }));
}
