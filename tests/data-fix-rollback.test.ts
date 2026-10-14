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
    expect(sql).toMatch(new RegExp(`FROM boi_backups\\."${BT}" b`));
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
