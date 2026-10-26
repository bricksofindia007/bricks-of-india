// The backup login gets read access to the boi_backups schema (the before-fix snapshots), with the same read rule, and never
// to security copies. It is held; the rollback removes exactly what it adds.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lintFile, parseHeader } from '../scripts/ci/db-migrate.mjs';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const MIG = 'supabase/migrations/20261026140000_backup_reader_boi_backups.sql';
const migration = read(MIG);
const rollback = read('supabase/rollbacks/20261026140000_backup_reader_boi_backups.down.sql');

describe('backup login: boi_backups schema', () => {
  it('the migration has a numeric issue header and passes the runner lint', () => {
    expect(parseHeader(migration).issue).toBe(820);
    expect(lintFile('migration', '20261026140000_backup_reader_boi_backups.sql', migration)).toEqual([]);
  });
  it('it grants usage on the schema, SELECT on its tables, and SELECT by default for later tables', () => {
    expect(migration).toMatch(/GRANT USAGE ON SCHEMA boi_backups TO backup_reader;/);
    expect(migration).toMatch(/GRANT SELECT ON ALL TABLES IN SCHEMA boi_backups TO backup_reader;/);
    expect(migration).toMatch(/ALTER DEFAULT PRIVILEGES IN SCHEMA boi_backups GRANT SELECT ON TABLES TO backup_reader;/);
  });
  it('the read policy has the same name and shape as the earlier backup login rules', () => {
    expect(migration).toMatch(/CREATE POLICY "backup_reader read" ON %I\.%I FOR SELECT TO backup_reader USING \(true\)/);
  });
  it('security copies are taken back and the self-check rejects them', () => {
    expect(migration).toMatch(/tablename LIKE 'login_attempts%' OR tablename LIKE 'admin_sessions%'/);
    expect(migration).toMatch(/REVOKE ALL ON boi_backups\.%I FROM backup_reader/);
    expect(migration).toMatch(/RAISE EXCEPTION 'backup_reader holds more than the intended read access/);
  });
  it('the rollback removes the policy, the default privilege, the grants and the usage, and nothing else', () => {
    expect(rollback).toMatch(/ALTER DEFAULT PRIVILEGES IN SCHEMA boi_backups REVOKE SELECT ON TABLES FROM backup_reader;/);
    expect(rollback).toMatch(/REVOKE SELECT ON ALL TABLES IN SCHEMA boi_backups FROM backup_reader;/);
    expect(rollback).toMatch(/REVOKE USAGE ON SCHEMA boi_backups FROM backup_reader;/);
    expect(rollback).not.toMatch(/DROP TABLE|TRUNCATE|DELETE FROM|DROP ROLE/i);
  });
  it('it is held: the migration says it is not applied', () => {
    expect(migration).toMatch(/NOT APPLIED: staging rehearsal first/);
  });
});
