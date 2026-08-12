import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSecret } from '@/lib/get-secret';
import { BRAND } from '@/lib/brand';

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
 * EXCEPTION: /api/resend-webhook. Real bug found live (2026-08-12) when
 * the webhook was first repointed at this proxied URL — Resend's server-
 * to-server calls never carry a boi_admin cookie, so isAuthed() always
 * failed and every real delivery got redirected to /admin/pending
 * instead of ever reaching the growth-engine app. That path is excluded
 * from the cookie check here, exactly mirroring how the growth-engine
 * app's own middleware.ts already excludes it from ITS shared-secret
 * check (it verifies via Resend's own Svix signature instead — see that
 * file). This proxy still forwards the request through unchanged either
 * way, cookie stripped, shared-secret header attached (harmless for the
 * webhook path; the growth-engine app ignores that header there).
 */

export const dynamic = 'force-dynamic';

function isAuthed(): boolean {
  const pw = cookies().get('boi_admin')?.value;
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

async function proxy(request: NextRequest): Promise<Response> {
  const isWebhook = new URL(request.url).pathname.endsWith('/api/resend-webhook');

  if (!isWebhook && !isAuthed()) {
    // Second real bug found the same day: new URL('/admin/pending',
    // request.url) produced a redirect Location pointing at a raw
    // Netlify deploy-preview origin, not bricksofindia.com — request.url
    // reflects Netlify's internal request context here, not the public
    // Host header, confirmed live via a real unauthenticated curl.
    // Anchored to the real production domain explicitly instead.
    return NextResponse.redirect(new URL('/admin/pending', BRAND.domain));
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
