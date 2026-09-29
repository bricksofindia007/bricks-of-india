// boi-scheduler request auth + validation (FP1.1 §2, P5 Step 5). Pure functions; unit-tested in
// tests/boi-scheduler.test.ts. Runs on Workers (WebCrypto) and Node 20+ (globalThis.crypto).
//
// Signed request: POST /publish
//   X-BOI-Ts:    unix seconds
//   X-BOI-Nonce: 16-64 chars [A-Za-z0-9_-], never reused (the Worker remembers each for 10 min)
//   X-BOI-Sig:   hex(HMAC-SHA256(key, `${ts}.${nonce}.${hex(sha256(body))}`))
//   body:        {"writes":[{"key":"set:10332:v1","value":{...}}, ...]}
// Any failure -> 401 and nothing is written (every check runs before the first KV write).

export const MAX_SKEW_S = 300;               // reject requests older (or newer) than 5 minutes
export const MAX_BODY_BYTES = 1_048_576;     // 1 MiB per request
export const MAX_WRITES = 500;               // keys per request (KV allows 1,000 ops per invocation)
export const MAX_VALUE_BYTES = 65_536;       // per value; the largest real value (~9 KB) is far below
// Writable key prefixes (P5 Step 5: set:, list:, meta:, flag:; plus cat: from Amendment A1, P6 2c).
// Keys the Worker itself owns (nonces, its own heartbeat, dispatch notes) can't be written by clients.
export const KEY_RE = /^(set|list|meta|flag|cat):[A-Za-z0-9:._-]{1,200}$/;
export const RESERVED_RE = /^meta:(nonce|scheduler|dispatch)/;

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(body: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(body)));
}

export async function sign(key: string, ts: string, nonce: string, body: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(`${ts}.${nonce}.${await sha256Hex(body)}`)));
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export type Write = { key: string; value: unknown };
export type Verdict = { ok: true; writes: Write[] } | { ok: false; reason: string };

/** Everything except the nonce-reuse check (which needs storage): header shape, clock skew,
 *  signature, body size, JSON shape, key prefixes, per-value size. */
export async function verifyAndParse(opts: { key: string | undefined; ts: string | null; nonce: string | null; sig: string | null; body: string; nowS: number }): Promise<Verdict> {
  const { key, ts, nonce, sig, body, nowS } = opts;
  if (!key || key.length < 32) return { ok: false, reason: 'no signing key configured' };
  if (!ts || !/^\d{9,11}$/.test(ts)) return { ok: false, reason: 'bad timestamp' };
  if (Math.abs(nowS - Number(ts)) > MAX_SKEW_S) return { ok: false, reason: 'stale or future timestamp' };
  if (!nonce || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce)) return { ok: false, reason: 'bad nonce' };
  if (!sig || !/^[0-9a-f]{64}$/.test(sig)) return { ok: false, reason: 'bad signature format' };
  if (enc.encode(body).length > MAX_BODY_BYTES) return { ok: false, reason: 'body too large' };
  if (!timingSafeEqualHex(await sign(key, ts, nonce, body), sig)) return { ok: false, reason: 'signature mismatch' };
  let parsed: any;
  try { parsed = JSON.parse(body); } catch { return { ok: false, reason: 'body is not JSON' }; }
  const writes = parsed?.writes;
  if (!Array.isArray(writes) || writes.length === 0) return { ok: false, reason: 'no writes' };
  if (writes.length > MAX_WRITES) return { ok: false, reason: 'too many writes' };
  const seen = new Set<string>();
  for (const w of writes) {
    if (typeof w?.key !== 'string' || !KEY_RE.test(w.key) || RESERVED_RE.test(w.key)) return { ok: false, reason: `key not allowed: ${String(w?.key).slice(0, 60)}` };
    if (seen.has(w.key)) return { ok: false, reason: `duplicate key: ${w.key}` };
    seen.add(w.key);
    if (w.value === undefined) return { ok: false, reason: `missing value: ${w.key}` };
    if (enc.encode(JSON.stringify(w.value)).length > MAX_VALUE_BYTES) return { ok: false, reason: `value too large: ${w.key}` };
  }
  // meta:heartbeat always last, so a reader never sees a heartbeat newer than the data it describes.
  const ordered = [...writes.filter((w: Write) => w.key !== 'meta:heartbeat'), ...writes.filter((w: Write) => w.key === 'meta:heartbeat')];
  return { ok: true, writes: ordered };
}
