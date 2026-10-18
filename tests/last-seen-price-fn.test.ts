// get_last_seen_prices (draft migration, not applied): batched (at most 150), the most recent observed Indian price
// and its date per set, only for stores on display. Its grants are identical to the existing price read functions
// (20261017200000): public revoked, execute to anon, authenticated and service_role. It never returns a price-table row.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const sql = readFileSync(join(root, 'supabase/migrations/20261018180000_get_last_seen_prices.sql'), 'utf8');
const down = readFileSync(join(root, 'supabase/rollbacks/20261018180000_get_last_seen_prices.down.sql'), 'utf8');
const base = readFileSync(join(root, 'supabase/migrations/20261017200000_price_read_functions.sql'), 'utf8');

describe('get_last_seen_prices', () => {
  it('is a security definer function with a fixed search path', () => {
    expect(sql).toMatch(/security definer/);
    expect(sql).toMatch(/set search_path = ''/);
  });
  it('takes a batch of at most 150 set numbers', () => {
    expect(sql).toMatch(/p_set_numbers\[1:150\]/);
  });
  it('returns the set, the price and its date: one row per set, the most recent observed', () => {
    expect(sql).toMatch(/returns table \(set_id text, price_inr numeric, observed_at timestamptz\)/);
    expect(sql).toMatch(/select distinct on \(ph\.set_id\)/);
    expect(sql).toMatch(/order by ph\.set_id, ph\.recorded_at desc/);
  });
  it('counts only stores on display, the same switch the other price reads use', () => {
    expect(sql).toMatch(/join public\.stores st on st\.id = ph\.store_id and st\.display_enabled/);
  });
  it('grants are identical to the existing price read functions: public revoked, execute to anon, authenticated, service_role', () => {
    expect(sql).toMatch(/revoke all on function public\.get_last_seen_prices\(text\[\]\) from public;/);
    expect(sql).toMatch(/grant execute on function public\.get_last_seen_prices\(text\[\]\) to anon, authenticated, service_role;/);
    expect(sql).not.toMatch(/from public, anon, authenticated/);
  });
  it('the existing functions use the same grant pattern (get_set_prices in 20261017200000)', () => {
    expect(base).toMatch(/revoke all on function public\.get_set_prices\(text\) from public;/);
    expect(base).toMatch(/grant execute on function public\.get_set_prices\(text\) to anon, authenticated, service_role;/);
  });
  it('the rollback removes the function', () => {
    expect(down).toMatch(/DROP FUNCTION IF EXISTS public\.get_last_seen_prices\(text\[\]\);/);
  });
});
