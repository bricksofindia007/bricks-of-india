// Human check on the admin sign-in form: off by default, fails closed, and the flag mirrors.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { turnstileRequired, verifyTurnstile } from '../src/lib/turnstile';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';

const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('flag', () => {
  it('is off by default in TypeScript and in the Python mirror', () => {
    expect(FEATURE_FLAGS.adminTurnstile).toBe(false);
    expect(turnstileRequired(FEATURE_FLAGS)).toBe(false);
    expect(readFileSync(join(__dirname, '..', 'config/feature_flags.py'), 'utf8')).toMatch(/"admin_turnstile":\s*False/);
  });
});

describe('verification fails closed', () => {
  it('no secret: refused and no request is sent', async () => {
    const f = vi.fn(async () => ok({ success: true }));
    expect(await verifyTurnstile('tok', '1.2.3.4', undefined, f as any)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it('no token: refused and no request is sent', async () => {
    const f = vi.fn(async () => ok({ success: true }));
    expect(await verifyTurnstile('', '1.2.3.4', 'sec', f as any)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it('the service refuses the token', async () => {
    expect(await verifyTurnstile('tok', '1.2.3.4', 'sec', (async () => ok({ success: false })) as any)).toBe(false);
  });
  it('a non-success HTTP answer is refused', async () => {
    expect(await verifyTurnstile('tok', '1.2.3.4', 'sec', (async () => ok({ success: true }, 500)) as any)).toBe(false);
  });
  it('a network error is refused', async () => {
    expect(await verifyTurnstile('tok', '1.2.3.4', 'sec', (async () => { throw new Error('down'); }) as any)).toBe(false);
  });
  it('a valid token is accepted, and the client address is sent', async () => {
    const f = vi.fn(async () => ok({ success: true }));
    expect(await verifyTurnstile('tok', '1.2.3.4', 'sec', f as any)).toBe(true);
    const body = (f.mock.calls[0] as any)[1].body as URLSearchParams;
    expect(body.get('response')).toBe('tok');
    expect(body.get('remoteip')).toBe('1.2.3.4');
  });
});
