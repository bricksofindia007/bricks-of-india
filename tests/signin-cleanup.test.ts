// Sign-in cleanup (issue 817): the job skips cleanly only for absent-object errors; the migration uses the approved windows,
// is service-role only, and its rollback removes only the function.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isAbsentError, CLEANUP_RPC, CODE_KEEP_HOURS_AFTER_EXPIRY, SESSION_KEEP_DAYS_AFTER_END } from '../scripts/lib/sign-in-cleanup.mjs';
import { lintFile, parseHeader } from '../scripts/ci/db-migrate.mjs';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const MIG = 'supabase/migrations/20261026130000_signin_cleanup.sql';
const migration = read(MIG);
const rollback = read('supabase/rollbacks/20261026130000_signin_cleanup.down.sql');
const job = read('scripts/retention-cleanup.mjs');

describe('the job skips only when the function or tables are absent', () => {
  it('an undefined function, an undefined table, or a missing schema-cache entry means "not there yet"', () => {
    expect(isAbsentError({ code: '42883', message: 'function does not exist' })).toBe(true);
    expect(isAbsentError({ code: '42P01', message: 'relation "sign_in_codes" does not exist' })).toBe(true);
    expect(isAbsentError({ code: 'PGRST202', message: 'Could not find the function' })).toBe(true);
    expect(isAbsentError({ message: 'Could not find the function public.cleanup_sign_in_rows in the schema cache' })).toBe(true);
  });
  it('any other error is a real failure and stops the run', () => {
    expect(isAbsentError({ code: '42501', message: 'permission denied for function cleanup_sign_in_rows' })).toBe(false);
    expect(isAbsentError({ code: '08006', message: 'connection reset by peer' })).toBe(false);
    expect(isAbsentError(null)).toBe(false);
  });
  it('the job calls the function, before the rejected-drafts step, and logs the result', () => {
    expect(job).toMatch(/import \{ CLEANUP_RPC, isAbsentError \} from '\.\/lib\/sign-in-cleanup\.mjs'/);
    expect(job).toMatch(/supabase\.rpc\(CLEANUP_RPC, \{ p_dry_run: DRY_RUN \}\)/);
    expect(job).toMatch(/await runRetention\(\);\s*await signInCleanup\(\);\s*await purgeRejectedDrafts\(\);/);
  });
});

describe('the approved windows', () => {
  it('codes 24 hours after expiry, sends before today, sessions 30 days after they ended', () => {
    expect(CODE_KEEP_HOURS_AFTER_EXPIRY).toBe(24);
    expect(SESSION_KEEP_DAYS_AFTER_END).toBe(30);
    expect(migration).toMatch(/expires_at < now\(\) - interval '24 hours'/);
    expect(migration).toMatch(/day_key < today/);
    expect(migration).toMatch(/interval '30 days'/);
    expect(CLEANUP_RPC).toBe('cleanup_sign_in_rows');
  });
});

describe('the migration', () => {
  it('has a numeric issue header and passes the runner lint', () => {
    expect(parseHeader(migration).issue).toBe(817);
    expect(lintFile('migration', '20261026130000_signin_cleanup.sql', migration)).toEqual([]);
  });
  it('is service-role only: no grant to anon, authenticated or public', () => {
    expect(migration).toMatch(/revoke all on function public\.cleanup_sign_in_rows\(boolean\) from public, anon, authenticated;/);
    expect(migration).toMatch(/grant execute on function public\.cleanup_sign_in_rows\(boolean\) to service_role;/);
    expect(migration).not.toMatch(/grant execute[^;]*to (anon|authenticated|public)\b/);
  });
  it('a dry run changes nothing: the deletes are only in the else branch', () => {
    const elsePart = migration.slice(migration.indexOf('else'));
    expect(elsePart).toMatch(/delete from public\.sign_in_codes/);
    const ifPart = migration.slice(migration.indexOf('if p_dry_run then'), migration.indexOf('else'));
    expect(ifPart).not.toMatch(/delete /);
  });
  it('it is held: the migration says it is not applied', () => {
    expect(migration).toMatch(/NOT APPLIED: staging rehearsal first/);
  });
});

describe('the rollback', () => {
  it('removes only the function', () => {
    expect(rollback).toMatch(/drop function if exists public\.cleanup_sign_in_rows\(boolean\);/);
    expect(rollback).not.toMatch(/delete from|drop table|truncate/i);
  });
});
