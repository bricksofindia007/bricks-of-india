import { describe, it, expect } from 'vitest';
import { parseHeader, lintFile, plan, stripDollarQuoted, backupName, selectFixes } from '../scripts/ci/db-migrate.mjs';

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
