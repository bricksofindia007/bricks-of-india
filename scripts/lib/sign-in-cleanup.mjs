// Sign-in cleanup (issue 817): the name of its database function and the check for "not there yet". Pure, so it is tested.
// The retention job calls the function, and skips it cleanly while the function or its tables do not exist in the database.
export const CLEANUP_RPC = 'cleanup_sign_in_rows';

// Codes: removed 24 hours after they expire. Sends: removed when their day is before today (UTC). Sessions: removed 30 days
// after they ended (revoked, or expired if never revoked). The windows are the approved ones (order 1058, item 4).
export const CODE_KEEP_HOURS_AFTER_EXPIRY = 24;
export const SESSION_KEEP_DAYS_AFTER_END = 30;

// True when the error only means the function or its tables are absent (not yet migrated). Any other error is a real failure.
// Postgres: 42883 undefined_function, 42P01 undefined_table. PostgREST: PGRST202 (no such function in the schema cache).
export function isAbsentError(error) {
  if (!error) return false;
  const code = String(error.code ?? '');
  if (code === '42883' || code === '42P01' || code === 'PGRST202') return true;
  const msg = String(error.message ?? '');
  return /does not exist|could not find the function|schema cache/i.test(msg) && /cleanup_sign_in_rows|sign_in_codes|sign_in_sends|account_sessions/i.test(msg);
}
