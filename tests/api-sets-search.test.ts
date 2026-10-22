// Negative tests for the public set search endpoint, as an anonymous visitor would reach it.
// The Supabase client is mocked so each test can see the key used and every select string.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const created: Array<{ url: string; key: string }> = [];
const selects: string[] = [];
let rows: Array<Record<string, unknown>> = [];

vi.mock('@supabase/supabase-js', () => ({
  createClient: (url: string, key: string) => {
    created.push({ url, key });
    const builder = {
      select(cols: string) { selects.push(cols); return builder; },
      order() { return builder; },
      range() { return builder; },
      or() { return builder; },
      ilike() { return builder; },
      gte() { return builder; },
      lte() { return builder; },
      in() { return builder; },
      then(resolve: (v: unknown) => unknown) {
        return resolve({ data: rows, count: rows.length, error: null });
      },
    };
    return { from: () => builder };
  },
}));

vi.mock('@/lib/rebrickable', () => ({
  searchSets: async () => ({ results: [], count: 0 }),
}));

import { GET } from '@/app/api/sets/search/route';

const SERVICE = 'service-role-test-value';
const ANON = 'anon-test-value';

function req(path: string) {
  return new Request(`https://bricksofindia.com${path}`);
}

describe('public set search: negative tests (anonymous visitor)', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    created.length = 0;
    selects.length = 0;
    rows = [];
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.example';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE;
  });

  afterEach(() => {
    process.env = { ...saved };
  });

  it('never creates a client with the service-role key', async () => {
    await GET(req('/api/sets/search?theme=star-wars') as never);
    expect(created.length).toBeGreaterThan(0);
    for (const c of created) expect(c.key).toBe(ANON);
    expect(created.some((c) => c.key === SERVICE)).toBe(false);
  });

  it('refuses to fall back to the service-role key when the anonymous key is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const res = await GET(req('/api/sets/search?theme=star-wars') as never);
    expect(res.status).toBe(500);
    expect(created.some((c) => c.key === SERVICE)).toBe(false);
  });

  it('never asks the database for price rows', async () => {
    await GET(req('/api/sets/search?theme=star-wars') as never);
    expect(selects.length).toBeGreaterThan(0);
    for (const s of selects) expect(s).not.toMatch(/prices/);
  });

  it('strips price rows from the response even if the database returns them', async () => {
    rows = [{ id: 1, set_number: '75419', name: 'Death Star', prices: [{ store_id: 'toycra', price_inr: 9999 }] }];
    const res = await GET(req('/api/sets/search?theme=star-wars') as never);
    const body = (await res.json()) as { sets: Array<Record<string, unknown>> };
    expect(body.sets[0]).not.toHaveProperty('prices');
    expect(JSON.stringify(body)).not.toContain('9999');
  });

  it('returns the set rows without price data for a plain search', async () => {
    rows = [{ id: 2, set_number: '10305', name: 'Lion Knights', prices: [{ price_inr: 1 }] }];
    const res = await GET(req('/api/sets/search?theme=lion') as never);
    expect(res.status).toBe(200);
    expect(JSON.stringify(await res.json())).not.toContain('price_inr');
  });
});
