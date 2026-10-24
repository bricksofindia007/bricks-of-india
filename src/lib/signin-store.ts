// Supabase store for sign-in by emailed code and account sessions. Server only (service role, via createServerClient).
// Every read or write that fails throws; the rules in signin-email.ts turn a throw into "no send" (G14).
// Nothing here logs an address, a code or a token.
import { createServerClient } from '@/lib/supabase';
import type { SignInStore } from '@/lib/signin-email';

type Db = ReturnType<typeof createServerClient>;

function fail(what: string): never {
  throw new Error(`sign-in store: ${what}`);
}

export class SupabaseSignInStore implements SignInStore {
  private readonly db: Db;

  constructor(db: Db = createServerClient()) {
    this.db = db;
  }

  async readSendCount(day: string): Promise<number> {
    const { count, error } = await this.db
      .from('sign_in_sends')
      .select('send_id', { count: 'exact', head: true })
      .eq('day_key', day)
      .is('released_at', null);
    if (error) fail('send count unreadable');
    return count ?? 0;
  }

  async reserveSend(day: string, sendId: string): Promise<void> {
    const { error } = await this.db.from('sign_in_sends').insert({ send_id: sendId, day_key: day });
    if (error) fail('send not reserved');
  }

  /** True only for the first release of a send id; a second release changes nothing and returns false. */
  async releaseSend(day: string, sendId: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('sign_in_sends')
      .update({ released_at: new Date().toISOString() })
      .eq('send_id', sendId)
      .eq('day_key', day)
      .is('released_at', null)
      .select('send_id');
    if (error) fail('send not released');
    return (data?.length ?? 0) === 1;
  }

  async accountExists(email: string): Promise<boolean> {
    const { data, error } = await this.db
      .from('accounts')
      .select('id')
      .eq('email', email)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) fail('account unreadable');
    return data !== null;
  }

  async lastCodeIssuedAt(emailHash: string): Promise<number | null> {
    const { data, error } = await this.db
      .from('sign_in_codes')
      .select('issued_at')
      .eq('email_hash', emailHash)
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail('code history unreadable');
    return data ? Date.parse(data.issued_at) : null;
  }

  async insertCode(row: { id: string; emailHash: string; codeHash: string; expiresAt: number; issuedAt: number }): Promise<void> {
    const { error } = await this.db.from('sign_in_codes').insert({
      id: row.id,
      email_hash: row.emailHash,
      code_hash: row.codeHash,
      issued_at: new Date(row.issuedAt).toISOString(),
      expires_at: new Date(row.expiresAt).toISOString(),
    });
    if (error) fail('code not stored');
  }

  async openCode(emailHash: string, now: number): Promise<{ id: string; codeHash: string; attempts: number } | null> {
    const { data, error } = await this.db
      .from('sign_in_codes')
      .select('id, code_hash, attempts')
      .eq('email_hash', emailHash)
      .is('consumed_at', null)
      .gt('expires_at', new Date(now).toISOString())
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) fail('code unreadable');
    return data ? { id: data.id, codeHash: data.code_hash, attempts: data.attempts } : null;
  }

  async setAttempts(id: string, attempts: number): Promise<void> {
    const { error } = await this.db.from('sign_in_codes').update({ attempts }).eq('id', id);
    if (error) fail('attempts not stored');
  }

  async consumeCode(id: string, now: number): Promise<void> {
    const { error } = await this.db
      .from('sign_in_codes')
      .update({ consumed_at: new Date(now).toISOString() })
      .eq('id', id)
      .is('consumed_at', null);
    if (error) fail('code not consumed');
  }

  /** The account id for this address, or null. Used when a code is checked, to decide whether to create an account. */
  async findAccountId(email: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('accounts')
      .select('id')
      .eq('email', email)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) fail('account unreadable');
    return data?.id ?? null;
  }

  /** A new account for an address. The address is stored lower-cased (normalised before this call). */
  async createAccount(email: string): Promise<string> {
    const { data, error } = await this.db.from('accounts').insert({ email }).select('id').single();
    if (error || !data) fail('account not created');
    return data.id as string;
  }

  async createSession(accountId: string, tokenHash: string, expiresAt: number): Promise<void> {
    const { error } = await this.db.from('account_sessions').insert({
      account_id: accountId,
      token_hash: tokenHash,
      expires_at: new Date(expiresAt).toISOString(),
    });
    if (error) fail('session not stored');
  }
}

/** The account behind a session token hash, if the session is live and the account is not deleted. Null otherwise. */
export async function accountForSession(
  db: Db,
  tokenHash: string,
  now: number,
): Promise<{ id: string; email: string } | null> {
  const { data: session, error: sErr } = await db
    .from('account_sessions')
    .select('account_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (sErr) fail('session unreadable');
  if (!session || session.revoked_at !== null || Date.parse(session.expires_at) <= now) return null;

  const { data: account, error: aErr } = await db
    .from('accounts')
    .select('id, email')
    .eq('id', session.account_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (aErr) fail('account unreadable');
  return account ? { id: account.id as string, email: account.email as string } : null;
}

/**
 * Deletes the account. Its saved sets, saved figures and sessions go with it (on delete cascade). Sign-in codes for the
 * address are removed separately, by hash.
 */
export async function deleteAccountAndCodes(db: Db, accountId: string, emailHash: string): Promise<void> {
  const { error: cErr } = await db.from('sign_in_codes').delete().eq('email_hash', emailHash);
  if (cErr) fail('codes not removed');
  const { error: aErr } = await db.from('accounts').delete().eq('id', accountId);
  if (aErr) fail('account not removed');
}
