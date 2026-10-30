// P5 client (order 0230): the session and save mapping, with a stub fetch. No DOM and no network.
import { describe, it, expect, vi } from 'vitest';
import { createAccountClient, saveTarget, sessionFromHttp } from '../src/lib/account-client';

const reply = (status: number, body: unknown = {}) => ({ status, json: async () => body });

describe('session state from the server status', () => {
  it('200 is signed in; 401 and 404 are signed out (404 = accounts off, a guest)', () => {
    expect(sessionFromHttp(200)).toBe('signed-in');
    expect(sessionFromHttp(401)).toBe('signed-out');
    expect(sessionFromHttp(404)).toBe('signed-out');
  });

  it('anything else is unavailable, never signed out', () => {
    expect(sessionFromHttp(503)).toBe('unavailable');
    expect(sessionFromHttp(500)).toBe('unavailable');
  });
});

describe('where a save goes', () => {
  it('signed in: the account; signed out: the browser', () => {
    expect(saveTarget('signed-in')).toBe('account');
    expect(saveTarget('signed-out')).toBe('browser');
  });

  it('unknown or unavailable: nothing is saved (no false claim)', () => {
    expect(saveTarget('unknown')).toBe('none');
    expect(saveTarget('unavailable')).toBe('none');
  });
});

describe('the client asks the server and reports honestly', () => {
  it('state() reads the lists route with GET', async () => {
    const f = vi.fn(async () => reply(200, { status: 'ok', lists: { wishlist: [], collection: [] } }));
    const c = createAccountClient(f as any);
    expect(await c.state()).toBe('signed-in');
    expect(f).toHaveBeenCalledWith('/api/account/lists');
  });

  it('a network failure on the state read is unavailable', async () => {
    const c = createAccountClient((async () => { throw new Error('offline'); }) as any);
    expect(await c.state()).toBe('unavailable');
  });

  it('add sends a POST with the list, the set and the copies', async () => {
    const f = vi.fn(async () => reply(200, { status: 'ok' }));
    const r = await createAccountClient(f as any).add('collection', '90001', 2);
    expect(r.status).toBe('ok');
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe('/api/account/lists');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ list: 'collection', set: '90001', qty: 2 });
  });

  it('remove sends a DELETE with the list and the set', async () => {
    const f = vi.fn(async () => reply(200, { status: 'ok' }));
    await createAccountClient(f as any).remove('wishlist', '90001');
    const [, init] = f.mock.calls[0] as any;
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body)).toEqual({ list: 'wishlist', set: '90001' });
  });

  it('409 is limit, 400 is invalid, 401 is signed-out, 503 is unavailable', async () => {
    const codes: [number, string][] = [[409, 'limit'], [400, 'invalid'], [401, 'signed-out'], [503, 'unavailable']];
    for (const [http, want] of codes) {
      const c = createAccountClient((async () => reply(http, { status: 'x' })) as any);
      expect((await c.add('wishlist', '90001')).status).toBe(want);
    }
  });

  it('a network failure on a save is unavailable: nothing is claimed as saved', async () => {
    const c = createAccountClient((async () => { throw new Error('offline'); }) as any);
    expect((await c.add('wishlist', '90001')).status).toBe('unavailable');
    expect((await c.remove('wishlist', '90001')).status).toBe('unavailable');
  });

  it('a save with no copies count sends no qty field', async () => {
    const f = vi.fn(async () => reply(200, { status: 'ok' }));
    await createAccountClient(f as any).add('wishlist', '90001');
    const [, init] = f.mock.calls[0] as any;
    expect(JSON.parse(init.body)).toEqual({ list: 'wishlist', set: '90001' });
  });
});
