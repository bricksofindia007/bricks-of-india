import { describe, it, expect } from 'vitest';
import { proxyImage, MAX_SOURCE_BYTES } from '../src/lib/img-proxy';

// FP1.3: oversized og:image sources are rejected without being held in
// memory whole; Rebrickable originals are fetched at their 1000x800 resize.
const CHUNK = 64 * 1024;
const OVERSIZED = 9 * 1024 * 1024; // the fixture: a 9 MB "image"

function streamingResponse(totalBytes: number, opts: { declare?: boolean; type?: string } = {}) {
  let sent = 0, pulls = 0, cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(ctrl) {
      if (sent >= totalBytes) return ctrl.close();
      const n = Math.min(CHUNK, totalBytes - sent);
      const c = new Uint8Array(n); c[0] = 0xff; c[1] = 0xd8; // JPEG SOI marker
      sent += n; pulls++; ctrl.enqueue(c);
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 }); // produce bytes only when read, like a network body
  const headers = new Headers({ 'content-type': opts.type ?? 'image/jpeg' });
  if (opts.declare) headers.set('content-length', String(totalBytes));
  return { res: new Response(body, { status: 200, headers }), stats: () => ({ sent, pulls, cancelled }) };
}

function fakeFetch(make: () => Response) {
  const calls: string[] = [];
  const f = (async (url: string) => { calls.push(String(url)); return make(); }) as unknown as typeof fetch;
  return { f, calls };
}

describe('proxyImage (FP1.3)', () => {
  it('oversized fixture WITH content-length: rejected before reading a byte', async () => {
    const s = streamingResponse(OVERSIZED, { declare: true });
    const { f } = fakeFetch(() => s.res);
    const r = await proxyImage('https://images.brickset.com/sets/images/10332-1.jpg', f);
    expect(r.ok).toBe(false);
    expect(s.stats().sent).toBe(0);
    expect(s.stats().cancelled).toBe(true);
  });

  it('oversized fixture WITHOUT content-length: stops at the cap, never buffers the whole 9 MB', async () => {
    const s = streamingResponse(OVERSIZED);
    const { f } = fakeFetch(() => s.res);
    const r = await proxyImage('https://www.lego.com/cdn/cs/set/assets/big.jpg', f);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.bytesRead!).toBeLessThanOrEqual(MAX_SOURCE_BYTES + CHUNK);
    expect(s.stats().sent).toBeLessThan(OVERSIZED / 2);
    expect(s.stats().cancelled).toBe(true);
  });

  it('Rebrickable original is fetched at its 1000x800 resize', async () => {
    const s = streamingResponse(50_000, { declare: true });
    const { f, calls } = fakeFetch(() => s.res);
    const r = await proxyImage('https://cdn.rebrickable.com/media/sets/10332-1/140383.jpg', f);
    expect(calls[0]).toBe('https://cdn.rebrickable.com/media/thumbs/sets/10332-1/140383.jpg/1000x800p.jpg');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.body.byteLength).toBe(50_000);
  });

  it('an under-cap image passes through intact', async () => {
    const s = streamingResponse(200_000);
    const { f } = fakeFetch(() => s.res);
    const r = await proxyImage('https://i.ytimg.com/vi/abc/hqdefault.jpg', f);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.body.byteLength).toBe(200_000); expect(r.contentType).toBe('image/jpeg'); }
  });

  it('non-allowlisted host and non-image content never pass', async () => {
    const { f, calls } = fakeFetch(() => streamingResponse(10).res);
    expect((await proxyImage('https://evil.example.com/x.jpg', f)).ok).toBe(false);
    expect(calls.length).toBe(0);
    const html = fakeFetch(() => streamingResponse(10, { type: 'text/html' }).res);
    expect((await proxyImage('https://images.brickset.com/x.jpg', html.f)).ok).toBe(false);
  });
});
