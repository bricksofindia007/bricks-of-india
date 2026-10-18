// Staging read-only mode, in a module with no imports so client-side code can use it too.
// STAGING_READ_ONLY=1 is set only in the staging Worker config (wrangler.staging.jsonc).

/** True only in staging read-only mode. Production never sets the flag. */
export function stagingReadOnly(): boolean {
  return process.env.STAGING_READ_ONLY === '1';
}

/**
 * A read the public key cannot do (for example the summary view or a price table) returns an empty
 * result in staging, so the staging build and pages complete. Outside staging the error is thrown
 * as before. Returns true when the caller should treat the read as empty.
 */
export function emptyOnStagingError(error: unknown): boolean {
  if (!error) return false;
  if (stagingReadOnly()) return true;
  throw error;
}
