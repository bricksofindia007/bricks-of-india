// Sign-in wiring (pillar H, flag off): the store, the mailer, the session helpers, the routes and the page.
// Nothing here reaches a real mail provider or database: the client and the fetch call are stubbed.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SupabaseSignInStore } from '../src/lib/signin-store';
import { ResendCodeMailer, SIGN_IN_FROM, SIGN_IN_REPLY_TO, signInMessage } from '../src/lib/signin-mailer';
import { MailRefused } from '../src/lib/signin-email';
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, newSessionToken, sessionTokenHash } from '../src/lib/account-session';
import { signInOn } from '../src/lib/signin-gate';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';
import { POST as postCode } from '../src/app/auth/code/route';
import { POST as postVerify } from '../src/app/auth/verify/route';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// A chainable stand-in for the Supabase query builder. Every chain resolves to the configured result.
function fakeDb(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const value = { data: result.data ?? null, error: result.error ?? null, count: result.count ?? null };
  const builder = (): any => {
    const b: any = {};
    for (const m of ['select', 'insert', 'update', 'eq', 'is', 'gt', 'order', 'limit']) {
      b[m] = (...args: unknown[]) => {
        calls.push([m, ...args]);
        return b;
      };
    }
    b.maybeSingle = () => Promise.resolve(value);
    b.single = () => Promise.resolve(value);
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(value).then(res, rej);
    return b;
  };
  return {
    calls,
    db: { from: (table: string) => { calls.push(['from', table]); return builder(); } } as any,
  };
}

describe('the store', () => {
  it('counts only sends that were not released', async () => {
    const { db, calls } = fakeDb({ count: 7 });
    expect(await new SupabaseSignInStore(db).readSendCount('2026-10-25')).toBe(7);
    expect(calls).toContainEqual(['is', 'released_at', null]);
  });
  it('a count that cannot be read throws, so no send happens', async () => {
    const { db } = fakeDb({ error: { message: 'down' } });
    await expect(new SupabaseSignInStore(db).readSendCount('2026-10-25')).rejects.toThrow();
  });
  it('a release that changes no row returns false (given back at most once)', async () => {
    const { db } = fakeDb({ data: [] });
    expect(await new SupabaseSignInStore(db).releaseSend('2026-10-25', 'a'.repeat(16))).toBe(false);
  });
  it('a release that changes one row returns true', async () => {
    const { db } = fakeDb({ data: [{ send_id: 'x' }] });
    expect(await new SupabaseSignInStore(db).releaseSend('2026-10-25', 'a'.repeat(16))).toBe(true);
  });
  it('an account lookup is by the normalised address, and skips deleted accounts', async () => {
    const { db, calls } = fakeDb({ data: { id: 'acc' } });
    expect(await new SupabaseSignInStore(db).accountExists('someone@example.com')).toBe(true);
    expect(calls).toContainEqual(['eq', 'email', 'someone@example.com']);
    expect(calls).toContainEqual(['is', 'deleted_at', null]);
  });
  it('a stored code keeps the hash, never the address', async () => {
    const { db, calls } = fakeDb({});
    await new SupabaseSignInStore(db).insertCode({ id: 'i'.repeat(16), emailHash: 'e'.repeat(64), codeHash: 'c'.repeat(64), expiresAt: 2, issuedAt: 1 });
    const insert = calls.find((c) => c[0] === 'insert');
    expect(JSON.stringify(insert)).not.toMatch(/@/);
    expect(insert?.[1]).toMatchObject({ email_hash: 'e'.repeat(64), code_hash: 'c'.repeat(64) });
  });
  it('an account is created with the address, and a session keeps only the token hash', async () => {
    const { db, calls } = fakeDb({ data: { id: 'new-acc' } });
    const store = new SupabaseSignInStore(db);
    expect(await store.createAccount('new@example.com')).toBe('new-acc');
    expect(calls).toContainEqual(['insert', { email: 'new@example.com' }]);
    await store.createSession('new-acc', 'h'.repeat(64), 5);
    const sessionInsert = calls.filter((c) => c[0] === 'insert').pop();
    expect(sessionInsert?.[1]).toMatchObject({ account_id: 'new-acc', token_hash: 'h'.repeat(64) });
    expect(JSON.stringify(sessionInsert)).not.toMatch(/token"|"token"/);
  });
});

describe('the mailer', () => {
  it('posts one message from login@ with reply-to hello@, and the idempotency key', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-value');
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await new ResendCodeMailer().send('reader@example.com', { code: '123456' }, 'signin:abc');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    const sent = JSON.parse(String(init.body));
    expect(sent.from).toBe(SIGN_IN_FROM);
    expect(sent.reply_to).toBe(SIGN_IN_REPLY_TO);
    expect(sent.to).toEqual(['reader@example.com']);
    expect(sent.text).toContain('123456');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('signin:abc');
  });
  it('the subject and body carry the code and the expiry only: no address', () => {
    const m = signInMessage('654321');
    expect(m.text).toContain('654321');
    expect(`${m.subject} ${m.text}`).not.toMatch(/@/);
  });
  it('a 4xx refusal is a clear refusal (the send is given back)', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-value');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 422 })));
    await expect(new ResendCodeMailer().send('a@example.com', { code: '000000' }, 'signin:x')).rejects.toBeInstanceOf(MailRefused);
  });
  it('a server error or a timeout is unclear (the send stays counted)', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-value');
    for (const status of [500, 408]) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status })));
      const err = await new ResendCodeMailer().send('a@example.com', { code: '000000' }, 'signin:x').catch((e) => e);
      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(MailRefused);
    }
  });
  it('no key configured: refused before any request leaves', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(new ResendCodeMailer().send('a@example.com', { code: '000000' }, 'signin:x')).rejects.toBeInstanceOf(MailRefused);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('the session helpers', () => {
  it('a token is long, random and URL-safe; its stored form is a 64-character hash, not the token', () => {
    const t = newSessionToken();
    expect(t.length).toBeGreaterThanOrEqual(43);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(newSessionToken()).not.toBe(t);
    const h = sessionTokenHash(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain(t);
  });
  it('the cookie is httpOnly, secure, lax, and only on the account paths', () => {
    expect(SESSION_COOKIE).toBe('boi_account');
    expect(SESSION_COOKIE_OPTIONS).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/account' });
  });
});

describe('the gate and the routes: off by default', () => {
  it('the sign-in gate is closed with the flags off', () => {
    expect(FEATURE_FLAGS.accountsEnabled).toBe(false);
    expect(FEATURE_FLAGS.signInByEmail).toBe(false);
    expect(signInOn()).toBe(false);
  });
  it('the code route answers 404 and does no work', async () => {
    const res = await postCode(new Request('https://bricksofindia.com/auth/code', { method: 'POST', body: '{"email":"a@example.com"}' }) as any);
    expect(res.status).toBe(404);
  });
  it('the verify route answers 404 and sets no cookie', async () => {
    const res = await postVerify(new Request('https://bricksofindia.com/auth/verify', { method: 'POST', body: '{"email":"a@example.com","code":"123456"}' }) as any);
    expect(res.status).toBe(404);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
  it('the page calls notFound while the gate is closed', () => {
    const page = read('src/app/auth/page.tsx');
    expect(page).toMatch(/if \(!signInOn\(\)\) notFound\(\);/);
    expect(page).toMatch(/robots: \{ index: false, follow: false \}/);
  });
  it('the flags are off in both mirrored files', () => {
    expect(read('src/lib/feature-flags.ts')).toMatch(/signInByEmail: false,/);
    expect(read('config/feature_flags.py')).toMatch(/"sign_in_by_email": False,/);
  });
});

describe('the migration', () => {
  const sql = read('supabase/migrations/20261025010000_signin_codes.sql');
  it('turns on row level security for every new table and grants only the service role', () => {
    for (const t of ['sign_in_codes', 'sign_in_sends', 'account_sessions']) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
    }
    expect(sql).toMatch(/revoke all on public\.sign_in_codes, public\.sign_in_sends, public\.account_sessions from public, anon, authenticated/);
    expect(sql).toMatch(/to service_role;/);
    expect(sql).not.toMatch(/to anon|to authenticated/);
  });
  it('stores no address: no email column in the new tables', () => {
    expect(sql).not.toMatch(/\bemail\b\s+text/i);
  });
  it('has a rollback that drops the three tables', () => {
    const rb = read('supabase/rollbacks/20261025010000_signin_codes.rollback.sql');
    for (const t of ['account_sessions', 'sign_in_sends', 'sign_in_codes']) {
      expect(rb).toMatch(new RegExp(`drop table if exists public\\.${t}`));
    }
  });
});
