// Sign-in by email code. Core rules only: no route, no form, no provider call here.
// Storage and mail are injected, so the rules are tested with an in-memory store and a stub sender.
// Off until the feature flag is on: with it off, nothing is stored, counted or sent.
//
// Failure behaviour (G14): any read or write error refuses the step with a generic message.
// The send is counted before it goes out, so a crash cannot go over the daily cap. A clear refusal from the
// mail provider gives the count back once; an unclear outcome (a timeout, say) keeps it.
// The message shown never says whether an address has an account.
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import { FEATURE_FLAGS } from '@/lib/feature-flags';

export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_MAX_ATTEMPTS = 5;
export const CODE_COOLDOWN_MS = 60 * 1000;
// Mirror config/spend-limits.json: resend_emails_day.stop and alert_fraction (0.6 of 90).
export const DAILY_SEND_STOP = 90;
export const DAILY_SEND_WARN = 54;

export const MSG_GENERIC = 'Something went wrong. Please try again.';
export const MSG_CHECK_EMAIL = 'If this address can sign in, a code is on its way.';
export const MSG_INVALID = 'Please enter a valid email address.';
export const MSG_NOT_SENT = 'The code could not be sent. Please try again later.';
export const MSG_AGE = 'Accounts are for adults only, for now. You can still browse everything on the site without one.';
export const MSG_BUSY = 'Sign-in is busy right now. Please try again later.';
export const MSG_BAD_CODE = 'That code did not work. Check it, or ask for a new one.';

/** Thrown by the mailer only when the provider clearly refuses the message. Any other error is an unclear outcome. */
export class MailRefused extends Error {
  constructor() {
    super('mail refused');
    this.name = 'MailRefused';
  }
}

export interface SignInStore {
  /** Sends counted today. Throws if the counter cannot be read. */
  readSendCount(dayKey: string): Promise<number>;
  /** Count one send before it goes out. Keyed by the send id so it can be given back at most once. */
  reserveSend(dayKey: string, sendId: string): Promise<void>;
  /** Give back a reserved send. Returns true only the first time for a given send id. */
  releaseSend(dayKey: string, sendId: string): Promise<boolean>;
  accountExists(emailHash: string): Promise<boolean>;
  createAccount(emailHash: string, ageConfirmedAt: string): Promise<void>;
  lastCodeIssuedAt(emailHash: string): Promise<number | null>;
  insertCode(row: { id: string; emailHash: string; codeHash: string; expiresAt: number; issuedAt: number }): Promise<void>;
  /** The newest code for this address that is neither consumed nor expired, or null. */
  openCode(emailHash: string, now: number): Promise<{ id: string; codeHash: string; attempts: number } | null>;
  setAttempts(id: string, attempts: number): Promise<void>;
  consumeCode(id: string, now: number): Promise<void>;
}

export interface CodeMailer {
  send(to: string, body: { code: string }, idempotencyKey: string): Promise<void>;
}

export interface SignInDeps {
  store: SignInStore;
  mailer: CodeMailer;
  /** Server secret for keyed hashes. Supplied by the caller; never read here. */
  hashKey: string;
  /** Random source. Defaults to a cryptographic one. */
  randomCode?: () => string;
  enabled?: () => boolean;
}

export type IssueResult =
  | { ok: true; message: string }
  | { ok: false; message: string; reason: 'disabled' | 'busy' | 'error' | 'invalid' };

export type VerifyResult = { ok: true } | { ok: false; message: string };

export function normaliseEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

/** Keyed hash of an address. Stored instead of the address in the codes table. */
export function emailHash(email: string, key: string): string {
  return createHmac('sha256', key).update(`email:${email}`).digest('hex');
}

/** Keyed hash of a code, bound to the address it was issued for. The plain code is never stored. */
export function codeHash(code: string, email: string, key: string): string {
  return createHmac('sha256', key).update(`code:${email}:${code}`).digest('hex');
}

/** Six digits from a cryptographic source. */
export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function isEnabled(deps: SignInDeps): boolean {
  return deps.enabled ? deps.enabled() : FEATURE_FLAGS.signInByEmail;
}

/**
 * Issue a code. Every address that passes the format check gets the same result object, whether or not it has an
 * account. An address with no account and no 18+ box gets no code; it gets the same result all the same.
 */
export async function issueSignInCode(
  input: { rawEmail: string; ageConfirmed: boolean; now?: number; id?: string },
  deps: SignInDeps,
): Promise<IssueResult> {
  if (!isEnabled(deps)) return { ok: false, reason: 'disabled', message: MSG_GENERIC };
  const now = input.now ?? Date.now();
  const email = normaliseEmail(input.rawEmail);
  if (!email) return { ok: false, reason: 'invalid', message: MSG_INVALID };

  try {
    const eh = emailHash(email, deps.hashKey);
    const exists = await deps.store.accountExists(eh);
    const last = await deps.store.lastCodeIssuedAt(eh);
    if (last !== null && now - last < CODE_COOLDOWN_MS) return { ok: true, message: MSG_CHECK_EMAIL };

    const day = dayKey(now);
    // An unreadable counter throws here and nothing is sent.
    const sent = await deps.store.readSendCount(day);
    if (sent >= DAILY_SEND_STOP) return { ok: false, reason: 'busy', message: MSG_BUSY };

    // A new address needs the 18+ box. Without it, nothing is stored or sent, and the result is still MSG_CHECK_EMAIL.
    if (!exists && !input.ageConfirmed) return { ok: true, message: MSG_CHECK_EMAIL };

    const code = (deps.randomCode ?? newCode)();
    const id = input.id ?? randomBytes(16).toString('hex');
    await deps.store.insertCode({
      id,
      emailHash: eh,
      codeHash: codeHash(code, email, deps.hashKey),
      expiresAt: now + CODE_TTL_MS,
      issuedAt: now,
    });

    // Counted before the send. If the count cannot be written, nothing is sent and the code is dropped.
    try {
      await deps.store.reserveSend(day, id);
    } catch {
      await deps.store.consumeCode(id, now);
      return { ok: false, reason: 'error', message: MSG_GENERIC };
    }

    try {
      await deps.mailer.send(email, { code }, `signin:${id}`);
    } catch (err) {
      // No usable code in either case.
      await deps.store.consumeCode(id, now);
      if (err instanceof MailRefused) {
        // Clear refusal: the message never left, so the count is given back (once; the store enforces that).
        await deps.store.releaseSend(day, id);
        return { ok: false, reason: 'error', message: MSG_NOT_SENT };
      }
      // Unclear outcome: the count stays.
      return { ok: false, reason: 'error', message: MSG_GENERIC };
    }
    return { ok: true, message: MSG_CHECK_EMAIL };
  } catch {
    return { ok: false, reason: 'error', message: MSG_GENERIC };
  }
}

/** Check a code. Single use; at most five attempts; the fifth wrong attempt consumes the code. */
export async function verifySignInCode(
  input: { rawEmail: string; code: string; now?: number },
  deps: SignInDeps,
): Promise<VerifyResult> {
  if (!isEnabled(deps)) return { ok: false, message: MSG_GENERIC };
  const now = input.now ?? Date.now();
  const email = normaliseEmail(input.rawEmail);
  if (!email || !/^[0-9]{6}$/.test(input.code)) return { ok: false, message: MSG_BAD_CODE };

  try {
    const eh = emailHash(email, deps.hashKey);
    const row = await deps.store.openCode(eh, now);
    if (!row) return { ok: false, message: MSG_BAD_CODE };

    const attempts = row.attempts + 1;
    const right = row.codeHash === codeHash(input.code, email, deps.hashKey);
    if (right) {
      await deps.store.consumeCode(row.id, now);
      return { ok: true };
    }
    if (attempts >= CODE_MAX_ATTEMPTS) {
      await deps.store.consumeCode(row.id, now);
    } else {
      await deps.store.setAttempts(row.id, attempts);
    }
    return { ok: false, message: MSG_BAD_CODE };
  } catch {
    return { ok: false, message: MSG_GENERIC };
  }
}
