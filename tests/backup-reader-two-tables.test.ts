// The backup login gets SELECT on two more tables, with the same read policy as its earlier rules. The security tables stay
// unreadable. The change is held; its rollback removes exactly what it adds.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lintFile, parseHeader } from '../scripts/ci/db-migrate.mjs';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const MIG = 'supabase/migrations/20261026110000_backup_reader_two_tables.sql';
const migration = read(MIG);
const rollback = read('supabase/rollbacks/20261026110000_backup_reader_two_tables.down.sql');
const earlier = read('supabase/migrations/20261003120000_backup_reader_role.sql');

describe('backup login: two more tables', () => {
  it('the migration has a numeric issue header and passes the runner lint', () => {
    expect(parseHeader(migration).issue).toBe(810);
    expect(lintFile('migration', '20261026110000_backup_reader_two_tables.sql', migration)).toEqual([]);
  });
  it('the grant is SELECT on exactly the two tables', () => {
    expect(migration).toMatch(/GRANT SELECT ON public\.ai_model_usage, public\.usd_inr_rate TO backup_reader;/);
    expect(migration.match(/GRANT /g)?.length).toBe(1);
  });
  it('it never grants the security tables', () => {
    const grants = migration.split('\n').filter((l) => /^\s*GRANT /.test(l)).join('\n');
    expect(grants).not.toMatch(/login_attempts|admin_sessions/);
  });
  it('the read policy has the same name and shape as the earlier backup login rules', () => {
    expect(earlier).toMatch(/CREATE POLICY "backup_reader read" ON %I\.%I FOR SELECT TO backup_reader USING \(true\)/);
    expect(migration).toMatch(/CREATE POLICY "backup_reader read" ON public\.%I FOR SELECT TO backup_reader USING \(true\)/);
  });
  it('the self-check rolls the whole migration back on any extra grant', () => {
    expect(migration).toMatch(/RAISE EXCEPTION 'backup_reader holds more than the intended read access/);
  });
  it('the rollback drops both policies and revokes both grants, and nothing else', () => {
    expect(rollback).toMatch(/DROP POLICY IF EXISTS "backup_reader read" ON public\.ai_model_usage;/);
    expect(rollback).toMatch(/DROP POLICY IF EXISTS "backup_reader read" ON public\.usd_inr_rate;/);
    expect(rollback).toMatch(/REVOKE SELECT ON public\.ai_model_usage, public\.usd_inr_rate FROM backup_reader;/);
    expect(rollback).not.toMatch(/login_attempts|admin_sessions|DROP ROLE/);
  });
  it('the change is held: the migration says it is not applied', () => {
    expect(migration).toMatch(/NOT APPLIED: staging rehearsal first/);
  });
});
