import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const rpc = vi.fn();
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }));
vi.mock('@/lib/get-secret', () => ({ getSecret: () => 'test-key' }));

import { POST } from '../src/app/api/standee-visit/route';
import { isStandeeTag } from '../src/lib/standee';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';

const flags = FEATURE_FLAGS as unknown as Record<string, boolean>;
const req = (body: unknown) =>
  new NextRequest('https://bricksofindia.com/api/standee-visit', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
  });

beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: null, error: null }); (process.env as any).NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'; });
afterEach(() => { flags.standeeTracking = false; });

describe('standee tags', () => {
  it('accepts only the closed list', () => {
    expect(isStandeeTag('standee_qr')).toBe(true);
    expect(isStandeeTag('other')).toBe(false);
    expect(isStandeeTag(undefined)).toBe(false);
    expect(isStandeeTag(42)).toBe(false);
  });
});

describe('standee counter route', () => {
  it('flag off: 404 and nothing is written', async () => {
    const res = await POST(req({ tag: 'standee_qr' }));
    expect(res.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('flag on: a valid tag is counted once and answers 204, never cached', async () => {
    flags.standeeTracking = true;
    const res = await POST(req({ tag: 'standee_qr' }));
    expect(res.status).toBe(204);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('record_standee_visit', { p_tag: 'standee_qr' });
  });

  it('flag on: a tag not on the list is refused and nothing is written', async () => {
    flags.standeeTracking = true;
    const res = await POST(req({ tag: 'made_up' }));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('flag on: a body that is not JSON is refused', async () => {
    flags.standeeTracking = true;
    const res = await POST(req('not json'));
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('flag on: a failed write still answers 204 so the visitor page is not affected', async () => {
    flags.standeeTracking = true;
    rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    const res = await POST(req({ tag: 'standee_qr' }));
    expect(res.status).toBe(204);
  });

  it('flag on: a missing setting still answers 204 and writes nothing', async () => {
    flags.standeeTracking = true;
    delete (process.env as any).NEXT_PUBLIC_SUPABASE_URL;
    const res = await POST(req({ tag: 'standee_qr' }));
    expect(res.status).toBe(204);
    expect(rpc).not.toHaveBeenCalled();
  });
});
