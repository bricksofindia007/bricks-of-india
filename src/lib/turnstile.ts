// Human check for the admin sign-in form (Turnstile). Used only when FEATURE_FLAGS.adminTurnstile is on.
// Fails closed: no secret, no token, a network error or a refusal all return false. The secret and the token
// are never logged or returned.

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_SECRET_NAME = 'TURNSTILE_SECRET_KEY';
export const TURNSTILE_SITE_KEY_NAME = 'NEXT_PUBLIC_TURNSTILE_SITE_KEY';

/** Pure. Whether the human check is required for sign-in. */
export function turnstileRequired(flags: { adminTurnstile: boolean }): boolean {
  return flags.adminTurnstile === true;
}

/** Asks the verification service whether the token is valid. Returns false on any failure. */
export async function verifyTurnstile(
  token: string,
  remoteIp: string | undefined,
  secret: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!secret || !token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp);
    const res = await fetchImpl(TURNSTILE_VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: unknown };
    return data.success === true;
  } catch {
    return false;
  }
}
