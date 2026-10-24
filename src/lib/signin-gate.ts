// The gate for sign-in routes and pages. Off unless BOTH flags are on and the server hash key is provisioned.
// Failure behaviour: any missing piece means 404 and no work, never a half-working sign-in.
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { getSecret } from '@/lib/get-secret';

/** The server secret for keyed hashes. Named here only; its value is never read into logs or responses. */
export const SIGN_IN_HASH_KEY_NAME = 'SIGN_IN_HASH_KEY';

export function signInOn(): boolean {
  if (!FEATURE_FLAGS.accountsEnabled || !FEATURE_FLAGS.signInByEmail) return false;
  return Boolean(getSecret(SIGN_IN_HASH_KEY_NAME));
}

export function signInHashKey(): string {
  return getSecret(SIGN_IN_HASH_KEY_NAME) ?? '';
}
