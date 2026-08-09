import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSecret } from '@/lib/get-secret';

/**
 * Reverse proxy for the BOI Growth Engine dashboard — a separately
 * deployed app, own repo (boi-growth-engine), own database role. See
 * boi-growth-engine/docs/architecture.md, "Phase 4 access design note"
 * (recorded back in Phase 0) and the Phase 4 section for the full design.
 *
 * Reuses this existing site's `boi_admin` cookie auth — the same check
 * as /admin/pending's page.tsx, duplicated inline here rather than
 * exported from page.tsx, so this PR touches zero existing files. The
 * cookie is set with `path: '/admin'` scope, so it's already valid here.
 *
 * The growth-engine app has no human login of its own at all — it trusts
 * only the X-Growth-Proxy-Secret header this proxy attaches, and returns
 * a 404 to any request without it. That header is this proxy's only
 * job to attach correctly; the actual authentication decision (is this a
 * real logged-in admin?) happens right here, before anything is forwarded.
 *
 * This is the ONLY file this PR adds or changes. No modifications to
 * page.tsx, actions.ts, or any existing content-pipeline review
 * functionality on /admin/pending.
 */

export const dynamic = 'force-dynamic';

function isAuthed(): boolean {
  const pw = cookies().get('boi_admin')?.value;
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

async function proxy(request: NextRequest): Promise<Response> {
  if (!isAuthed()) {
    return NextResponse.redirect(new URL('/admin/pending', request.url));
  }

  const targetBase = process.env.GROWTH_ENGINE_URL;
  const sharedSecret = getSecret('GROWTH_PROXY_SHARED_SECRET');
  if (!targetBase || !sharedSecret) {
    return new NextResponse('Growth engine proxy is not configured', { status: 502 });
  }

  const incoming = new URL(request.url);
  const targetUrl = new URL(incoming.pathname + incoming.search, targetBase);

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('cookie'); // no bricks-of-india cookies leave this proxy
  headers.set('x-growth-proxy-secret', sharedSecret);

  const init: RequestInit = {
    method: request.method,
    headers,
    // Relay 3xx responses to the browser as-is rather than following them
    // server-side — standard reverse-proxy behavior, and required for the
    // dashboard's post-Approve/Dismiss redirect to land back in the
    // browser's address bar correctly.
    redirect: 'manual',
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(targetUrl.toString(), init);

  const responseHeaders = new Headers(upstream.headers);
  // Let the runtime recompute these for the proxied response rather than
  // relaying values computed for the upstream's own transport encoding.
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest) {
  return proxy(request);
}
export async function POST(request: NextRequest) {
  return proxy(request);
}
export async function PUT(request: NextRequest) {
  return proxy(request);
}
export async function DELETE(request: NextRequest) {
  return proxy(request);
}
export async function PATCH(request: NextRequest) {
  return proxy(request);
}
