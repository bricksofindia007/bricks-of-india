// Bundle 3 item 2: the five price functions are callable by service_role only, and no browser-role call path remains.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const FUNCS = ['get_set_prices', 'get_price_history', 'get_price_summary_for_set', 'get_last_seen_prices', 'get_usd_inr_rate'];

describe('migration 20261022180000', () => {
  const sql = readFileSync(join(root, 'supabase/migrations/20261022180000_price_functions_service_only.sql'), 'utf8');
  for (const f of FUNCS) {
    it(`revokes anon and authenticated execute on ${f}`, () => {
      expect(sql).toMatch(new RegExp(`revoke execute on function public\.${f}\(.*?\) from anon, authenticated;`));
    });
    it(`grants ${f} to service_role only`, () => {
      expect(sql).toMatch(new RegExp(`grant execute on function public\.${f}\(.*?\) to service_role;`));
    });
  }
  it('has a rollback that restores the anon grants', () => {
    const down = readFileSync(join(root, 'supabase/rollbacks/20261022180000_price_functions_service_only.down.sql'), 'utf8');
    for (const f of FUNCS) expect(down).toMatch(new RegExp(`grant execute on function public\.${f}\(.*?\) to anon, authenticated;`));
  });
});

describe('no browser-role price call path', () => {
  const files = [
    'src/app/reviews/[slug]/page.tsx',
    'src/lib/price-summary.ts',
    'src/app/api/last-seen-prices/route.ts',
    'src/lib/usd-rate-server.ts',
  ];
  it('no file calls the price functions through the public client', () => {
    for (const f of files) {
      const src = readFileSync(join(root, f), 'utf8');
      expect(src, f).not.toMatch(/createPublicClient\(/);
    }
  });
  it('the client-safe rate module does not import the server client', () => {
    const src = readFileSync(join(root, 'src/lib/usd-rate-reader.ts'), 'utf8');
    expect(src).not.toMatch(/from '\.\/supabase'/);
    expect(src).not.toMatch(/createServerClient|createPublicClient/);
  });
  it('the search route sends no prices key', () => {
    const src = readFileSync(join(root, 'src/app/api/sets/search/route.ts'), 'utf8');
    expect(src).not.toMatch(/prices:\s*\[\]/);
  });
  it('the migrations directory has no later grant that re-opens anon on these functions', () => {
    const later = readdirSync(join(root, 'supabase/migrations')).filter((n) => /^\d{14}_.*\.sql$/.test(n) && n > '20261022180000_');
    for (const n of later) {
      const src = readFileSync(join(root, 'supabase/migrations', n), 'utf8');
      for (const f of FUNCS) expect(src, n).not.toMatch(new RegExp(`grant execute on function public\.${f}[^;]*anon`));
    }
  });
});
