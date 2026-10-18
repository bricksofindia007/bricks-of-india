// The call-count function: names and call counts only, seven price functions, fixed search path, service role only.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const sql = readFileSync(join(root, 'supabase/migrations/20261017220000_price_call_counts.sql'), 'utf8');
const rollback = readFileSync(join(root, 'supabase/rollbacks/20261017220000_price_call_counts.down.sql'), 'utf8');

describe('get_price_call_counts', () => {
  it('returns only the function name and the call count', () => {
    expect(sql).toMatch(/returns table \(function_name text, calls bigint\)/);
  });

  it('is definer-rights, read-only, with a fixed search path', () => {
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/set search_path = ''/);
    expect(sql).not.toMatch(/\b(insert|update|delete|truncate|alter table|create table)\b/i);
  });

  it('reads query statistics, not the function statistics view', () => {
    expect(sql).toMatch(/extensions\.pg_stat_statements/);
    expect(sql).not.toMatch(/pg_stat_user_functions/);
  });

  it('covers the seven price-reading functions', () => {
    for (const name of [
      'get_set_prices',
      'get_prices_for_sets',
      'get_price_history',
      'get_best_prices_for_sets',
      'get_price_summaries',
      'set_page_data',
      'get_price_summary_for_set',
    ]) {
      expect(sql).toContain(`('${name}')`);
    }
  });

  it('revokes from public, anonymous and signed-in roles; grants only the full-access role', () => {
    expect(sql).toMatch(/revoke all on function public\.get_price_call_counts\(\) from public;/);
    expect(sql).toMatch(/revoke all on function public\.get_price_call_counts\(\) from anon, authenticated;/);
    expect(sql).toMatch(/grant execute on function public\.get_price_call_counts\(\) to service_role;/);
    expect(sql).not.toMatch(/grant execute[^;]*\bto\b[^;]*\banon\b/);
  });

  it('does not mention the function-tracking setting (the role cannot change it)', () => {
    expect(sql).not.toMatch(/track_functions/);
  });

  it('rollback drops the function', () => {
    expect(rollback).toMatch(/drop function if exists public\.get_price_call_counts\(\);/);
  });
});
