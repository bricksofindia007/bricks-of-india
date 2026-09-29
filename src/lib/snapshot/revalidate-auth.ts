// FP1.6 §3: auth + validation for POST /api/revalidate. Pure (tested in
// tests/snapshot-revalidate.test.ts). Same signing scheme as boi-scheduler
// (workers/boi-scheduler/src/auth.ts) with its own key, SITE_REVALIDATE_HMAC_KEY:
//   X-BOI-Ts, X-BOI-Nonce, X-BOI-Sig = hex(HMAC-SHA256(key, `${ts}.${nonce}.${hex(sha256(body))}`))
//   body: {"paths":["/sets/10305-lion-knights-castle", ...], "tags":["set:10305", ...]}  (<= 100 each)
// Only set pages and set tags can be revalidated. Any failure -> 401, nothing revalidated.
import { sign, MAX_SKEW_S } from '../../../workers/boi-scheduler/src/auth';

export const MAX_ITEMS = 100;
export const PATH_RE = /^\/sets\/[a-z0-9][a-z0-9-]{0,150}$/;
export const TAG_RE = /^set:[A-Za-z0-9-]{1,20}$/;

function eqHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export type RevalidateVerdict = { ok: true; paths: string[]; tags: string[] } | { ok: false; reason: string };

export async function verifyRevalidate(o: { key?: string; ts: string | null; nonce: string | null; sig: string | null; body: string; nowS: number; seenNonce: (n: string) => boolean }): Promise<RevalidateVerdict> {
  if (!o.key || o.key.length < 32) return { ok: false, reason: 'no key configured' };
  if (!o.ts || !/^\d{9,11}$/.test(o.ts) || Math.abs(o.nowS - Number(o.ts)) > MAX_SKEW_S) return { ok: false, reason: 'timestamp' };
  if (!o.nonce || !/^[A-Za-z0-9_-]{16,64}$/.test(o.nonce)) return { ok: false, reason: 'nonce' };
  if (!o.sig || !/^[0-9a-f]{64}$/.test(o.sig)) return { ok: false, reason: 'signature format' };
  if (o.body.length > 64_000) return { ok: false, reason: 'body too large' };
  if (!eqHex(await sign(o.key, o.ts, o.nonce, o.body), o.sig)) return { ok: false, reason: 'signature' };
  if (o.seenNonce(o.nonce)) return { ok: false, reason: 'reused nonce' };
  let b: any; try { b = JSON.parse(o.body); } catch { return { ok: false, reason: 'json' }; }
  const paths = Array.isArray(b?.paths) ? b.paths : [], tags = Array.isArray(b?.tags) ? b.tags : [];
  if (!paths.length && !tags.length) return { ok: false, reason: 'empty' };
  if (paths.length > MAX_ITEMS || tags.length > MAX_ITEMS) return { ok: false, reason: 'too many' };
  if (!paths.every((p: unknown) => typeof p === 'string' && PATH_RE.test(p))) return { ok: false, reason: 'path not allowed' };
  if (!tags.every((t: unknown) => typeof t === 'string' && TAG_RE.test(t))) return { ok: false, reason: 'tag not allowed' };
  return { ok: true, paths, tags };
}

// Nonces are remembered per isolate for the skew window. A replay that reaches a
// different isolate inside those 5 minutes can only re-render the same <= 100 set
// pages again (idempotent), so no KV write access is given to the site (FP1.1 §6).
const seen = new Map<string, number>();
export function rememberNonce(nonce: string, nowS: number): boolean {
  for (const [n, t] of seen) if (nowS - t > MAX_SKEW_S) seen.delete(n);
  if (seen.has(nonce)) return true;
  seen.set(nonce, nowS);
  return false;
}
