import { describe, it, expect } from 'vitest';
import { TABLES, PROD_REF, fingerprintSql, upsertSql, replaceSql } from '../scripts/ci/seed-staging.mjs';
import { strayFixFiles } from '../scripts/ci/db-migrate.mjs';

describe('seed-staging (P12, #443)', () => {
  it('allowlist is exactly the four public-content tables; sets upserts, the rest replace', () => {
    expect(TABLES.map((t) => [t.table, t.mode])).toEqual([['sets', 'upsert'], ['news_articles', 'replace'], ['reviews', 'replace'], ['guides', 'replace']]);
  });
  it('knows the production ref it must refuse to write to', () => {
    expect(PROD_REF).toBe('hqpaiarhmiocmjrzjhtw');
  });
  it('upsert updates only rows that differ, ignoring trigger-owned columns', () => {
    const s = upsertSql('sets', ['id', 'name', 'updated_at'], ['updated_at']);
    expect(s).toContain('on conflict (id) do update set "name" = excluded."name", "updated_at" = excluded."updated_at"');
    expect(s).toContain('where (t."name") is distinct from (excluded."name")');
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
    expect(strayFixFiles(['README.md', '287-alias-43019.sql', 'is-gwp-fill.sql', '246-is-gwp-fill.sql'])).toEqual(['is-gwp-fill.sql']);
  });
});
