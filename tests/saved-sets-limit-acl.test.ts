// Saved sets limit function: no public execute (order 1130, addendum 23:31 item G, issue 828).
// The migration revokes execute from PUBLIC, anon and authenticated; its rollback restores the default; the
// migration that created the function (20261024230000, applied on staging) is not edited.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lintFile, parseHeader } from '../scripts/ci/db-migrate.mjs';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const MIG = 'supabase/migrations/20261027130000_revoke_saved_sets_limit_execute.sql';
const migration = read(MIG);
const rollback = read('supabase/rollbacks/20261027130000_revoke_saved_sets_limit_execute.down.sql');

describe('the revoke migration', () => {
  it('has a numeric issue header and passes the runner lint', () => {
    expect(parseHeader(migration).issue).toBe(828);
    expect(lintFile('migration', '20261027130000_revoke_saved_sets_limit_execute.sql', migration)).toEqual([]);
  });
  it('revokes execute from public, anon and authenticated, and grants nothing', () => {
    expect(migration).toMatch(/revoke all on function public\.saved_sets_limit\(\) from public, anon, authenticated;/);
    expect(migration).not.toMatch(/^grant /m);
  });
  it('ends with a self-check that fails if a browser role or PUBLIC keeps execute', () => {
    expect(migration).toMatch(/information_schema\.routine_privileges/);
    expect(migration).toMatch(/upper\(grantee\) in \('ANON', 'AUTHENTICATED', 'PUBLIC'\)/);
    expect(migration).toMatch(/raise exception 'saved_sets_limit: anon, authenticated or public still has execute'/);
  });
  it('sorts after the last applied migration in the held set', () => {
    expect('20261027130000_revoke_saved_sets_limit_execute.sql' > '20261026140000_backup_reader_boi_backups.sql').toBe(true);
  });
});

describe('the rollback', () => {
  it('restores the default PUBLIC execute and nothing else', () => {
    expect(rollback).toMatch(/grant execute on function public\.saved_sets_limit\(\) to public;/);
    expect(rollback).not.toMatch(/^revoke /im);
  });
});

describe('the migration that created the function is untouched', () => {
  it('20261024230000 still has no revoke for the function', () => {
    const created = read('supabase/migrations/20261024230000_account_storage.sql');
    expect(created).toMatch(/create or replace function public\.saved_sets_limit\(\)/);
    expect(created).not.toMatch(/revoke[^;]*saved_sets_limit/i);
  });
});
