// Signed admin form fields (B6b, 17 Oct 2026). Each state-changing admin form carries a hidden field
// derived from the admin session token and the form's action name. An action accepts a form only when the
// field matches, so a form from another page, another session or another action cannot be replayed.
import { createHmac, timingSafeEqual } from 'node:crypto';

/** The field value for one action in one session. Empty when there is no session or no password. */
export function adminFormToken(sessionToken: string | undefined, action: string): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || !sessionToken) return '';
  const key = createHmac('sha256', pw).update('boi-admin-form-v1').digest();
  return createHmac('sha256', key).update(`${action}|${sessionToken}`).digest('base64url');
}

/** True only when the submitted field matches the value for this action in this session. */
export function adminFormTokenValid(provided: FormDataEntryValue | null, sessionToken: string | undefined, action: string): boolean {
  if (typeof provided !== 'string' || provided === '') return false;
  const expected = adminFormToken(sessionToken, action);
  if (!expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
