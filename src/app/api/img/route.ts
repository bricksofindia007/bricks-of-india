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

import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = new Set([
  'images.brickset.com',
  'cdn.rebrickable.com',
  'rebrickable.com',
  'i.ytimg.com',
  'img.youtube.com',
  'www.lego.com',
]);

const FALLBACK_PATH = '/fallback-hero.png';
const UPSTREAM_TIMEOUT_MS = 8000;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB cap

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get('src');
  const fallback = () => NextResponse.redirect(new URL(FALLBACK_PATH, req.nextUrl.origin), 302);

  if (!src) return fallback();

  let url: URL;
  try { url = new URL(src); } catch { return fallback(); }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) return fallback();

  try {
    const upstream = await fetch(url.toString(), {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: { 'User-Agent': 'BricksOfIndia-ImageProxy/1.0 (+https://bricksofindia.com)' },
      // Next.js data cache: revalidate daily; Cloudflare adds edge caching on top.
      next: { revalidate: 86400 },
    });
    if (!upstream.ok) return fallback();

    const contentType = upstream.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return fallback();

    const len = Number(upstream.headers.get('content-length') ?? 0);
    if (len > MAX_BYTES) return fallback();

    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return fallback();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800, max-age=3600',
        'X-Proxied-From': url.hostname,
      },
    });
  } catch {
    return fallback();
  }
}
