// Sign-in by email code: rules tested with an in-memory store and a stub mailer. No real email is sent.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';
import {
  issueSignInCode, verifySignInCode, emailHash, codeHash, dayKey, normaliseEmail, MailRefused,
  CODE_TTL_MS, CODE_MAX_ATTEMPTS, CODE_COOLDOWN_MS, DAILY_SEND_STOP, DAILY_SEND_WARN,
  MSG_CHECK_EMAIL, MSG_AGE, MSG_BUSY, MSG_NOT_SENT, MSG_GENERIC, type SignInDeps, type SignInStore,
} from '../src/lib/signin-email';

const KEY = 'test-key-not-a-secret';
const T0 = Date.UTC(2026, 9, 23, 12, 0, 0);
const DAY = dayKey(T0);

function memStore() {
  const sends = new Map<string, number>();
  const reservations = new Map<string, { day: string; released: boolean }>();
  const accounts = new Set<string>();
  const codes: Array<{ id: string; emailHash: string; codeHash: string; expiresAt: number; issuedAt: number; attempts: number; consumed: boolean }> = [];
  const store = {
    failRead: false,
    failReserve: false,
    codes,
    accounts,
    sends,
    reservations,
    async readSendCount(day: string) {
      if (this.failRead) throw new Error('unreadable');
      return sends.get(day) ?? 0;
    },
    async reserveSend(day: string, sendId: string) {
      if (this.failReserve) throw new Error('write failed');
      sends.set(day, (sends.get(day) ?? 0) + 1);
      reservations.set(sendId, { day, released: false });
    },
    async releaseSend(day: string, sendId: string) {
      const r = reservations.get(sendId);
      if (!r || r.released) return false;
      r.released = true;
      sends.set(day, (sends.get(day) ?? 0) - 1);
      return true;
    },
    async accountExists(eh: string) { return accounts.has(eh); },
    async createAccount(eh: string) { accounts.add(eh); },
    async lastCodeIssuedAt(eh: string) {
      const rows = codes.filter((c) => c.emailHash === eh);
      return rows.length ? Math.max(...rows.map((c) => c.issuedAt)) : null;
    },
    async insertCode(row: { id: string; emailHash: string; codeHash: string; expiresAt: number; issuedAt: number }) {
      codes.push({ ...row, attempts: 0, consumed: false });
    },
    async openCode(eh: string, now: number) {
      const row = [...codes].reverse().find((c) => c.emailHash === eh && !c.consumed && c.expiresAt > now);
      return row ? { id: row.id, codeHash: row.codeHash, attempts: row.attempts } : null;
    },
    async setAttempts(id: string, attempts: number) { const r = codes.find((c) => c.id === id); if (r) r.attempts = attempts; },
    async consumeCode(id: string) { const r = codes.find((c) => c.id === id); if (r) r.consumed = true; },
  };
  return { store, sends, reservations };
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

let mem: ReturnType<typeof memStore>;
beforeEach(() => { mem = memStore(); });

describe('flag', () => {
  it('is off, and the Python mirror agrees', () => {
    expect(FEATURE_FLAGS.signInByEmail).toBe(false);
    expect(readFileSync(join(__dirname, '..', 'config', 'feature_flags.py'), 'utf8')).toMatch(/"sign_in_by_email": False/);
  });
  it('with the flag off, nothing is counted, stored or sent', async () => {
    const { d, sent } = deps(mem.store, { enabled: false });
    const r = await issueSignInCode({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    expect(r.ok).toBe(false);
    expect(sent).toHaveLength(0);
    expect(mem.store.codes).toHaveLength(0);
    expect(mem.sends.size).toBe(0);
  });
});

describe('the same answer for every address', () => {
  it('known and unknown addresses (box ticked) get the same result', async () => {
    const { d: d1 } = deps(mem.store);
    const fresh = await issueSignInCode({ rawEmail: 'new@example.com', ageConfirmed: true, now: T0 }, d1);
    mem.store.accounts.add(emailHash('old@example.com', KEY));
    const { d: d2 } = deps(mem.store);
    const known = await issueSignInCode({ rawEmail: 'old@example.com', ageConfirmed: true, now: T0 }, d2);
    expect(fresh).toEqual(known);
    expect(fresh).toEqual({ ok: true, message: MSG_CHECK_EMAIL });
  });
  it('known and unknown addresses without the box get the same result', async () => {
    const { d } = deps(mem.store);
    const unknown = await issueSignInCode({ rawEmail: 'new@example.com', ageConfirmed: false, now: T0 }, d);
    mem.store.accounts.add(emailHash('old@example.com', KEY));
    const known = await issueSignInCode({ rawEmail: 'old@example.com', ageConfirmed: false, now: T0 }, d);
    expect(unknown).toEqual(known);
    expect(unknown.message).toBe(MSG_CHECK_EMAIL);
  });
  it('the message never mentions the 18+ rule or the account', async () => {
    const { d } = deps(mem.store);
    const r = await issueSignInCode({ rawEmail: 'new@example.com', ageConfirmed: false, now: T0 }, d);
    expect(r.message).not.toBe(MSG_AGE);
    expect(r.message).not.toMatch(/adult|account|exist/i);
  });
  it('an unknown address without the box is not sent a code and not stored', async () => {
    const { d, sent } = deps(mem.store);
    await issueSignInCode({ rawEmail: 'new@example.com', ageConfirmed: false, now: T0 }, d);
    expect(sent).toHaveLength(0);
    expect(mem.store.codes).toHaveLength(0);
    expect(mem.sends.size).toBe(0);
  });
  it('an existing account is sent a code without the box', async () => {
    mem.store.accounts.add(emailHash('a@example.com', KEY));
    const { d, sent } = deps(mem.store);
    await issueSignInCode({ rawEmail: 'a@example.com', ageConfirmed: false, now: T0 }, d);
    expect(sent).toHaveLength(1);
  });
  it('an invalid address gets the format message and no send', async () => {
    const { d, sent } = deps(mem.store);
    const r = await issueSignInCode({ rawEmail: 'not an email', ageConfirmed: true, now: T0 }, d);
    expect(r.ok).toBe(false);
    expect(sent).toHaveLength(0);
  });
  it('a second request within 60 seconds gets the same message and no second send', async () => {
    const { d, sent } = deps(mem.store);
    await issueSignInCode({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    const again = await issueSignInCode({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 + CODE_COOLDOWN_MS - 1 }, d);
    expect(again).toEqual({ ok: true, message: MSG_CHECK_EMAIL });
    expect(sent).toHaveLength(1);
    await issueSignInCode({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 + CODE_COOLDOWN_MS }, d);
    expect(sent).toHaveLength(2);
  });
});

describe('the send is counted before it goes out', () => {
  it('the count already includes the send when the mailer runs', async () => {
    let seenAtSend = -1;
    const { d } = deps(mem.store, { onSend: () => { seenAtSend = mem.sends.get(DAY) ?? 0; } });
    await issueSignInCode({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    expect(seenAtSend).toBe(1);
    expect(mem.sends.get(DAY)).toBe(1);
  });
  it('a clear refusal from the provider gives the count back, once', async () => {
    const { d } = deps(mem.store, { mail: 'refuse' });
    const r = await issueSignInCode({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    expect(r).toEqual({ ok: false, reason: 'error', message: MSG_NOT_SENT });
    expect(mem.sends.get(DAY)).toBe(0);
    expect(mem.reservations.size).toBe(1);
    // Giving it back again changes nothing.
    const [sendId] = [...mem.reservations.keys()];
    expect(await mem.store.releaseSend(DAY, sendId)).toBe(false);
    expect(mem.sends.get(DAY)).toBe(0);
  });
  it('a refused send leaves no usable code', async () => {
    const { d } = deps(mem.store, { mail: 'refuse' });
    await issueSignInCode({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    expect(mem.store.codes[0].consumed).toBe(true);
  });
  it('a timeout (unclear outcome) keeps the count and drops the code', async () => {
    const { d } = deps(mem.store, { mail: 'timeout' });
    const r = await issueSignInCode({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    expect(r).toEqual({ ok: false, reason: 'error', message: MSG_GENERIC });
    expect(mem.sends.get(DAY)).toBe(1);
    expect(mem.store.codes[0].consumed).toBe(true);
  });
  it('a count that cannot be written sends nothing and drops the code', async () => {
    mem.store.failReserve = true;
    const { d, sent } = deps(mem.store);
    const r = await issueSignInCode({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    expect(r.ok).toBe(false);
    expect(sent).toHaveLength(0);
    expect(mem.store.codes[0].consumed).toBe(true);
    expect(mem.sends.get(DAY) ?? 0).toBe(0);
  });
  it('a refused send does not use up the daily cap', async () => {
    mem.sends.set(DAY, DAILY_SEND_STOP - 1);
    const { d } = deps(mem.store, { mail: 'refuse' });
    expect((await issueSignInCode({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d)).message).toBe(MSG_NOT_SENT);
    // The refused send was given back, so one more request is still allowed.
    const { d: ok } = deps(mem.store);
    expect((await issueSignInCode({ rawEmail: 'b@example.com', ageConfirmed: true, now: T0 }, ok)).ok).toBe(true);
    expect(mem.sends.get(DAY)).toBe(DAILY_SEND_STOP);
  });
});

describe('daily send cap', () => {
  it('sends below the stop, refuses at the stop', async () => {
    mem.sends.set(DAY, DAILY_SEND_STOP - 1);
    const { d, sent } = deps(mem.store);
    expect((await issueSignInCode({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d)).ok).toBe(true);
    expect(sent).toHaveLength(1);
    const r = await issueSignInCode({ rawEmail: 'b@example.com', ageConfirmed: true, now: T0 }, d);
    expect(r).toEqual({ ok: false, reason: 'busy', message: MSG_BUSY });
    expect(sent).toHaveLength(1);
  });
  it('an unreadable counter sends nothing and stores nothing', async () => {
    mem.store.failRead = true;
    const { d, sent } = deps(mem.store);
    const r = await issueSignInCode({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    expect(r.ok).toBe(false);
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
    await issueSignInCode({ rawEmail: 'a@example.com', ageConfirmed: true, now: T0 }, d);
    return deps(mem.store).d;
  }
  it('stores a keyed hash of the code, never the code itself', async () => {
    await issued('654321');
    const row = mem.store.codes[0];
    expect(row.codeHash).toBe(codeHash('654321', 'a@example.com', KEY));
    expect(JSON.stringify(mem.store.codes)).not.toContain('654321');
    expect(row.expiresAt - row.issuedAt).toBe(CODE_TTL_MS);
  });
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

describe('helpers', () => {
  it('normalises addresses and rejects junk', () => {
    expect(normaliseEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
    expect(normaliseEmail('a b@c.d')).toBeNull();
  });
});
