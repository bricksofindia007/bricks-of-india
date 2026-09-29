import { describe, it, expect } from 'vitest';
import { sign, verifyAndParse, MAX_WRITES } from '../workers/boi-scheduler/src/auth';

const KEY = 'k'.repeat(64);
const NOW = 1_790_000_000;
const NONCE = 'n0nce-abcdefghijklmnop';
async function req(body: unknown, over: Partial<{ ts: string; nonce: string; sig: string; key: string }> = {}) {
  const b = typeof body === 'string' ? body : JSON.stringify(body);
  const ts = over.ts ?? String(NOW);
  const nonce = over.nonce ?? NONCE;
  const sig = over.sig ?? (await sign(KEY, ts, nonce, b));
  return verifyAndParse({ key: over.key ?? KEY, ts, nonce, sig, body: b, nowS: NOW });
}
const good = { writes: [{ key: 'meta:heartbeat', value: { cycle_id: 'c1' } }, { key: 'set:10332:v1', value: { v: 1 } }, { key: 'cat:10332:v1', value: { v: 1 } }] };

describe('boi-scheduler auth (FP1.1 PR 1, P5 Step 5)', () => {
  it('accepts a correctly signed request and writes meta:heartbeat LAST', async () => {
    const v = await req(good);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.writes.map((w) => w.key)).toEqual(['set:10332:v1', 'cat:10332:v1', 'meta:heartbeat']);
  });
  it('rejects a wrong signature, a tampered body, and a missing key', async () => {
    expect((await req(good, { sig: 'f'.repeat(64) })).ok).toBe(false);
    const sig = await sign(KEY, String(NOW), NONCE, JSON.stringify(good));
    expect((await verifyAndParse({ key: KEY, ts: String(NOW), nonce: NONCE, sig, body: JSON.stringify({ ...good, x: 1 }), nowS: NOW })).ok).toBe(false);
    expect((await req(good, { key: '' })).ok).toBe(false);
  });
  it('rejects requests older or newer than 5 minutes', async () => {
    expect((await req(good, { ts: String(NOW - 301) })).ok).toBe(false);
    expect((await req(good, { ts: String(NOW + 301) })).ok).toBe(false);
    expect((await req(good, { ts: String(NOW - 299) })).ok).toBe(true);
  });
  it('rejects a malformed nonce (reuse is checked against KV in the Worker)', async () => {
    expect((await req(good, { nonce: 'short' })).ok).toBe(false);
  });
  it('allows only set:, list:, meta:, flag:, cat: keys, and never the Worker-owned meta keys', async () => {
    for (const key of ['secret:x', 'setx:1', 'meta:nonce:abc', 'meta:scheduler:heartbeat', 'meta:dispatch:toycra', 'list:../../x']) {
      expect((await req({ writes: [{ key, value: 1 }] })).ok, key).toBe(false);
    }
    for (const key of ['list:deals:v1', 'flag:v1', 'meta:heartbeat']) expect((await req({ writes: [{ key, value: 1 }] })).ok, key).toBe(true);
  });
  it('enforces the size caps and rejects duplicates', async () => {
    expect((await req({ writes: [{ key: 'set:1:v1', value: 'x'.repeat(70_000) }] })).ok).toBe(false);
    expect((await req({ writes: Array.from({ length: MAX_WRITES + 1 }, (_, i) => ({ key: `set:${i}:v1`, value: 1 })) })).ok).toBe(false);
    expect((await req({ writes: [{ key: 'set:1:v1', value: 1 }, { key: 'set:1:v1', value: 2 }] })).ok).toBe(false);
    expect((await req('not json')).ok).toBe(false);
  });
});
