// Sequences in the public schema: the anonymous and signed-in roles get no rights (migration and standing check).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const migration = readFileSync(join(root, 'supabase/migrations/20261017230000_revoke_all_sequence_grants.sql'), 'utf8');
const check = readFileSync(join(root, 'scripts/rehearsal/sequence-check.sql'), 'utf8');

describe('sequence grants', () => {
  it('revokes all rights on every public sequence from anon and authenticated', () => {
    expect(migration).toMatch(/revoke all on all sequences in schema public from anon, authenticated;/);
  });

  it('removes default rights for new sequences from the migration roles', () => {
    expect(migration).toMatch(/alter default privileges for role supabase_admin in schema public revoke all on sequences from anon, authenticated;/);
    expect(migration).toMatch(/alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;/);
  });

  it('never grants a sequence right to anon or authenticated', () => {
    expect(migration).not.toMatch(/grant [^;]*\bon\b[^;]*sequences[^;]*\bto\b[^;]*\b(anon|authenticated)\b/i);
  });

  it('the standing check covers existing sequences and defaults', () => {
    expect(check).toMatch(/c\.relkind = 'S'/);
    expect(check).toMatch(/defaclobjtype = 'S'/);
  });
});
