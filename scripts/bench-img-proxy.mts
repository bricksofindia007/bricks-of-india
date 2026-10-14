// FP1.3 measurement (local Node, not Workers): CPU time per request for the
// old /api/img logic (fetch + arrayBuffer of the original, 8 MB cap) vs the
// new proxyImage() (Rebrickable resize + streamed 3 MB cap).
import { proxyImage } from '../src/lib/img-proxy';

const src = process.argv[2];
const N = 5;
const UA = { 'User-Agent': 'BricksOfIndia-ImageProxy/1.0 (+https://bricksofindia.com)' };

async function before(s: string) {                       // verbatim old route logic
  const upstream = await fetch(s, { headers: UA, signal: AbortSignal.timeout(8000) });
  const len = Number(upstream.headers.get('content-length') ?? 0);
  if (len > 8 * 1024 * 1024) return 0;
  const body = await upstream.arrayBuffer();
  return body.byteLength;
}
async function after(s: string) {
  const r = await proxyImage(s);
  return r.ok ? r.body.byteLength : -1;
}
function oversizedFetch(): typeof fetch {                 // 9 MB, no content-length
  return (async () => {
    let sent = 0;
    return new Response(new ReadableStream<Uint8Array>({
      pull(c) { if (sent >= 9 * 1024 * 1024) return c.close(); const n = 64 * 1024; sent += n; c.enqueue(new Uint8Array(n)); },
    }, { highWaterMark: 0 }), { headers: { 'content-type': 'image/jpeg' } });
  }) as unknown as typeof fetch;
}
async function measure(label: string, fn: () => Promise<number>) {
  const cpu: number[] = []; let bytes = 0;
  for (let i = 0; i < N; i++) {
    const t = process.cpuUsage(); bytes = await fn(); const d = process.cpuUsage(t);
    cpu.push((d.user + d.system) / 1000);
  }
  cpu.sort((a, b) => a - b);
  console.log(`${label.padEnd(44)} median CPU ${cpu[Math.floor(N / 2)].toFixed(1)} ms  (min ${cpu[0].toFixed(1)}, max ${cpu[N - 1].toFixed(1)})  bytes held ${bytes}`);
}
await measure('BEFORE real 10332 original', () => before(src));
await measure('AFTER  real 10332 (1000x800 resize)', () => after(src));
await measure('BEFORE 9 MB fixture, no content-length', async () => {
  const r = await oversizedFetch()('x'); const b = await r.arrayBuffer(); return b.byteLength > 8 * 1024 * 1024 ? 0 : b.byteLength;
});
await measure('AFTER  9 MB fixture, no content-length', async () => {
  const r = await proxyImage('https://www.lego.com/x.jpg', oversizedFetch()); return r.ok ? r.body.byteLength : -(r.bytesRead ?? 0);
});
