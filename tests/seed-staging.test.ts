import { describe, it, expect } from 'vitest';
import { TABLES, PROD_REF, fingerprintSql, columnsUpdateSql, replaceSql, buildLoadSql, HISTORY_TRIGGER, PUBLISH_GATE_TRIGGER } from '../scripts/ci/seed-staging.mjs';

// Order 0920: the review publish rule is off only while the reviews copy runs, inside the same transaction.
const fullPlan = () => TABLES.map((t) => ({ table: t.table, mode: t.mode, cols: t.columns ?? ['id'], fpCols: t.columns ?? ['id'], file: 'x.csv', prodFp: '1 abc' }));
const OFF = `alter table public.reviews disable trigger ${PUBLISH_GATE_TRIGGER};`;
const ON = `alter table public.reviews enable trigger ${PUBLISH_GATE_TRIGGER};`;
const REVIEW_LOAD = 'insert into public.reviews';

describe('order 0920: the publish rule is off only for the reviews copy', () => {
  it('names the publish rule trigger on public.reviews', () => {
    expect(PUBLISH_GATE_TRIGGER).toBe('review_publish_gate');
  });
  it('disables and re-enables exactly that trigger, once each, on reviews only', () => {
    const sql = buildLoadSql(fullPlan());
    expect(sql.split(OFF).length - 1).toBe(1);
    expect(sql.split(ON).length - 1).toBe(1);
    const toggles = sql.match(/alter table [^\n]*trigger[^\n]*/g) ?? [];
    expect(toggles.filter((l) => l.includes(PUBLISH_GATE_TRIGGER))).toEqual([OFF, ON]);
    // every other toggle is the price-history switch on store_prices, nothing else
    for (const l of toggles.filter((x) => !x.includes(PUBLISH_GATE_TRIGGER))) {
      expect(l).toContain('public.store_prices');
      expect(l).toContain(HISTORY_TRIGGER);
    }
  });
  it('the switch is off immediately before the reviews insert and on immediately after it, with nothing in between', () => {
    const sql = buildLoadSql(fullPlan());
    const off = sql.indexOf(OFF);
    const load = sql.indexOf(REVIEW_LOAD);
    const on = sql.indexOf(ON);
    expect(off).toBeGreaterThan(-1);
    expect(off).toBeLessThan(load);
    expect(load).toBeLessThan(on);
    expect(sql.slice(off + OFF.length, load).trim()).toBe('');
    expect(sql.slice(load, on).trim().endsWith(';')).toBe(true);
    expect(sql.slice(load, on).split('\n').filter((l) => l.trim() !== '').length).toBe(1);
  });
  it('the switch is back on before the commit and inside the one transaction', () => {
    const sql = buildLoadSql(fullPlan());
    const begin = sql.indexOf('begin;');
    const on = sql.indexOf(ON);
    const check = sql.indexOf('do $$');
    const commit = sql.lastIndexOf('commit;');
    expect(begin).toBe(0);
    expect(on).toBeGreaterThan(begin);
    expect(on).toBeLessThan(check);
    expect(check).toBeLessThan(commit);
    expect(sql.trimEnd().endsWith('commit;')).toBe(true);
    expect(sql.match(/\bbegin;/g)?.length).toBe(1);
    expect(sql.match(/\bcommit;/g)?.length).toBe(1);
  });
  it('a failed load rolls back with the switch in place: no statement sits outside the transaction', () => {
    const sql = buildLoadSql(fullPlan());
    const before = sql.slice(0, sql.indexOf('begin;'));
    const after = sql.slice(sql.lastIndexOf('commit;') + 'commit;'.length);
    expect(before.trim()).toBe('');
    expect(after.trim()).toBe('');
    // the switch-on statement is part of the transaction the check can roll back
    expect(sql.indexOf(ON)).toBeLessThan(sql.lastIndexOf('commit;'));
  });
  it('a plan with no reviews never touches the publish rule', () => {
    const sql = buildLoadSql([{ table: 'guides', mode: 'replace', cols: ['id'], fpCols: ['id'], file: 'x.csv', prodFp: '1 abc' }]);
    expect(sql).not.toContain(PUBLISH_GATE_TRIGGER);
    expect(sql).not.toContain('disable trigger');
  });
});
import { strayFixFiles } from '../scripts/ci/db-migrate.mjs';

describe('seed-staging (P12, #443)', () => {
  it('allowlist is exactly the four public-content tables; sets syncs only the columns fixes change', () => {
    expect(TABLES.map((t) => [t.table, t.mode])).toEqual([['sets', 'columns'], ['news_articles', 'replace'], ['guides', 'replace'], ['price_history', 'replace'], ['store_prices', 'replace'], ['reviews', 'replace']]);
    expect(TABLES[0].columns).toEqual(['is_gwp', 'gwp_parent_set_number', 'pieces', 'theme', 'lego_mrp_inr', 'mrp_verified', 'mrp_review_reason']);
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
  it('store_prices loads with its price-history trigger off, inside the transaction, so price_history equals production', () => {
    const t = (table: string) => ({ table, mode: 'replace', cols: ['id'], fpCols: ['id'], file: 'x.csv', prodFp: '1 abc' });
    const sql = buildLoadSql([t('price_history'), t('store_prices')]);
    const off = sql.indexOf(`alter table public.store_prices disable trigger ${HISTORY_TRIGGER};`);
    const load = sql.indexOf('insert into public.store_prices');
    const on = sql.indexOf(`alter table public.store_prices enable trigger ${HISTORY_TRIGGER};`);
    expect(off).toBeGreaterThan(sql.indexOf('begin;'));
    expect(off).toBeLessThan(load);
    expect(on).toBeGreaterThan(load);
    expect(on).toBeLessThan(sql.indexOf('raise exception'));
    expect(buildLoadSql([t('guides')])).not.toContain('disable trigger');
  });
  it('order 0900: store_prices is loaded before reviews, so the review publish gate never sees empty store_prices', () => {
    const plan = TABLES.map((t) => ({ table: t.table, mode: t.mode, cols: t.columns ?? ['id'], fpCols: t.columns ?? ['id'], file: 'x.csv', prodFp: '1 abc' }));
    const sql = buildLoadSql(plan);
    const storeLoad = sql.indexOf('insert into public.store_prices');
    const reviewLoad = sql.indexOf('insert into public.reviews');
    expect(storeLoad).toBeGreaterThan(-1);
    expect(reviewLoad).toBeGreaterThan(-1);
    expect(storeLoad).toBeLessThan(reviewLoad);
    // the review rows are copied from the temp table only after store_prices has been reloaded in this transaction
    expect(sql.indexOf('create temp table seed_reviews')).toBeLessThan(storeLoad);
  });
  it('order 0920 supersedes the 0900 "gate never touched" rule: the publish rule is toggled only around reviews', () => {
    const sql = buildLoadSql(fullPlan());
    expect(sql.split('disable trigger review_publish_gate').length - 1).toBe(1);
    expect(sql).not.toMatch(/disable trigger review(?!_publish_gate)/i);
  });
  it('a reviews-only load is one transaction with the publish rule off just for the reviews copy', () => {
    const sql = buildLoadSql([{ table: 'reviews', mode: 'replace', cols: ['id'], fpCols: ['id'], file: 'x.csv', prodFp: '1 abc' }]);
    expect(sql.startsWith('begin;')).toBe(true);
    expect(sql).toContain('commit;');
    expect(sql).toContain(OFF);
    expect(sql).toContain(ON);
    expect(sql).not.toContain(HISTORY_TRIGGER);
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
