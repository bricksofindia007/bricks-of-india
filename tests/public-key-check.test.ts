/**
 * Public-key access check: anon must be refused on the price tables and allowed on sets (order 1440 item 2).
 * Uses a fake fetch: no network, no key.
 */
import { describe, it, expect } from 'vitest';
import { CLOSED, OPEN, WRITE_PROBE, runCheck } from '../scripts/ci/public-key-check.mjs';

const BASE = 'https://staging.example.supabase.co';
const KEY = 'test-public-key';

// A fake PostgREST: relations in `openTables` answer 200 with a row; everything else answers 401 with 42501.
function fakeFetch(openTables: string[], opts: { writeRefused?: boolean; rpcRefused?: boolean } = {}): typeof fetch {
  return (async (input: string, init: any = {}) => {
    const u = new URL(input);
    const path = u.pathname;
    if (path.startsWith('/rest/v1/rpc/')) {
      const body = opts.rpcRefused === false ? 'function done' : 'permission denied for function reject_video_post';
      return { status: 401, text: async () => body } as any;
    }
    const table = path.replace('/rest/v1/', '');
    if (init.method === 'PATCH') {
      // Anon writes are refused on every table: reads may be open, writes never are.
      const refused = opts.writeRefused !== false;
      return { status: refused ? 401 : 204, text: async () => (refused ? '{"code":"42501","message":"permission denied for table ' + table + '"}' : '') } as any;
    }
    if (openTables.includes(table)) return { status: 200, text: async () => '[{"id":1}]' } as any;
    return { status: 401, text: async () => '{"code":"42501","message":"permission denied for table ' + table + '"}' } as any;
  }) as unknown as typeof fetch;
}

describe('public-key check: the price tables are closed to anon, sets stays open', () => {
  it('store_prices and price_history are in the closed list, not the open list', () => {
    expect(CLOSED).toContain('store_prices');
    expect(CLOSED).toContain('price_history');
    expect(OPEN).not.toContain('store_prices');
    expect(OPEN).not.toContain('price_history');
  });

  it('sets is still open to anon', () => {
    expect(OPEN).toContain('sets');
    expect(CLOSED).not.toContain('sets');
  });

  it('no relation is in both lists', () => {
    for (const t of OPEN) expect(CLOSED).not.toContain(t);
  });

  it('the write probes include the price table (refused)', () => {
    expect(WRITE_PROBE).toContain('store_prices');
  });

  it('passes when the price tables refuse anon and sets is readable', async () => {
    const open = [...OPEN];
    const fails = await runCheck(BASE, KEY, fakeFetch(open));
    expect(fails).toEqual([]);
  });

  it('fails when anon can read a price table (negative test)', async () => {
    const open = [...OPEN, 'store_prices'];
    const fails = await runCheck(BASE, KEY, fakeFetch(open));
    expect(fails).toContain('open: store_prices (200)');
  });

  it('fails when anon can read price history (negative test)', async () => {
    const open = [...OPEN, 'price_history'];
    const fails = await runCheck(BASE, KEY, fakeFetch(open));
    expect(fails).toContain('open: price_history (200)');
  });

  it('fails when sets is closed to anon', async () => {
    const open = OPEN.filter((t) => t !== 'sets');
    const fails = await runCheck(BASE, KEY, fakeFetch(open));
    expect(fails).toContain('closed: sets (401)');
  });
});
