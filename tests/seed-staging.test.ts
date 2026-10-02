import { describe, it, expect } from 'vitest';
import { TABLES, PROD_REF, fingerprintSql, columnsUpdateSql, replaceSql, buildLoadSql } from '../scripts/ci/seed-staging.mjs';
import { strayFixFiles } from '../scripts/ci/db-migrate.mjs';

describe('seed-staging (P12, #443)', () => {
  it('allowlist is exactly the four public-content tables; sets syncs only the columns fixes change', () => {
    expect(TABLES.map((t) => [t.table, t.mode])).toEqual([['sets', 'columns'], ['news_articles', 'replace'], ['reviews', 'replace'], ['guides', 'replace'], ['price_history', 'replace']]);
    expect(TABLES[0].columns).toEqual(['is_gwp', 'gwp_parent_set_number', 'pieces']);
  });
  it('knows the production ref it must refuse to write to', () => {
    expect(PROD_REF).toBe('hqpaiarhmiocmjrzjhtw');
  });
  it('sets: UPDATE of the listed columns only, only ids staging has, only rows that differ -- never insert', () => {
    const u = columnsUpdateSql('sets', ['id', 'is_gwp', 'pieces']);
    expect(u).toBe('update public.sets t set "is_gwp" = s."is_gwp", "pieces" = s."pieces" from seed_sets s where t.id = s.id and (t."is_gwp", t."pieces") is distinct from (s."is_gwp", s."pieces");');
    const sql = buildLoadSql([{ table: 'sets', mode: 'columns', cols: ['id', 'is_gwp'], fpCols: ['id', 'is_gwp'], file: 'x.csv', prodFp: '1 abc' }]);
    expect(sql).not.toMatch(/insert into public\.sets/);
    expect(sql).toContain('create temp table seed_sets on commit drop as select "id", "is_gwp" from public.sets with no data;');
  });
  it('replace keeps identity ids (guides.id is GENERATED ALWAYS)', () => {
    expect(replaceSql('guides', ['id', 'slug'])).toBe('insert into public.guides ("id", "slug") overriding system value select "id", "slug" from seed_guides;');
  });
  it('fingerprint covers every listed column, null-safe, in id order', () => {
    const f = fingerprintSql('news_articles', ['id', 'content']);
    expect(f).toContain(`coalesce("id"::text, '<null>') || '|' || coalesce("content"::text, '<null>')`);
    expect(f).toContain("order by id::text");
  });
});

describe('db-migrate: misnamed data-fix files are never silent (P12)', () => {
  it('flags .sql files without an <issue>- prefix', () => {
    expect(strayFixFiles(['README.md', '287-alias-43019.sql', 'is-gwp-fill.sql', '433-is-gwp-fill.sql'])).toEqual(['is-gwp-fill.sql']);
  });
});
