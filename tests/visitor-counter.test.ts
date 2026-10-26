// Visitor counter (order 0050, issue 822): the table is closed to browser roles, the owner page is a 404 while the
// flag is off, and the flag is mirrored in both files.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lintFile, parseHeader } from '../scripts/ci/db-migrate.mjs';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const MIG = 'supabase/migrations/20261027120000_visit_daily.sql';
const migration = read(MIG);

describe('visit_daily migration', () => {
  it('has a numeric issue header and passes the runner lint', () => {
    expect(parseHeader(migration).issue).toBe(822);
    expect(lintFile('migration', '20261027120000_visit_daily.sql', migration)).toEqual([]);
  });
  it('turns RLS on', () => {
    expect(migration).toMatch(/alter table public\.visit_daily enable row level security;/);
  });
  it('grants nothing to anon, authenticated or public, and only service_role gets access', () => {
    expect(migration).toMatch(/revoke all on public\.visit_daily from public, anon, authenticated;/);
    expect(migration).toMatch(/grant select, insert, update, delete on public\.visit_daily to service_role;/);
    const grants = migration.match(/^grant .*;$/gm) ?? [];
    expect(grants).toEqual(['grant select, insert, update, delete on public.visit_daily to service_role;']);
  });
  it('stores only day, page class and views (no personal or request data)', () => {
    const table = migration.match(/create table if not exists public\.visit_daily \([\s\S]*?\);/)?.[0] ?? '';
    expect(table).toMatch(/day\s+date\s+not null/);
    expect(table).toMatch(/page_class\s+text\s+not null/);
    expect(table).toMatch(/views\s+integer/);
    expect(table).not.toMatch(/\b(ip|user_agent|cookie|session|referrer|slug|visitor)\b/i);
  });
  it('ends with a self-check that fails the migration if RLS is off or a browser role has a grant', () => {
    expect(migration).toMatch(/relrowsecurity/);
    expect(migration).toMatch(/grantee in \('anon', 'authenticated', 'public'\)/);
    expect(migration).toMatch(/raise exception 'visit_daily: row level security is not on'/);
  });
  it('the rollback removes only the table', () => {
    const down = read('supabase/rollbacks/20261027120000_visit_daily.down.sql');
    expect(down).toMatch(/drop table if exists public\.visit_daily;/);
  });
});

describe('visitorCounter flag', () => {
  it('is false in both mirrors', () => {
    expect(read('src/lib/feature-flags.ts')).toMatch(/visitorCounter: false,/);
    expect(read('config/feature_flags.py')).toMatch(/"visitor_counter": False,/);
  });
});

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }) }));
vi.mock('@/lib/supabase', () => ({
  createServerClient: () => {
    throw new Error('SUPABASE_CALLED');
  },
}));

describe('owner page', () => {
  it('returns not found while the flag is off (nothing is read)', async () => {
    const { default: VisitorsPage } = await import('../src/app/admin/visitors/page');
    await expect(VisitorsPage()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('is not linked from any public page or in the sitemap', () => {
    const sitemap = read('src/app/sitemap.ts');
    expect(sitemap).not.toMatch(/admin\/visitors/);
    const srcFiles = ['src/app/page.tsx', 'src/components/layout/Footer.tsx'].filter((f) => {
      try { read(f); return true; } catch { return false; }
    });
    for (const f of srcFiles) expect(read(f)).not.toMatch(/admin\/visitors/);
  });
});
