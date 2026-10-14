// Image proxy core for /api/img (FP1.3, 27 Sep 2026). Kept free of Next.js
// imports so tests/img-proxy.test.ts can drive it with a fake fetch.
//
// Two changes vs the original route (which fetched the full original and
// buffered up to 8 MB with arrayBuffer() on every cold request):
//  1. Downsize BEFORE fetching: Rebrickable originals (up to 6.7 MB, e.g.
//     10332) are swapped for Rebrickable's own 1000x800 resize -- plenty for
//     an og:image (10332: 6,677,052 B original -> 594,320 B). No Worker CPU is spent resizing: Cloudflare
//     Image Resizing isn't enabled on the zone (/cdn-cgi/image -> 403), and
//     WASM resizing in the Worker would ADD CPU, the opposite of the goal.
//  2. Cap enforced without loading the whole body: a declared
//     content-length over the cap is rejected before reading; otherwise the
//     body is read chunk by chunk and the stream is cancelled the moment the
//     running total passes the cap. Peak memory is bounded by the cap.

import { rebrickableResized } from './set-image';

export const ALLOWED_HOSTS = new Set([
  'images.brickset.com',
  'cdn.rebrickable.com',
  'rebrickable.com',
  'i.ytimg.com',
  'img.youtube.com',
  'www.lego.com',
]);

/** og:image sources above this are rejected (fallback image), never loaded whole. */
export const MAX_SOURCE_BYTES = 3 * 1024 * 1024;
export const UPSTREAM_TIMEOUT_MS = 8000;

export type ProxyResult =
  | { ok: true; body: Uint8Array<ArrayBuffer>; contentType: string; fetchedUrl: string; host: string }
  | { ok: false; reason: string; bytesRead?: number };

/** The URL actually fetched for an allowed source: the smaller variant when one exists. */
export function upstreamUrl(url: URL): string {
  return rebrickableResized(url.toString(), '1000x800');
}

export async function proxyImage(
  src: string | null,
  fetchImpl: typeof fetch = fetch,
  maxBytes: number = MAX_SOURCE_BYTES,
): Promise<ProxyResult> {
  if (!src) return { ok: false, reason: 'missing src' };
  let url: URL;
  try { url = new URL(src); } catch { return { ok: false, reason: 'bad url' }; }
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) return { ok: false, reason: 'host not allowed' };

  const fetchedUrl = upstreamUrl(url);
  const upstream = await fetchImpl(fetchedUrl, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: { 'User-Agent': 'BricksOfIndia-ImageProxy/1.0 (+https://bricksofindia.com)' },
    // Next.js data cache: revalidate daily; Cloudflare adds edge caching on top.
    next: { revalidate: 86400 },
  } as RequestInit);
  if (!upstream.ok || !upstream.body) return { ok: false, reason: `upstream ${upstream.status}` };

  const contentType = upstream.headers.get('content-type') ?? '';
  if (!contentType.startsWith('image/')) {
    await upstream.body.cancel().catch(() => {});
    return { ok: false, reason: 'not an image' };
  }
  const declared = Number(upstream.headers.get('content-length') ?? 0);
  if (declared > maxBytes) {
    await upstream.body.cancel().catch(() => {});
    return { ok: false, reason: `declared ${declared} B over cap`, bytesRead: 0 };
  }

  const reader = upstream.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false, reason: `body over cap after ${total} B`, bytesRead: total };
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { body.set(c, off); off += c.byteLength; }
  return { ok: true, body, contentType, fetchedUrl, host: url.hostname };
}
