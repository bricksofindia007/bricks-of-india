// Sign-in attempt limit (in-app). After 5 failed attempts in 15 minutes for a key, the key is blocked for
// 15 minutes (owner, 24 Oct 2026, 18:08 IST: "agreed to your recommendation on all"; the limit is the recommendation). A key is a hash of the client address, and one for the account. While blocked, the password is
// not checked. If the counter cannot be read, sign-in is refused (fails closed). The response never says
// that a limit was hit: the caller returns the same answer as a wrong password.
import { createHash } from 'node:crypto';
import { createServerClient } from './supabase';

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_BLOCK_MS = 15 * 60 * 1000;

export type AttemptRow = { failures: number; window_start: number; blocked_until: number | null };

/** The row after one more failed attempt. A new window starts when the old one has run out. */
export function afterFailure(row: AttemptRow | null, now: number): AttemptRow {
  if (!row || now - row.window_start >= LOGIN_WINDOW_MS) return { failures: 1, window_start: now, blocked_until: null };
  const failures = row.failures + 1;
  return { failures, window_start: row.window_start, blocked_until: failures >= LOGIN_MAX_FAILURES ? now + LOGIN_BLOCK_MS : null };
}

export function isBlocked(row: AttemptRow | null, now: number): boolean {
  return !!row && row.blocked_until != null && row.blocked_until > now;
}

/** The salted key for one client address or one account. Nothing identifying is stored. */
export function limitKey(kind: 'ip' | 'account', value: string): string {
  return createHash('sha256').update(`boi-login-limit-v1|${kind}|${value}`).digest('hex');
}

/** Any of the keys is blocked, or the counter cannot be read. */
export async function loginBlocked(keys: string[], now: number = Date.now()): Promise<boolean> {
  try {
    const { data, error } = await createServerClient()
      .from('login_attempts')
      .select('key, window_start, failures, blocked_until')
      .in('key', keys);
    if (error) return true; // fail closed
    for (const r of data ?? []) {
      if (isBlocked({ failures: r.failures, window_start: Date.parse(r.window_start), blocked_until: r.blocked_until ? Date.parse(r.blocked_until) : null }, now)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

/** Counts one failed attempt for each key. */
export async function recordLoginFailure(keys: string[], now: number = Date.now()): Promise<void> {
  const sb = createServerClient();
  for (const key of keys) {
    const { data } = await sb.from('login_attempts').select('failures, window_start, blocked_until').eq('key', key).maybeSingle();
    const prev: AttemptRow | null = data
      ? { failures: data.failures, window_start: Date.parse(data.window_start), blocked_until: data.blocked_until ? Date.parse(data.blocked_until) : null }
      : null;
    const next = afterFailure(prev, now);
    await sb.from('login_attempts').upsert({
      key,
      failures: next.failures,
      window_start: new Date(next.window_start).toISOString(),
      blocked_until: next.blocked_until ? new Date(next.blocked_until).toISOString() : null,
    });
  }
}

/** A correct sign-in clears the counts for its keys. */
export async function clearLoginFailures(keys: string[]): Promise<void> {
  await createServerClient().from('login_attempts').delete().in('key', keys);
}
