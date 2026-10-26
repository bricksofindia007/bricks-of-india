// The price history cleanup keeps a row when its stock state differs from a neighbour's. The change is a held migration;
// its rollback restores the baseline function text exactly.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lintFile, parseHeader } from '../scripts/ci/db-migrate.mjs';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const MIG = 'supabase/migrations/20261026100000_run_retention_stock_state.sql';
const migration = read(MIG);
const rollback = read('supabase/rollbacks/20261026100000_run_retention_stock_state.down.sql');
const baseline = read('supabase/migrations/20260927140000_baseline.sql');

// The function text between "CREATE FUNCTION public.run_retention" and its closing "$$;".
const fnText = (s: string, keyword: string) => {
  const start = s.indexOf(`${keyword} public.run_retention`);
  return s.slice(start, s.indexOf('$$;', start) + 3);
};

describe('run_retention stock-state change', () => {
  it('the migration has a numeric issue header and passes the runner lint', () => {
    expect(parseHeader(migration).issue).toBe(808);
    expect(lintFile('migration', '20261026100000_run_retention_stock_state.sql', migration)).toEqual([]);
  });
  it('the stock condition is in the count branch and in the delete branch', () => {
    expect((migration.match(/o\.prev_s IS NOT DISTINCT FROM o\.in_stock\s+AND o\.next_s IS NOT DISTINCT FROM o\.in_stock/g) ?? []).length).toBe(2);
  });
  it('it is CREATE OR REPLACE, so the signature, owner and grants stay', () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.run_retention\(p_days integer DEFAULT 30, p_archive_days integer DEFAULT 90, p_dry_run boolean DEFAULT false\)/);
  });
  it('the rollback restores the baseline function text exactly, except CREATE OR REPLACE', () => {
    const base = fnText(baseline, 'CREATE FUNCTION');
    const roll = fnText(rollback, 'CREATE OR REPLACE FUNCTION');
    expect(roll).toBe(base.replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION'));
  });
  it('the change is held: the migration says it is not applied', () => {
    expect(migration).toMatch(/NOT APPLIED: staging rehearsal first/);
  });
});
