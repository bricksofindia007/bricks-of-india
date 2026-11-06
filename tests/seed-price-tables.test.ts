// Seed of the price tables (order 0780): the staging-only price-proof rows survive the store_prices reload, and the
// production grant for the read-only role is a draft migration that is not applied.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { TABLES, FIXTURE_MARKER, buildLoadSql, HISTORY_TRIGGER } from '../scripts/ci/seed-staging.mjs';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

const storeCols = ['id', 'set_id', 'store_id', 'price_inr', 'in_stock', 'product_url', 'scraped_at', 'compare_at_price_inr'];
const storePlan = [{ table: 'store_prices', mode: 'replace', cols: storeCols, fpCols: storeCols, file: 'x.csv', prodFp: '1 abc' }];

describe('seed: price tables are on the copy list', () => {
  it('store_prices and price_history are reloaded (replace), on top of the four content tables', () => {
    expect(TABLES.map((t) => [t.table, t.mode])).toEqual([
      ['sets', 'columns'], ['news_articles', 'replace'], ['reviews', 'replace'], ['guides', 'replace'],
      ['price_history', 'replace'], ['store_prices', 'replace'],
    ]);
  });
});

describe('seed: staging-only price-proof rows are kept across the store_prices reload', () => {
  it('the marker is the fixture marker the price-proof SQL writes', () => {
    expect(FIXTURE_MARKER).toBe('FIXTURE STAGING ONLY');
    expect(read('scripts/ci/seed-staging-price-fixture.sql')).toContain(`'${FIXTURE_MARKER}'`);
  });

  it('the kept rows are copied aside before the truncate and put back after the reload', () => {
    const sql = buildLoadSql(storePlan);
    const keep = sql.indexOf('create temp table keep_store_prices');
    const trunc = sql.indexOf('truncate public.store_prices');
    const reload = sql.indexOf('insert into public.store_prices (');
    const back = sql.indexOf('from keep_store_prices');
    expect(keep).toBeGreaterThan(sql.indexOf('begin;'));
    expect(keep).toBeLessThan(trunc);
    expect(back).toBeGreaterThan(reload);
    expect(sql).toContain(`where product_url = '${FIXTURE_MARKER}';`);
  });

  it('the put-back happens while the history trigger is still off (no history rows for the fixture)', () => {
    const sql = buildLoadSql(storePlan);
    const back = sql.indexOf('from keep_store_prices');
    const on = sql.indexOf(`alter table public.store_prices enable trigger ${HISTORY_TRIGGER};`);
    expect(back).toBeLessThan(on);
  });

  it('the production fingerprint ignores the marker rows, so the copy still matches production', () => {
    const sql = buildLoadSql(storePlan);
    expect(sql).toContain(`where product_url <> '${FIXTURE_MARKER}'`);
  });

  it('the counts report production-equivalent rows and the number of fixture rows kept', () => {
    const sql = buildLoadSql(storePlan);
    expect(sql).toContain(`select 'store_prices|' || (select count(*) from public.store_prices where product_url <> '${FIXTURE_MARKER}');`);
    expect(sql).toContain("select 'store_prices:fixture_kept|' || (select count(*) from keep_store_prices);");
  });

  it('a plan without store_prices adds no fixture handling', () => {
    const sql = buildLoadSql([{ table: 'guides', mode: 'replace', cols: ['id', 'slug'], fpCols: ['id', 'slug'], file: 'x.csv', prodFp: '1 abc' }]);
    expect(sql).not.toContain('keep_store_prices');
  });
});

describe('seed workflow header lists the six tables and the grants that allow them', () => {
  const wf = read('.github/workflows/seed-staging.yml');
  it('names the grant migrations for price_history and store_prices', () => {
    expect(wf).toContain('20261001010000');
    expect(wf).toContain('20261001200000');
  });
  it('no longer says four tables', () => {
    expect(wf).not.toMatch(/read of 4 tables/);
    expect(wf).toMatch(/read of 6 tables/);
  });
});

describe('production grant draft (not applied)', () => {
  const draftDir = join(root, 'supabase/migrations/_draft');
  const draftName = '20261106120000_ci_readonly_price_tables_reassert.sql';
  const draft = join(draftDir, draftName);

  it('the draft lives in _draft, not at the top level where the checks would read it', () => {
    expect(existsSync(draft)).toBe(true);
    const top = readdirSync(join(root, 'supabase/migrations'), { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);
    expect(top).not.toContain(draftName);
  });

  it('is marked not applied and says what changes', () => {
    const sql = read('supabase/migrations/_draft/' + draftName);
    expect(sql).toMatch(/DRAFT, NOT APPLIED/);
    expect(sql).toMatch(/GRANT SELECT ON public\.store_prices, public\.price_history TO ci_readonly;/);
  });

  it('is idempotent: the policies are created only when missing', () => {
    const sql = read('supabase/migrations/_draft/' + draftName);
    expect(sql).toMatch(/IF NOT EXISTS \(SELECT 1 FROM pg_policies[\s\S]*store_prices[\s\S]*CREATE POLICY/);
    expect(sql).toMatch(/IF NOT EXISTS \(SELECT 1 FROM pg_policies[\s\S]*price_history[\s\S]*CREATE POLICY/);
  });

  it('grants nothing beyond SELECT on the six seed tables (self-check rolls back on extras)', () => {
    const sql = read('supabase/migrations/_draft/' + draftName);
    expect(sql).toContain("NOT (table_name IN ('news_articles', 'reviews', 'guides', 'sets', 'price_history', 'store_prices') AND privilege_type = 'SELECT')");
    expect(sql).toMatch(/RAISE EXCEPTION 'ci_readonly holds public privileges/);
  });

  it('states the rollback and that the grants already exist in production through applied migrations', () => {
    const sql = read('supabase/migrations/_draft/' + draftName);
    expect(sql).toContain('20261001010000');
    expect(sql).toContain('20261001200000');
    expect(sql).toMatch(/Rollback/);
  });
});
