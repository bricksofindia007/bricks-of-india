// Sign-in by email code: rules tested with an in-memory store and a stub mailer. No real email is sent.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';
import {
  beginSignIn, finishSignIn, verifySignInCode, emailHash, codeHash, dayKey, normaliseEmail, MailRefused, REPLY_OK, sameHash,
  CODE_TTL_MS, CODE_MAX_ATTEMPTS, CODE_COOLDOWN_MS, DAILY_SEND_STOP, DAILY_SEND_WARN, MSG_CHECK_EMAIL, MSG_INVALID,
  type SignInDeps, type SignInStore, type Reply,
} from '../src/lib/signin-email';

const KEY = 'test-key-not-a-secret';
const T0 = Date.UTC(2026, 9, 23, 12, 0, 0);
const DAY = dayKey(T0);

function memStore() {
  const sends = new Map<string, number>();
  const reservations = new Map<string, { day: string; released: boolean }>();
  const accounts = new Set<string>();
  const calls: string[] = [];
  const codes: Array<{ id: string; emailHash: string; codeHash: string; expiresAt: number; issuedAt: number; attempts: number; consumed: boolean }> = [];
  const store = {
    failRead: false,
    failReserve: false,
    codes,
    accounts,
    sends,
    reservations,
    calls,
    async readSendCount(day: string) {
      calls.push('readSendCount');
      if (this.failRead) throw new Error('unreadable');
      return sends.get(day) ?? 0;
    },
    async reserveSend(day: string, sendId: string) {
      calls.push('reserveSend');
      if (this.failReserve) throw new Error('write failed');
      sends.set(day, (sends.get(day) ?? 0) + 1);
      reservations.set(sendId, { day, released: false });
    },
    async releaseSend(day: string, sendId: string) {
      calls.push('releaseSend');
      const r = reservations.get(sendId);
      if (!r || r.released) return false;
      r.released = true;
      sends.set(day, (sends.get(day) ?? 0) - 1);
      return true;
    },
    async accountExists(email: string) { calls.push('accountExists'); return accounts.has(email); },
    async lastCodeIssuedAt(eh: string) {
      calls.push('lastCodeIssuedAt');
      const rows = codes.filter((c) => c.emailHash === eh);
      return rows.length ? Math.max(...rows.map((c) => c.issuedAt)) : null;
    },
    async insertCode(row: { id: string; emailHash: string; codeHash: string; expiresAt: number; issuedAt: number }) {
      calls.push('insertCode');
      codes.push({ ...row, attempts: 0, consumed: false });
    },
    async openCode(eh: string, now: number) {
      calls.push('openCode');
      const row = [...codes].reverse().find((c) => c.emailHash === eh && !c.consumed && c.expiresAt > now);
      return row ? { id: row.id, codeHash: row.codeHash, attempts: row.attempts } : null;
    },
    // Each call's body runs without an await in the middle, so one call adds exactly one attempt, as the database does.
    async bumpAttempts(id: string, now: number) {
      calls.push('bumpAttempts');
      const r = codes.find((c) => c.id === id && !c.consumed && c.expiresAt > now);
      if (!r) return null;
      r.attempts += 1;
      return r.attempts;
    },
    async consumeCode(id: string) {
      calls.push('consumeCode');
      const r = codes.find((c) => c.id === id && !c.consumed);
      if (!r) return false;
      r.consumed = true;
      return true;
    },
  };
  return { store, sends, reservations, calls };
}

type MailBehaviour = 'ok' | 'refuse' | 'timeout';

function deps(store: SignInStore, opts: { code?: string; mail?: MailBehaviour; enabled?: boolean; onSend?: () => void } = {}) {
  const sent: Array<{ to: string; code: string; key: string }> = [];
  const d: SignInDeps = {
    store,
    hashKey: KEY,
    randomCode: () => opts.code ?? '123456',
    enabled: () => opts.enabled ?? true,
    mailer: {
      async send(to, body, key) {
        opts.onSend?.();
        if (opts.mail === 'refuse') throw new MailRefused();
        if (opts.mail === 'timeout') throw new Error('timed out');
        sent.push({ to, code: body.code, key });
      },
    },
  };
  return { d, sent };
}

/** Handle a request the way the platform does: reply first, then run the scheduled tasks. */
async function request(input: { rawEmail: string; ageConfirmed: boolean; now?: number }, d: SignInDeps) {
  const tasks: Array<() => Promise<void>> = [];
  const reply: Reply = beginSignIn(input, d, (t) => tasks.push(t));
  const scheduled = tasks.length;
  for (const t of tasks) await t();
  return { reply, scheduled };
}

let mem: ReturnType<typeof memStore>;
beforeEach(() => { mem = memStore(); });

describe('flag', () => {
  it('is off, and the Python mirror agrees', () => {
    expect(FEATURE_FLAGS.signInByEmail).toBe(false);
    expect(readFileSync(join(__dirname, '..', 'config', 'feature_flags.py'), 'utf8')).toMatch(/"sign_in_by_email": False/);
  });
  it('with the flag off, nothing is scheduled, counted, stored or sent', async () => {
    const { d, sent } = deps(mem.store, { enabled: false });
    const { reply, scheduled } = await request({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    expect(reply).toEqual(REPLY_OK);
    expect(scheduled).toBe(0);
    expect(sent).toHaveLength(0);
    expect(mem.store.codes).toHaveLength(0);
    expect(mem.sends.size).toBe(0);
  });
});

describe('the reply is the same for every address', () => {
  it('known and unknown addresses, box ticked or not: identical status and body', async () => {
    mem.store.accounts.add('known@example.com');
    const cases = [
      { rawEmail: 'known@example.com', ageConfirmed: true },
      { rawEmail: 'known@example.com', ageConfirmed: false },
      { rawEmail: 'new@example.com', ageConfirmed: true },
      { rawEmail: 'new@example.com', ageConfirmed: false },
    ];
    const replies: Reply[] = [];
    for (const c of cases) {
      const { d } = deps(mem.store);
      replies.push((await request({ ...c, now: T0 }, d)).reply);
    }
    for (const r of replies) expect(r).toEqual({ status: 200, body: { ok: true, message: MSG_CHECK_EMAIL } });
  });
  it('the daily stop gives the same reply as any other request', async () => {
    mem.sends.set(DAY, DAILY_SEND_STOP);
    const { d, sent } = deps(mem.store);
    const { reply } = await request({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    expect(reply).toEqual(REPLY_OK);
    expect(sent).toHaveLength(0);
  });
  it('an invalid address is refused at once, with its own message, and nothing is scheduled', () => {
    const { d } = deps(mem.store);
    const tasks: unknown[] = [];
    const reply = beginSignIn({ rawEmail: 'not an email', ageConfirmed: true }, d, (t) => tasks.push(t));
    expect(reply).toEqual({ status: 400, body: { ok: false, message: MSG_INVALID } });
    expect(tasks).toHaveLength(0);
  });
  it('the message never mentions the 18+ rule or the account', async () => {
    const { d } = deps(mem.store);
    const { reply } = await request({ rawEmail: 'new@example.com', ageConfirmed: false, now: T0 }, d);
    expect(reply.body.message).not.toMatch(/adult|account|exist|18/i);
  });
});

describe('nothing happens before the reply', () => {
  it('no lookup, count, insert or send runs until the scheduled task runs', async () => {
    const { d, sent } = deps(mem.store);
    const tasks: Array<() => Promise<void>> = [];
    beginSignIn({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d, (t) => tasks.push(t));
    expect(mem.calls).toHaveLength(0);
    expect(sent).toHaveLength(0);
    expect(tasks).toHaveLength(1);
    await tasks[0]();
    expect(mem.calls.length).toBeGreaterThan(0);
    expect(sent).toHaveLength(1);
  });
  it('each request schedules exactly one task, for every case', async () => {
    const cases = [
      { rawEmail: 'a@example.com', ageConfirmed: true },
      { rawEmail: 'a@example.com', ageConfirmed: false },
      { rawEmail: 'bad', ageConfirmed: true },
    ];
    for (const c of cases) {
      const { d } = deps(mem.store);
      const { scheduled } = await request({ ...c, now: T0 }, d);
      expect(scheduled).toBe(c.rawEmail === 'bad' ? 0 : 1);
    }
  });
});

describe('who gets a code', () => {
  it('an unknown address without the box is not sent a code and not stored', async () => {
    const { d, sent } = deps(mem.store);
    const outcome = await finishSignIn({ email: 'new@example.com', ageConfirmed: false, now: T0 }, d);
    expect(outcome).toBe('no-box');
    expect(sent).toHaveLength(0);
    expect(mem.store.codes).toHaveLength(0);
    expect(mem.sends.size).toBe(0);
  });
  it('an existing account is sent a code without the box', async () => {
    mem.store.accounts.add('a@example.com');
    const { d, sent } = deps(mem.store);
    await request({ rawEmail: 'a@example.com', ageConfirmed: false, now: T0 }, d);
    expect(sent).toHaveLength(1);
  });
  it('an unknown address with the box is sent a code', async () => {
    const { d, sent } = deps(mem.store);
    await request({ rawEmail: 'new@example.com', ageConfirmed: true, now: T0 }, d);
    expect(sent).toHaveLength(1);
  });
  it('a second request within 60 seconds is not sent again', async () => {
    const { d, sent } = deps(mem.store);
    await request({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    await request({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 + CODE_COOLDOWN_MS - 1 }, d);
    expect(sent).toHaveLength(1);
    await request({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 + CODE_COOLDOWN_MS }, d);
    expect(sent).toHaveLength(2);
  });
  it('stores a keyed hash of the code, never the code itself', async () => {
    const { d } = deps(mem.store, { code: '654321' });
    await request({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    const row = mem.store.codes[0];
    expect(row.codeHash).toBe(codeHash('654321', 'a@example.com', KEY));
    expect(JSON.stringify(mem.store.codes)).not.toContain('654321');
    expect(row.expiresAt - row.issuedAt).toBe(CODE_TTL_MS);
  });
});

describe('the send is counted before it goes out', () => {
  it('the count already includes the send when the mailer runs', async () => {
    let seenAtSend = -1;
    const { d } = deps(mem.store, { onSend: () => { seenAtSend = mem.sends.get(DAY) ?? 0; } });
    await request({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    expect(seenAtSend).toBe(1);
    expect(mem.sends.get(DAY)).toBe(1);
  });
  it('a clear refusal from the provider gives the count back, once', async () => {
    const { d } = deps(mem.store, { mail: 'refuse' });
    const outcome = await finishSignIn({ email: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    expect(outcome).toBe('refused');
    expect(mem.sends.get(DAY)).toBe(0);
    expect(mem.reservations.size).toBe(1);
    const [sendId] = [...mem.reservations.keys()];
    expect(await mem.store.releaseSend(DAY, sendId)).toBe(false);
    expect(mem.sends.get(DAY)).toBe(0);
  });
  it('a refused send leaves no usable code', async () => {
    const { d } = deps(mem.store, { mail: 'refuse' });
    await finishSignIn({ email: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    expect(mem.store.codes[0].consumed).toBe(true);
  });
  it('a timeout (unclear outcome) keeps the count and drops the code', async () => {
    const { d } = deps(mem.store, { mail: 'timeout' });
    const outcome = await finishSignIn({ email: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    expect(outcome).toBe('unclear');
    expect(mem.sends.get(DAY)).toBe(1);
    expect(mem.store.codes[0].consumed).toBe(true);
  });
  it('a count that cannot be written sends nothing and drops the code', async () => {
    mem.store.failReserve = true;
    const { d, sent } = deps(mem.store);
    const outcome = await finishSignIn({ email: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    expect(outcome).toBe('store-error');
    expect(sent).toHaveLength(0);
    expect(mem.store.codes[0].consumed).toBe(true);
    expect(mem.sends.get(DAY) ?? 0).toBe(0);
  });
  it('a refused send does not use up the daily cap', async () => {
    mem.sends.set(DAY, DAILY_SEND_STOP - 1);
    const { d } = deps(mem.store, { mail: 'refuse' });
    expect(await finishSignIn({ email: 'a@example.com', ageConfirmed: true, now: T0 }, d)).toBe('refused');
    const { d: ok, sent } = deps(mem.store);
    expect(await finishSignIn({ email: 'b@example.com', ageConfirmed: true, now: T0 }, ok)).toBe('sent');
    expect(sent).toHaveLength(1);
    expect(mem.sends.get(DAY)).toBe(DAILY_SEND_STOP);
  });
});

describe('daily send cap', () => {
  it('sends below the stop, nothing at the stop', async () => {
    mem.sends.set(DAY, DAILY_SEND_STOP - 1);
    const { d, sent } = deps(mem.store);
    await request({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    expect(sent).toHaveLength(1);
    const outcome = await finishSignIn({ email: 'b@example.com', ageConfirmed: true, now: T0 }, d);
    expect(outcome).toBe('busy');
    expect(sent).toHaveLength(1);
  });
  it('an unreadable counter sends nothing and stores nothing', async () => {
    mem.store.failRead = true;
    const { d, sent } = deps(mem.store);
    const outcome = await finishSignIn({ email: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    expect(outcome).toBe('counter-unreadable');
    expect(sent).toHaveLength(0);
    expect(mem.store.codes).toHaveLength(0);
  });
  it('the constants match config/spend-limits.json (stop 90, warn at 0.6)', () => {
    const cfg = JSON.parse(readFileSync(join(__dirname, '..', 'config', 'spend-limits.json'), 'utf8'));
    expect(DAILY_SEND_STOP).toBe(cfg.resend_emails_day.stop);
    expect(DAILY_SEND_WARN).toBe(Math.round(cfg.resend_emails_day.alert_fraction * cfg.resend_emails_day.stop));
  });
});

describe('verifying', () => {
  async function issued(code = '123456') {
    const { d } = deps(mem.store, { code });
    await request({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    return deps(mem.store).d;
  }
  it('accepts the right code once, then refuses it', async () => {
    const d = await issued();
    expect((await verifySignInCode({ rawEmail: 'A@example.com ', code: '123456', now: T0 + 1000 }, d)).ok).toBe(true);
    expect((await verifySignInCode({ rawEmail: 'a@example.com', code: '123456', now: T0 + 2000 }, d)).ok).toBe(false);
  });
  it('refuses after ten minutes', async () => {
    const d = await issued();
    expect((await verifySignInCode({ rawEmail: 'a@example.com', code: '123456', now: T0 + CODE_TTL_MS }, d)).ok).toBe(false);
  });
  it('the fifth wrong attempt consumes the code, even if the right one follows', async () => {
    const d = await issued();
    for (let i = 0; i < CODE_MAX_ATTEMPTS; i++) {
      expect((await verifySignInCode({ rawEmail: 'a@example.com', code: '000000', now: T0 + 1000 }, d)).ok).toBe(false);
    }
    expect((await verifySignInCode({ rawEmail: 'a@example.com', code: '123456', now: T0 + 2000 }, d)).ok).toBe(false);
  });
  it('parallel wrong guesses cannot beat the five-attempt limit', async () => {
    const d = await issued();
    const wrong = Array.from({ length: 7 }, () =>
      verifySignInCode({ rawEmail: 'a@example.com', code: '000000', now: T0 + 1000 }, d));
    expect((await Promise.all(wrong)).every((r) => r.ok === false)).toBe(true);
    // Guesses that were already in flight can still add to the count; anything past the limit is refused, so the count
    // only needs to reach the limit and the code must be used up.
    expect(mem.store.codes[0].attempts).toBeGreaterThanOrEqual(CODE_MAX_ATTEMPTS);
    expect(mem.store.codes[0].consumed).toBe(true);
    expect((await verifySignInCode({ rawEmail: 'a@example.com', code: '123456', now: T0 + 2000 }, d)).ok).toBe(false);
  });
  it('two parallel correct submissions: only the first is accepted', async () => {
    const d = await issued();
    const [a, b] = await Promise.all([
      verifySignInCode({ rawEmail: 'a@example.com', code: '123456', now: T0 + 1000 }, d),
      verifySignInCode({ rawEmail: 'a@example.com', code: '123456', now: T0 + 1000 }, d),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
  });
  it('a code bound to one address does not work for another', async () => {
    const d = await issued();
    expect((await verifySignInCode({ rawEmail: 'b@example.com', code: '123456', now: T0 + 1000 }, d)).ok).toBe(false);
  });
  it('a malformed code is refused without touching the store', async () => {
    const d = await issued();
    expect((await verifySignInCode({ rawEmail: 'a@example.com', code: '12345', now: T0 + 1000 }, d)).ok).toBe(false);
    expect(mem.store.codes[0].attempts).toBe(0);
  });
  it('a read error on verify refuses sign-in', async () => {
    const d = await issued();
    const broken = { ...d, store: { ...d.store, openCode: async () => { throw new Error('down'); } } };
    expect((await verifySignInCode({ rawEmail: 'a@example.com', code: '123456', now: T0 + 1000 }, broken)).ok).toBe(false);
  });
});

describe('the request side uses the platform hook', () => {
  it('signin-request.ts hands the task to after()', () => {
    const src = readFileSync(join(__dirname, '..', 'src', 'lib', 'signin-request.ts'), 'utf8');
    expect(src).toMatch(/import \{ after \} from 'next\/server'/);
    expect(src).toMatch(/after\(task\)/);
  });
});

describe('constant-time comparison of the code hash', () => {
  it('equal hashes match; different hashes of the same length do not', () => {
    const h = codeHash('123456', 'a@example.com', KEY);
    expect(sameHash(h, codeHash('123456', 'a@example.com', KEY))).toBe(true);
    expect(sameHash(h, codeHash('123457', 'a@example.com', KEY))).toBe(false);
  });
  it('different lengths never match, with no byte comparison', () => {
    expect(sameHash('abcd', 'abcde')).toBe(false);
    expect(sameHash('', 'x')).toBe(false);
  });
  it('the verify path uses the helper, not a plain string comparison', () => {
    const src = readFileSync(join(__dirname, '..', 'src', 'lib', 'signin-email.ts'), 'utf8');
    expect(src).toMatch(/const right = sameHash\(row\.codeHash, codeHash\(input\.code, email, deps\.hashKey\)\);/);
    expect(src).not.toMatch(/row\.codeHash\s*===/);
  });
  it('a wrong code is still refused and a right code still accepted', async () => {
    const { d } = deps(mem.store, { code: '777777' });
    await request({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    expect((await verifySignInCode({ rawEmail: 'a@example.com', code: '111111', now: T0 + 1000 }, d)).ok).toBe(false);
    expect((await verifySignInCode({ rawEmail: 'a@example.com', code: '777777', now: T0 + 2000 }, d)).ok).toBe(true);
  });
});

describe('helpers', () => {
  it('normalises addresses and rejects junk', () => {
    expect(normaliseEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
    expect(normaliseEmail('a b@c.d')).toBeNull();
  });
});
