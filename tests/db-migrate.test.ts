import { describe, it, expect } from 'vitest';
// @ts-expect-error -- plain .mjs module
import { parseHeader, lintFile, plan, stripDollarQuoted, backupName } from '../scripts/ci/db-migrate.mjs';

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
    expect(h.expectAfter.count).toBe(2);
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
