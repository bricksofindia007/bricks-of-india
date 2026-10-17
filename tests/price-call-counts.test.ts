// The call-count function: returns function names and call counts only, and only the full-access role may call it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const sql = readFileSync(join(root, 'supabase/migrations/20261017220000_price_call_counts.sql'), 'utf8');

describe('get_price_call_counts', () => {
  it('returns only the function name and the call count', () => {
    expect(sql).toMatch(/returns table \(function_name text, calls bigint\)/);
  });

  it('is definer-rights and read-only (no writes)', () => {
    expect(sql).toMatch(/security definer/);
    expect(sql).not.toMatch(/\b(insert|update|delete|truncate|alter|create table)\b/i);
  });

  it('covers only the three price functions', () => {
    expect(sql).toMatch(/'get_set_prices', 'get_price_history', 'get_price_summaries'/);
  });

  it('revokes from public, anonymous and signed-in roles; grants only the full-access role', () => {
    expect(sql).toMatch(/revoke all on function public\.get_price_call_counts\(\) from public;/);
    expect(sql).toMatch(/revoke all on function public\.get_price_call_counts\(\) from anon, authenticated;/);
    expect(sql).toMatch(/grant execute on function public\.get_price_call_counts\(\) to service_role;/);
    expect(sql).not.toMatch(/grant execute[^;]*\bto\b[^;]*\banon\b/);
  });
});
