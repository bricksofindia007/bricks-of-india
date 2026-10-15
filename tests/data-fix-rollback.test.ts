import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FIX_NAME, ORIGINAL, WAIT_BLOCK, BUY_BLOCK,
  isValidBackupTable, checkRollbackTarget, checkGuardValues, decideRollbackAction, buildRollbackSql,
} from '../scripts/ci/data-fix-rollback.mjs';
import { PROD_REF } from '../scripts/ci/prod-reference.mjs';
import { DISCLAIMER_TEXT } from '../src/lib/review-disclaimer';

const root = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const BT = 'public__reviews__20261014T123456';
const CLEAN_STG = 'postgresql://postgres.abcdefghijklmnopqrst:placeholder@pooler.example.com:6543/postgres';
const PROD_POOLER = `postgresql://postgres.${PROD_REF}:placeholder@pooler.example.com:6543/postgres`;

describe('rollback: restores from the backup, byte for byte', () => {
  const sql = buildRollbackSql(BT);

  it('restores content from the backup table, not by reversing an edit', () => {
    expect(sql).toMatch(new RegExp(`FROM boi_backups\\."${BT.toLowerCase()}" b`));
    expect(sql).toMatch(/SET content = b\.content/);
    expect(sql).not.toMatch(/regexp_replace/);
  });

  it('only restores a row whose live content, minus the inserted block, equals the backed-up content', () => {
    expect(sql).toContain(`replace(r.content, E'\\n\\n' || '${WAIT_BLOCK.replace(/'/g, "''")}', '') = b.content`);
    expect(sql).toContain(`replace(r.content, E'\\n\\n' || '${BUY_BLOCK.replace(/'/g, "''")}', '') = b.content`);
  });

  it('checks the restored rows are exactly 52 WAIT and 6 BUY NOW, and the guards match the originals', () => {
    expect(sql).toContain(`expected ${ORIGINAL.wait.count}; rolled back`);
    expect(sql).toContain(`expected ${ORIGINAL.buy.count}; rolled back`);
    expect(sql).toContain(ORIGINAL.wait.guard);
    expect(sql).toContain(ORIGINAL.buy.guard);
    expect(ORIGINAL.wait.count).toBe(52);
    expect(ORIGINAL.buy.count).toBe(6);
  });

  it('is one block that raises on any failed check, so the transaction rolls back', () => {
    expect(sql.match(/^DO \$rollback\$/gm)?.length).toBe(1);
    expect(sql).toMatch(/RAISE EXCEPTION/);
  });
});

describe('double rollback', () => {
  it('a second run finds the originals and changes nothing', () => {
    expect(decideRollbackAction({ wait: { count: 52, guard: ORIGINAL.wait.guard }, buy: { count: 6, guard: ORIGINAL.buy.guard } })).toBe('noop');
    expect(buildRollbackSql(BT)).toContain('already restored: no review changed');
  });

  it('when the fix is in place, the rollback is needed', () => {
    expect(decideRollbackAction({ wait: { count: 0, guard: 'x' }, buy: { count: 0, guard: 'y' } })).toBe('restore');
  });
});

describe('re-apply after a rollback', () => {
  it('removes the fix ledger row so the fix can run again', () => {
    expect(buildRollbackSql(BT)).toContain(`DELETE FROM supabase_migrations.data_fix_log WHERE name = '${FIX_NAME}'`);
  });

  it('the fix file still asserts the same originals, so a re-apply starts from the same place', () => {
    const fix = read('supabase/data-fixes/586-review-standard-line.sql');
    expect(fix).toContain(ORIGINAL.wait.guard);
    expect(fix).toContain(ORIGINAL.buy.guard);
    expect(fix).toMatch(/= 52 and /);
    expect(fix).toMatch(/= 6 and /);
  });

  it('the inserted sentences are the same in the fix, the rollback and the disclaimer code', () => {
    const fix = read('supabase/data-fixes/586-review-standard-line.sql');
    expect(fix).toContain(WAIT_BLOCK.replace(/'/g, "''"));
    expect(fix).toContain(BUY_BLOCK.replace(/'/g, "''"));
    expect(DISCLAIMER_TEXT.wait_unlisted).toBe(WAIT_BLOCK);
    expect(DISCLAIMER_TEXT.buy).toBe(BUY_BLOCK);
  });
});

describe('guard failure', () => {
  it('a wrong count or guard is reported', () => {
    expect(checkGuardValues({ wait: { count: 52, guard: ORIGINAL.wait.guard }, buy: { count: 6, guard: ORIGINAL.buy.guard } })).toEqual([]);
    expect(checkGuardValues({ wait: { count: 51, guard: ORIGINAL.wait.guard }, buy: { count: 6, guard: ORIGINAL.buy.guard } })).toHaveLength(1);
    expect(checkGuardValues({ wait: { count: 52, guard: 'bad' }, buy: { count: 6, guard: ORIGINAL.buy.guard } })).toHaveLength(1);
    expect(checkGuardValues({ wait: { count: 52, guard: ORIGINAL.wait.guard } })).toHaveLength(1);
  });

  it('a backup that is not the pre-fix state stops the run before any change', () => {
    expect(buildRollbackSql(BT)).toMatch(/backup is not the pre-fix state; nothing changed/);
  });

  it('refuses a backup name that is not in the expected form, before any SQL is built', () => {
    expect(isValidBackupTable(BT)).toBe(true);
    expect(isValidBackupTable('public__reviews__2026')).toBe(false);
    expect(isValidBackupTable(`${BT}"; drop table public.reviews; --`)).toBe(false);
    expect(() => buildRollbackSql('reviews')).toThrow(/not in the expected form/);
  });
});

describe('target guard', () => {
  it('refuses any target other than staging', () => {
    expect(checkRollbackTarget('production', CLEAN_STG).ok).toBe(false);
  });

  it('refuses a staging address that carries the production reference, in the pooler form', () => {
    const r = checkRollbackTarget('staging', PROD_POOLER);
    expect(r.ok).toBe(false);
    expect(r.reason).not.toContain(PROD_REF);
  });

  it('passes a clean staging address', () => {
    expect(checkRollbackTarget('staging', CLEAN_STG)).toEqual({ ok: true, skipped: false });
  });
});

describe('workflow', () => {
  const wf = read('.github/workflows/data-fix-rollback-staging.yml');

  it('is manual only and pinned to the staging environment', () => {
    expect(wf).toMatch(/workflow_dispatch:/);
    expect(wf).toMatch(/environment: staging-migrations/);
    expect(wf).not.toMatch(/environment: production/);
  });

  it('has a timeout and runs the rollback script with the staging target', () => {
    expect(wf).toMatch(/timeout-minutes: \d+/);
    expect(wf).toMatch(/TARGET: staging/);
    expect(wf).toMatch(/node scripts\/ci\/data-fix-rollback\.mjs/);
  });
});

// Backup lookup (fix): catalogue-based check, and the not-found message names tables and read access only.
import { lookupBackupSql, diagnosticSql, checkBackupPresent, parseDiagnostic, notFoundMessage } from '../scripts/ci/data-fix-rollback.mjs';

describe('backup lookup uses the database catalogue', () => {
  it('looks the table up in pg_class joined to pg_namespace, not information_schema', () => {
    const lookup = lookupBackupSql(BT);
    expect(lookup).toMatch(/pg_class/);
    expect(lookup).toMatch(/pg_namespace/);
    expect(lookup).not.toMatch(/information_schema/);
    expect(buildRollbackSql(BT)).not.toMatch(/information_schema/);
    expect(buildRollbackSql(BT)).toMatch(/JOIN pg_namespace ns/);
  });

  it('the diagnostic reads names and a yes/no for the schema only, never table content', () => {
    const diag = diagnosticSql();
    expect(diag).toMatch(/relname/);
    expect(diag).toMatch(/has_schema_privilege\('boi_backups', 'USAGE'\)/);
    expect(diag).not.toMatch(/content/);
  });
});

describe('backup lookup: found path', () => {
  it('proceeds when the catalogue has the table', () => {
    const seen: string[] = [];
    const run = (sql: string) => { seen.push(sql); return '1\n'; };
    expect(checkBackupPresent(BT, run)).toEqual({ found: true });
    expect(seen).toHaveLength(1);
  });
});

describe('backup lookup: not-found path', () => {
  it('reports the matching table names and the role read access, and nothing else', () => {
    const run = (sql: string) => (sql.includes('count(*)')
      ? '0\n'
      : 'table|public__reviews__20261013T090000\ntable|public__reviews__20261014T123456\ntable|other__thing\ncan_read|yes\n');
    const r = checkBackupPresent(BT, run);
    expect(r.found).toBe(false);
    expect(r.message).toContain(`backup table ${BT.toLowerCase()} not found`);
    expect(r.message).toContain('public__reviews__20261013T090000, public__reviews__20261014T123456');
    expect(r.message).not.toContain('other__thing');
    expect(r.message).toContain('can read the boi_backups schema: yes');
    expect(r.message).toContain('Nothing was changed.');
  });

  it('says none and no when the schema has no matching tables and the role cannot read it', () => {
    const run = (sql: string) => (sql.includes('count(*)') ? '0\n' : 'can_read|no\n');
    const r = checkBackupPresent(BT, run);
    expect(r.found).toBe(false);
    expect(r.message).toContain('starting with public__reviews__: none');
    expect(r.message).toContain('can read the boi_backups schema: no');
  });

  it('parses the diagnostic output and keeps names apart from access', () => {
    expect(parseDiagnostic('table|public__reviews__20261014T123456\ncan_read|yes\n')).toEqual({
      names: ['public__reviews__20261014T123456'], canRead: true,
    });
    expect(notFoundMessage(BT, { names: [], canRead: null })).toContain('can read the boi_backups schema: unknown');
  });

  it('a backup name in the wrong form is refused before any query runs', () => {
    expect(() => lookupBackupSql('reviews; drop table x')).toThrow(/not in the expected form/);
  });
});

// Case handling (this fix): the stamp is matched without regard to case, then used in lower case everywhere.
import { normalizeBackupTable } from '../scripts/ci/data-fix-rollback.mjs';

describe('backup name: case handling', () => {
  const UP = 'public__reviews__20261014T183851';
  const LOW = 'public__reviews__20261014t183851';

  it('an upper-case stamp is accepted and becomes the lower-case table name', () => {
    expect(normalizeBackupTable(UP)).toBe(LOW);
  });

  it('a lower-case name works, and so does a mixed-case one', () => {
    expect(normalizeBackupTable(LOW)).toBe(LOW);
    expect(normalizeBackupTable('public__reviews__20261014t183851')).toBe(LOW);
    expect(normalizeBackupTable('Public__Reviews__20261014T183851')).toBe(LOW);
  });

  it('the rollback SQL uses only the lower-case name, never the capital-T form', () => {
    const sql = buildRollbackSql(UP);
    expect(sql).toContain(`boi_backups."${LOW}"`);
    expect(sql).toContain(`c.relname = '${LOW}'`);
    expect(sql).not.toContain(UP);
  });

  it('the lookup sent to the database uses the lower-case name', () => {
    expect(lookupBackupSql(UP)).toContain(`c.relname = '${LOW}'`);
    expect(lookupBackupSql(UP)).not.toContain(UP);
  });

  it('an upper-case stamp finds the lower-case table (the lookup returns 1 only for the lower-case name)', () => {
    const run = (sql: string) => (sql.includes(`'${LOW}'`) ? '1\n' : '0\n');
    expect(checkBackupPresent(UP, run)).toEqual({ found: true });
  });

  it('a not-found message names the lower-case table and only reviews backup names', () => {
    const run = (sql: string) => (sql.includes('count(*)')
      ? '0\n'
      : `table|${LOW}\ntable|other__thing\ncan_read|yes\n`);
    const r = checkBackupPresent(UP, run);
    expect(r.found).toBe(false);
    expect(r.message).toContain(`backup table ${LOW} not found`);
    expect(r.message).not.toContain(UP);
    expect(r.message).not.toContain('other__thing');
  });

  it('a wrong prefix is still refused', () => {
    expect(isValidBackupTable('other__reviews__20261014T183851')).toBe(false);
    expect(isValidBackupTable('public__orders__20261014T183851')).toBe(false);
    expect(() => normalizeBackupTable('public__orders__20261014T183851')).toThrow(/not in the expected form/);
    expect(() => buildRollbackSql('other__reviews__20261014T183851')).toThrow(/not in the expected form/);
  });

  it('a name with quotes or semicolons is still refused, in any case', () => {
    expect(isValidBackupTable(`${UP}"`)).toBe(false);
    expect(isValidBackupTable(`${UP};`)).toBe(false);
    expect(isValidBackupTable(`${UP}; drop table public.reviews`)).toBe(false);
    expect(isValidBackupTable(`${UP.toUpperCase()}'`)).toBe(false);
    expect(() => lookupBackupSql(`${UP}'; drop table x; --`)).toThrow(/not in the expected form/);
  });

  it('a stamp of the wrong shape is refused', () => {
    expect(isValidBackupTable('public__reviews__2026101418385')).toBe(false);
    expect(isValidBackupTable('public__reviews__20261014X183851')).toBe(false);
    expect(isValidBackupTable('public__reviews__20261014 183851')).toBe(false);
  });
});
