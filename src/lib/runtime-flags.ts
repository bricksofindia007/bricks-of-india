// FP2.4 runtime flags (design FP1.1 §5). One KV value, `flag:v1` (the key
// boi-scheduler already reads for dispatch_enabled), cached 60 s per isolate.
// Written only through boi-scheduler's signed /publish (a Tier 2 flip), never
// by a deploy. Build-time UI flags stay in src/lib/feature-flags.ts.
//
// Safe defaults apply when KV is unreachable, the key is missing or malformed,
// or a flag is absent. Each default is the state that can't do harm:
//   snapshot_read       false  (today's Supabase path)
//   alerts_enabled      false  (never send on an unknown state)
//   email_stream:*      transactional true (sign-in must work), ops true, alerts/newsletter false
// Retailer display is NOT a KV flag: stores.display_enabled (DB) is the only
// source, mirrored into snapshots by the publisher (§5 reconciliation).

import type { KvLike } from './snapshot/reader';
import { KEYS } from './snapshot/format';

export type RuntimeFlags = {
  snapshot_read: boolean;
  alerts_enabled: boolean;
  'email_stream:transactional': boolean;
  'email_stream:alerts': boolean;
  'email_stream:newsletter': boolean;
  'email_stream:ops': boolean;
};

export const SAFE_DEFAULTS: Readonly<RuntimeFlags> = Object.freeze({
  snapshot_read: false,
  alerts_enabled: false,
  'email_stream:transactional': true,
  'email_stream:alerts': false,
  'email_stream:newsletter': false,
  'email_stream:ops': true,
});

let cached: { at: number; flags: RuntimeFlags } | null = null;
export function _resetFlagCache() { cached = null; }

/** Only booleans override a default; anything else in the value is ignored. */
export function parseFlags(raw: unknown): RuntimeFlags {
  const out = { ...SAFE_DEFAULTS } as RuntimeFlags;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const k of Object.keys(SAFE_DEFAULTS) as (keyof RuntimeFlags)[]) {
    const v = (raw as Record<string, unknown>)[k];
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

export async function getRuntimeFlags(kv: KvLike | null | undefined, nowMs = Date.now()): Promise<RuntimeFlags> {
  if (cached && nowMs - cached.at < 60_000) return cached.flags;
  let flags: RuntimeFlags = { ...SAFE_DEFAULTS };
  if (kv) {
    try { flags = parseFlags(await kv.get(KEYS.flags, 'json')); } catch { /* unreachable -> safe defaults */ }
  }
  cached = { at: nowMs, flags };
  return flags;
}
