import { describe, it, expect } from 'vitest';
import { parseHeader, lintFile, plan, stripDollarQuoted, backupName, selectFixes, checkStagingTarget } from '../scripts/ci/db-migrate.mjs';
import { PROD_REF } from '../scripts/ci/prod-reference.mjs';
import { PROD_REF as SEED_PROD_REF } from '../scripts/ci/seed-staging.mjs';

const FIX = `-- boi:issue 246
-- boi:backup-tables public.reviews
-- boi:expect-before select count(*) from public.reviews where slug in ('a','b') = 2
-- boi:expect-after select count(*) from public.reviews where slug in ('a','b') and content like '%Corrected%' = 2
update public.reviews set content = content || 'x' where slug in ('a','b');
`;

describe('db-migrate (P6 Step 1, #403)', () => {
  it('parses the header', () => {
    const h = parseHeader(FIX);
    expect(h.issue).toBe(246);
    expect(h.backupTables).toEqual(['public.reviews']);
    expect(h.expectBefore).toEqual({ sql: "select count(*) from public.reviews where slug in ('a','b')", count: 2 });
    expect(h.expectAfter?.count).toBe(2);
  });
  it('accepts a well-formed data fix', () => {
    expect(lintFile('fix', '246-batch1.sql', FIX)).toEqual([]);
  });
  it('rejects a data fix without count assertions, backups, or with a mismatched prefix', () => {
    const bare = '-- boi:issue 246\nupdate public.reviews set title = title;\n';
    const errs = lintFile('fix', '247-batch1.sql', bare).join('\n');
    expect(errs).toMatch(/prefix 247 differs/);
    expect(errs).toMatch(/expect-before/);
    expect(errs).toMatch(/expect-after/);
    expect(errs).toMatch(/backup-tables/);
  });
  it('rejects files with their own transaction control, but not plpgsql bodies', () => {
    expect(lintFile('migration', '20260101000000_x.sql', '-- boi:issue 1\nBEGIN;\ncreate table t(); \nCOMMIT;\n').join()).toMatch(/BEGIN\/COMMIT/);
    const fn = '-- boi:issue 1\ncreate function f() returns void language plpgsql as $fn$\nbegin\n  perform 1;\nend;\n$fn$;\nDO $$ BEGIN PERFORM 1; END $$;\n';
    expect(lintFile('migration', '20260101000000_x.sql', fn)).toEqual([]);
    expect(stripDollarQuoted('a $x$ END; $x$ b $$ COMMIT; $$ c')).toBe('a  b  c');
  });
  it('requires an issue header on every pending file', () => {
    expect(lintFile('migration', '20260101000000_x.sql', 'create table t();').join()).toMatch(/boi:issue/);
  });
  it('plans pending work and refuses target-only versions', () => {
    const p = plan({ migrations: ['20260927140000_baseline.sql', '20260928100000_ledger.sql'], fixes: ['246-a.sql'],
      appliedVersions: ['20260927140000'], appliedFixes: [] });
    expect(p.pendingMigrations).toEqual(['20260928100000_ledger.sql']);
    expect(p.pendingFixes).toEqual(['246-a.sql']);
    expect(p.targetOnly).toEqual([]);
    const bad = plan({ migrations: ['20260927140000_baseline.sql'], fixes: [], appliedVersions: ['20260927140000', '20260101000000'], appliedFixes: [] });
    expect(bad.targetOnly).toEqual(['20260101000000']);
  });
  it('names backups inside boi_backups', () => {
    expect(backupName('public.reviews', '20260928T101500')).toBe('public__reviews__20260928T101500');
  });
});

// 2 Oct 2026: run 36968785112 applied fix 455 to production without authorization.
describe('selectFixes: only fixes named in the run input are applied', () => {
  const allFixes = ['455-mybrickhouse-to-legoin-content.sql', '496-love-birds-g19.sql', '498-item0-retired-verdicts-a.sql'];
  it('apply with pending fixes and an empty list refuses', () => {
    const r = selectFixes({ pendingFixes: ['455-mybrickhouse-to-legoin-content.sql'], allFixes, requested: '', mode: 'apply' });
    expect(r.error).toMatch(/refusing/);
  });
  it('plan mode with an empty list only reports (no refusal)', () => {
    const r = selectFixes({ pendingFixes: ['455-mybrickhouse-to-legoin-content.sql'], allFixes, requested: '', mode: 'plan' });
    expect(r.error).toBeUndefined();
    expect(r.apply).toEqual([]);
    expect(r.held).toEqual(['455-mybrickhouse-to-legoin-content.sql']);
  });
  it('the 2 Oct case: 455 pending but not listed is held; the listed fixes apply', () => {
    const r = selectFixes({ pendingFixes: allFixes, allFixes, requested: '496-love-birds-g19, 498-item0-retired-verdicts-a', mode: 'apply' });
    expect(r.apply).toEqual(['496-love-birds-g19.sql', '498-item0-retired-verdicts-a.sql']);
    expect(r.held).toEqual(['455-mybrickhouse-to-legoin-content.sql']);
  });
  it('listed but already applied here is skipped, not an error (staging ahead of production)', () => {
    const r = selectFixes({ pendingFixes: [], allFixes, requested: '496-love-birds-g19', mode: 'apply' });
    expect(r.apply).toEqual([]);
    expect(r.alreadyApplied).toEqual(['496-love-birds-g19.sql']);
  });
  it('a listed name with no file refuses', () => {
    expect(selectFixes({ pendingFixes: [], allFixes, requested: '499-typo', mode: 'apply' }).error).toMatch(/don't exist/);
  });
});

// P44: staging safety check. Addresses below are built from placeholders; no real address is used.
describe('staging target check', () => {
  const STG_REF = 'abcdefghijklmnopqrst'; // placeholder staging reference (20 characters)
  const direct = (ref: string) => `postgresql://postgres:placeholder@db.${ref}.supabase.co:5432/postgres`;
  const pooler = (ref: string) => `postgresql://postgres.${ref}:placeholder@aws-0-region.pooler.example.com:6543/postgres`;

  it('the shared reference is the one the seed script exports', () => {
    expect(SEED_PROD_REF).toBe(PROD_REF);
    expect(PROD_REF).toMatch(/^[a-z0-9]{20}$/);
  });

  it('refuses a direct staging address that contains the production reference', () => {
    const r = checkStagingTarget('staging', direct(PROD_REF));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/production project/);
  });

  it('refuses a pooler staging address that contains the production reference in the user name', () => {
    const r = checkStagingTarget('staging', pooler(PROD_REF));
    expect(r.ok).toBe(false);
  });

  it('passes a clean staging address in either form', () => {
    expect(checkStagingTarget('staging', direct(STG_REF))).toEqual({ ok: true, skipped: false });
    expect(checkStagingTarget('staging', pooler(STG_REF))).toEqual({ ok: true, skipped: false });
  });

  it('refuses when the production reference cannot be found (missing or malformed)', () => {
    expect(checkStagingTarget('staging', direct(STG_REF), '').ok).toBe(false);
    expect(checkStagingTarget('staging', direct(STG_REF), 'too-short').ok).toBe(false);
  });

  it('the refusal never repeats the address, the host or the reference', () => {
    for (const url of [direct(PROD_REF), pooler(PROD_REF)]) {
      const r = checkStagingTarget('staging', url);
      expect(r.reason).not.toContain(PROD_REF);
      expect(r.reason).not.toContain('supabase');
      expect(r.reason).not.toContain('postgres');
    }
  });

  it('does not apply to production, and refuses an empty staging address', () => {
    expect(checkStagingTarget('production', direct(PROD_REF))).toEqual({ ok: true, skipped: true });
    expect(checkStagingTarget('staging', '').ok).toBe(false);
  });
});

// Apply step: rows changed, read from psql's command tags (the asserts print nothing).
import { changedRowCount } from '../scripts/ci/db-migrate.mjs';

describe('rows changed per fix', () => {
  it('sums the UPDATE and DELETE tags and ignores the rest', () => {
    const out = 'BEGIN\nDO\nUPDATE 52\nUPDATE 6\nINSERT 0 1\nCOMMIT';
    expect(changedRowCount(out)).toEqual({ total: 58, statements: ['UPDATE 52', 'UPDATE 6'] });
  });

  it('counts deletes too, and is zero when nothing changed', () => {
    expect(changedRowCount('DELETE 3\nUPDATE 0').total).toBe(3);
    expect(changedRowCount('BEGIN\nDO\nCOMMIT')).toEqual({ total: 0, statements: [] });
    expect(changedRowCount(undefined)).toEqual({ total: 0, statements: [] });
  });
});
