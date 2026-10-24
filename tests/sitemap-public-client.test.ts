// B4 follow-up: the sitemap's client is the service client unless the flag is on. Off by default, mirrored in Python.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';

describe('sitemap client flag', () => {
  it('is off by default in TypeScript and in the Python mirror', () => {
    expect(FEATURE_FLAGS.sitemapPublicClient).toBe(false);
    expect(readFileSync(join(__dirname, '..', 'config/feature_flags.py'), 'utf8')).toMatch(/"sitemap_public_client":\s*False/);
  });
  it('the sitemap chooses its client by the flag', () => {
    const src = readFileSync(join(__dirname, '..', 'src/app/sitemap.ts'), 'utf8');
    expect(src).toMatch(/FEATURE_FLAGS\.sitemapPublicClient \? createPublicClient/);
  });
});

describe('the narrow priced-set source', () => {
  const sql = readFileSync(join(__dirname, '..', 'supabase/migrations/20261024190000_priced_set_numbers.sql'), 'utf8');
  it('returns only the set number: no price, store or product columns', () => {
    expect(sql).toMatch(/returns table \(set_number text\)/);
    expect(sql).not.toMatch(/price_inr\s*,|product_url|store_id|in_stock/);
  });
  it('is granted to anon only through the explicit grant, with a rollback file', () => {
    expect(sql).toMatch(/grant execute on function public\.priced_set_numbers\(\) to anon, authenticated/);
    expect(readFileSync(join(__dirname, '..', 'supabase/rollbacks/20261024190000_priced_set_numbers.rollback.sql'), 'utf8')).toMatch(/drop function if exists public\.priced_set_numbers/);
  });
});
