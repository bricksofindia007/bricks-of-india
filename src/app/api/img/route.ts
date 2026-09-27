// /api/img?src=<encoded-url> — allowlisted, cached image proxy.
//
// Why (2026-07-02 audit item #5): hero images hotlink third-party CDNs
// (images.brickset.com, cdn.rebrickable.com, i.ytimg.com). On-page rendering
// already degrades gracefully via <ImageWithFallback>, but og:image /
// twitter:image URLs are fetched directly by social crawlers with NO fallback
// — if the upstream CDN blocks, rate-limits, or restructures, every share
// card on WhatsApp/X/LinkedIn goes blank silently. This route puts our origin
// (behind Cloudflare's Mumbai edge, so cache HITs after first fetch) between
// crawlers and the CDNs, and falls back to /fallback-hero.png on any upstream
// failure so a share card is never image-less.
//
// Strict host allowlist — this is a proxy, and an open proxy is an SSRF hole.
//
// FP1.3 (2026-09-27): fetch logic lives in src/lib/img-proxy.ts. Rebrickable
// originals are swapped for their 1000x800 resize before fetching, and the
// source cap (3 MB) is enforced while streaming, so an oversized upstream is
// never held in memory whole.

import { NextRequest, NextResponse } from 'next/server';
import { proxyImage } from '@/lib/img-proxy';

const FALLBACK_PATH = '/fallback-hero.png';

export async function GET(req: NextRequest) {
  const fallback = () => NextResponse.redirect(new URL(FALLBACK_PATH, req.nextUrl.origin), 302);
  try {
    const r = await proxyImage(req.nextUrl.searchParams.get('src'));
    if (!r.ok) return fallback();
    return new NextResponse(r.body, {
      status: 200,
      headers: {
        'Content-Type': r.contentType,
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800, max-age=3600',
        'X-Proxied-From': r.host,
      },
    });
  } catch {
    return fallback();
  }
}
