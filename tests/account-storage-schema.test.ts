// Account storage migration (pillar H, flag off, not applied): row level security on every table, no grants to anon or
// authenticated, the 500-per-list limit present, and a rollback file.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const sql = readFileSync(join(root, 'supabase/migrations/20261024230000_account_storage.sql'), 'utf8');
const rollback = readFileSync(join(root, 'supabase/rollbacks/20261024230000_account_storage.rollback.sql'), 'utf8');

describe('account storage migration', () => {
  it('turns on row level security for every table', () => {
    for (const t of ['accounts', 'saved_sets', 'saved_figures']) {
      expect(sql).toMatch(new RegExp(`alter table public\.${t} enable row level security`));
    }
  });
  it('grants nothing to anon, authenticated or public, and only the service role gets access', () => {
    expect(sql).toMatch(/revoke all on public\.accounts, public\.saved_sets, public\.saved_figures from public, anon, authenticated/);
    expect(sql).toMatch(/grant select, insert, update, delete on public\.accounts, public\.saved_sets, public\.saved_figures to service_role/);
    expect(sql).not.toMatch(/to anon|to authenticated/);
  });
  it('has no personal data column: no email, name or address', () => {
    expect(sql).not.toMatch(/\b(email|phone|name|address)\b\s+text/i);
  });
  it('limits each list to 500 sets', () => {
    expect(sql).toMatch(/>= 500/);
    expect(sql).toMatch(/create trigger saved_sets_limit before insert on public\.saved_sets/);
  });
  it('has a rollback that drops the tables and the trigger', () => {
    expect(rollback).toMatch(/drop table if exists public\.saved_sets/);
    expect(rollback).toMatch(/drop trigger if exists saved_sets_limit/);
  });
});
