import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Issue #114: bricksofindia.com and www served plain http:// directly with no
// redirect at all (confirmed live via curl, 2026-09-12 audit) -- Cloudflare's
// own "Always Use HTTPS" zone setting would be the simpler fix, but the
// current API token has no read/write permission on zone-level SSL/TLS
// settings (confirmed: GET .../settings/always_use_https -> 10000
// Authentication error), so this is the application-level fix that doesn't
// depend on that token's scope. Abhinav enabling "Always Use HTTPS" in the
// Cloudflare dashboard (SSL/TLS -> Edge Certificates) is still worth doing
// as a second, edge-level layer -- this middleware doesn't replace that,
// it just doesn't depend on it.
//
// Checks the x-forwarded-proto header directly rather than request.nextUrl's
// own protocol -- behind Cloudflare's proxy, nextUrl can report the
// connection Next itself sees (which may not reflect what the original
// client actually used), while x-forwarded-proto is the standard signal for
// what the client connected with.
export function middleware(request: NextRequest) {
  const proto = request.headers.get('x-forwarded-proto');
  if (proto === 'http') {
    const httpsUrl = new URL(request.url);
    httpsUrl.protocol = 'https:';
    return NextResponse.redirect(httpsUrl, 308);
  }
  return NextResponse.next();
}
