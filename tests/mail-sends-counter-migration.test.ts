import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { lintFile, parseHeader } from '../scripts/ci/db-migrate.mjs';

const root = join(__dirname, '..');
const migrationPath = 'supabase/migrations/20261030100000_mail_sends_counter.sql';
const rollbackPath = 'supabase/rollbacks/20261030100000_mail_sends_counter.rollback.sql';
const sql = readFileSync(join(root, migrationPath), 'utf8');

describe('mail-send counter migration (issue 879, held)', () => {
  it('passes the repo migration lint', () => {
    expect(lintFile('migration', '20261030100000_mail_sends_counter.sql', sql)).toEqual([]);
  });
  it('names issue 879 in its header', () => {
    expect(parseHeader(sql).issue).toBe(879);
  });
  it('turns on row level security and grants nothing to anon, authenticated or public', () => {
    expect(sql).toMatch(/enable row level security/);
    expect(sql).toMatch(/revoke all on public\.mail_sends from public, anon, authenticated/);
    expect(sql).not.toMatch(/grant [^;]*to (anon|authenticated|public)\b/i);
  });
  it('stores route codes only, with a check on the allowed codes', () => {
    expect(sql).toMatch(/check \(route_code in \('contact', 'newsletter', 'operator'\)\)/);
    const statements = sql.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');
    expect(statements).not.toMatch(/email|name text|message/i);
  });
  it('has a rollback file that drops the table', () => {
    expect(existsSync(join(root, rollbackPath))).toBe(true);
    expect(readFileSync(join(root, rollbackPath), 'utf8')).toMatch(/drop table if exists public\.mail_sends/);
  });
});
