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
    await store.createSession('new-acc', 'h'.repeat(64), 5, 7);
    const sessionInsert = calls.filter((c) => c[0] === 'insert').pop();
    expect(sessionInsert?.[1]).toMatchObject({ account_id: 'new-acc', token_hash: 'h'.repeat(64) });
    // A real sign-in records the time on the account (the 24-month rule reads it).
    expect(calls).toContainEqual(['update', { last_seen_at: new Date(7).toISOString() }]);
    expect(calls).toContainEqual(['eq', 'id', 'new-acc']);
    expect(JSON.stringify(sessionInsert)).not.toMatch(/token"|"token"/);
  });
});

describe('the mailer', () => {
  it('uses the approved subject and the "Didn\'t ask for this?" line, with the code and the expiry', () => {
    const msg = signInMessage('123456');
    expect(msg.subject).toBe('Your Bricks of India code');
    expect(msg.text).toContain("Didn't ask for this? Ignore this email.");
    expect(msg.text).toContain('123456');
    expect(msg.text).toContain('10 minutes');
  });
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

describe('the sign-in form uses the approved age wording', () => {
  it('the 18+ box label is the approved checkbox text, and no placeholder remains', () => {
    const form = read('src/app/auth/SignInForm.tsx');
    expect(form).toMatch(/\{AGE_RULE_COPY\.signUpCheckbox\}/);
    expect(form).not.toMatch(/I am 18 or older/);
  });
});

// Account deletion: the approved text says a visitor signs in, opens My BOI, chooses Delete my account, and confirms with
// the emailed code. These tests cover the server side and the page gate.
import { accountForSession, deleteAccountAndCodes } from '../src/lib/signin-store';
import { POST as postDeleteRequest } from '../src/app/account/delete/request/route';
import { POST as postDeleteConfirm } from '../src/app/account/delete/confirm/route';

// A fake client that answers each table from its own result, and records the calls made against it.
function tableDb(tables: Record<string, { data?: unknown; error?: unknown }>) {
  const calls: Array<[string, string, ...unknown[]]> = [];
  const db = {
    from(table: string) {
      const value = { data: tables[table]?.data ?? null, error: tables[table]?.error ?? null };
      const b: any = {};
      for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'is', 'gt', 'order', 'limit']) {
        b[m] = (...args: unknown[]) => { calls.push([table, m, ...args]); return b; };
      }
      b.maybeSingle = () => Promise.resolve(value);
      b.single = () => Promise.resolve(value);
      b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(value).then(res, rej);
      return b;
    },
  };
  return { db: db as any, calls };
}

describe('account deletion: the session check', () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  it('a live session returns the account', async () => {
    const { db } = tableDb({
      account_sessions: { data: { account_id: 'acc-1', expires_at: future, revoked_at: null } },
      accounts: { data: { id: 'acc-1', email: 'reader@example.com' } },
    });
    expect(await accountForSession(db, 'h'.repeat(64), Date.now())).toEqual({ id: 'acc-1', email: 'reader@example.com' });
  });
  it('a revoked session returns nothing', async () => {
    const { db } = tableDb({ account_sessions: { data: { account_id: 'acc-1', expires_at: future, revoked_at: new Date().toISOString() } } });
    expect(await accountForSession(db, 'h'.repeat(64), Date.now())).toBeNull();
  });
  it('an expired session returns nothing', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const { db } = tableDb({ account_sessions: { data: { account_id: 'acc-1', expires_at: past, revoked_at: null } } });
    expect(await accountForSession(db, 'h'.repeat(64), Date.now())).toBeNull();
  });
  it('an unknown session returns nothing', async () => {
    const { db } = tableDb({ account_sessions: { data: null } });
    expect(await accountForSession(db, 'h'.repeat(64), Date.now())).toBeNull();
  });
});

describe('account deletion: the delete itself', () => {
  it('removes the sign-in codes for the address first, then the account', async () => {
    const { db, calls } = tableDb({});
    await deleteAccountAndCodes(db, 'acc-1', 'e'.repeat(64));
    const order = calls.filter((c) => c[1] === 'delete').map((c) => c[0]);
    expect(order).toEqual(['sign_in_codes', 'accounts']);
    expect(calls).toContainEqual(['sign_in_codes', 'eq', 'email_hash', 'e'.repeat(64)]);
    expect(calls).toContainEqual(['accounts', 'eq', 'id', 'acc-1']);
  });
  it('a failed code removal stops before the account is touched', async () => {
    const { db, calls } = tableDb({ sign_in_codes: { error: { message: 'down' } } });
    await expect(deleteAccountAndCodes(db, 'acc-1', 'e'.repeat(64))).rejects.toThrow();
    expect(calls.some((c) => c[0] === 'accounts' && c[1] === 'delete')).toBe(false);
  });
});

describe('account deletion: the routes and page', () => {
  it('both routes answer 404 while sign-in is off', async () => {
    const req = () => new Request('https://bricksofindia.com/account/delete', { method: 'POST', body: '{"code":"123456"}' }) as any;
    expect((await postDeleteRequest(req())).status).toBe(404);
    expect((await postDeleteConfirm(req())).status).toBe(404);
  });
  it('the request route takes no address from the client: it uses the session account only', () => {
    const src = read('src/app/account/delete/request/route.ts');
    expect(src).not.toMatch(/request\.json\(\)/);
    expect(src).toMatch(/rawEmail: account\.email/);
  });
  it('the confirm route clears the cookie only on success, with the same path as the session', () => {
    const src = read('src/app/account/delete/confirm/route.ts');
    expect(src).toMatch(/res\.cookies\.set\(SESSION_COOKIE, '', \{ \.\.\.SESSION_COOKIE_OPTIONS, maxAge: 0 \}\)/);
    expect(SESSION_COOKIE_OPTIONS.path).toBe('/account');
  });
  it('the page is closed while sign-in is off, and uses the approved words for its heading and button', () => {
    const page = read('src/app/account/page.tsx');
    expect(page).toMatch(/if \(!signInOn\(\)\) notFound\(\);/);
    expect(page).toMatch(/My BOI/);
    expect(read('src/app/account/AccountDeleteForm.tsx')).toMatch(/Delete my account/);
  });
  it('the deletion page flag stays off in both files', () => {
    expect(FEATURE_FLAGS.dataDeletionPage).toBe(false);
    expect(read('config/feature_flags.py')).toMatch(/"data_deletion_page": False/);
  });
});
