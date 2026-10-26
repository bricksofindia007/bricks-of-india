// Staging rehearsal for issue 796: parallel wrong guesses and parallel correct submissions against the real database.
// Staging only. Refuses to run unless REHEARSAL_TARGET=staging and the database address does not contain the production
// reference. It writes one test address into the sign-in tables and deletes its own rows at the end. It prints results
// only: no code, no hash, no address, no key.
//
//   REHEARSAL_TARGET=staging npx tsx scripts/rehearsal/signin-parallel-guesses.ts
import { PROD_REF } from '../ci/prod-reference.mjs';
import { randomBytes } from 'node:crypto';
import { SupabaseSignInStore } from '../../src/lib/signin-store';
import { verifySignInCode, emailHash, codeHash, CODE_MAX_ATTEMPTS } from '../../src/lib/signin-email';
import { signInHashKey } from '../../src/lib/signin-gate';
import { createServerClient } from '../../src/lib/supabase';

export function guardTarget(env: Record<string, string | undefined>, prodRef: string = PROD_REF): { ok: boolean; reason: string | null } {
  if (env.REHEARSAL_TARGET !== 'staging') return { ok: false, reason: 'REHEARSAL_TARGET must be staging' };
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (url === '') return { ok: false, reason: 'no database address given' };
  if (url.includes(prodRef)) return { ok: false, reason: 'the address refers to the production project; refusing to run' };
  return { ok: true, reason: null };
}

async function main() {
  const g = guardTarget(process.env);
  if (!g.ok) throw new Error(g.reason ?? 'refused');
  const key = signInHashKey();
  if (!key) throw new Error('the sign-in hash key is not set in this environment');
  const db = createServerClient();
  const store = new SupabaseSignInStore(db);
  const deps = { store, mailer: { send: async () => undefined }, hashKey: key, enabled: () => true };
  const email = `rehearsal+${randomBytes(6).toString('hex')}@example.com`;
  const eh = emailHash(email, key);
  const now = Date.now();
  const results: Record<string, unknown> = {};

  try {
    // 1. Seven wrong guesses at once, against one open code.
    await store.insertCode({ id: randomBytes(16).toString('hex'), emailHash: eh, codeHash: codeHash('123456', email, key), expiresAt: now + 600_000, issuedAt: now });
    const wrong = await Promise.all(Array.from({ length: 7 }, () => verifySignInCode({ rawEmail: email, code: '000000', now: now + 1000 }, deps)));
    const { data: rows1 } = await db.from('sign_in_codes').select('attempts, consumed_at').eq('email_hash', eh).order('issued_at', { ascending: false }).limit(1);
    results.parallel_wrong = {
      all_refused: wrong.every((r) => !r.ok),
      attempts_recorded: rows1?.[0]?.attempts ?? null,
      attempt_limit: CODE_MAX_ATTEMPTS,
      used_up: rows1?.[0]?.consumed_at != null,
    };

    // 2. Two correct submissions at once, against a fresh code.
    await store.insertCode({ id: randomBytes(16).toString('hex'), emailHash: eh, codeHash: codeHash('654321', email, key), expiresAt: now + 600_000, issuedAt: now + 2000 });
    const right = await Promise.all([
      verifySignInCode({ rawEmail: email, code: '654321', now: now + 3000 }, deps),
      verifySignInCode({ rawEmail: email, code: '654321', now: now + 3000 }, deps),
    ]);
    results.parallel_correct = { accepted: right.filter((r) => r.ok).length, expected: 1 };
  } finally {
    // 3. Remove this run's rows, whatever happened above.
    await db.from('sign_in_codes').delete().eq('email_hash', eh);
  }
  const pass = (results.parallel_wrong as { all_refused: boolean; used_up: boolean }).all_refused
    && (results.parallel_wrong as { used_up: boolean }).used_up
    && (results.parallel_correct as { accepted: number }).accepted === 1;
  console.log(JSON.stringify({ result: pass ? 'PASS' : 'FAIL', ...results }, null, 2));
  if (!pass) process.exitCode = 1;
}

if (process.argv[1]?.endsWith('signin-parallel-guesses.ts')) {
  main().catch((e) => { console.error(`rehearsal FAILED: ${e.message}`); process.exitCode = 1; });
}
