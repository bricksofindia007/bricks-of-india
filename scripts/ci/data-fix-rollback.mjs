#!/usr/bin/env node
// Staging-only rollback of a data fix (the standard line on reviews with no store).
//
//   TARGET=staging BACKUP_TABLE=public__reviews__<stamp> DATABASE_URL=... node scripts/ci/data-fix-rollback.mjs
//
// * Refuses any target other than staging, and runs the same target check as the update step first
//   (a staging address that carries the production reference is refused before any connection).
// * Restores public.reviews from the fix's own backup table, byte for byte. A row is restored only if its
//   live content, with the inserted block taken out, equals the backed-up content exactly. Nothing is
//   reversed by pattern.
// * One transaction (psql -1). Any failed check raises an error and rolls everything back.
// * Proof: after the restore, the two guard values must equal the originals, and the rows changed must
//   be exactly 52 WAIT and 6 BUY NOW. Then the fix's ledger row is removed, so the fix can be re-applied.
// * Applying the rollback twice changes nothing the second time (it finds the originals and stops).
import { spawnSync } from 'node:child_process';
import { checkStagingTarget } from './db-migrate.mjs';

export const FIX_NAME = '586-review-standard-line.sql';
export const ORIGINAL = {
  wait: { count: 52, guard: '7e6ef037701873bdc353b195dbc66e39' },
  buy: { count: 6, guard: '7fece1ae5e2d0cd6fa481023f8ba0956' },
};
// The exact sentences the fix inserted (kept equal to the fix file and the disclaimer code; see the tests).
export const WAIT_BLOCK = "Standard disclaimer: if you're rich, you can skip the verdict and just buy it. The rest of us will be here doing math before we hit checkout.";
export const BUY_BLOCK = "Standard disclaimer: if you've got the money, obviously buy it — that's what the verdict says too, for once we all agree.";

// The stamp is matched without regard to case. Postgres stores the unquoted name in lower case, so the
// table comes back with a lower-case t even when the stamp was written with a capital T.
const BACKUP_RE = /^public__reviews__\d{8}t\d{6}$/i;

/** Only the backup name the update step makes is accepted: it becomes an identifier in the SQL. */
export function isValidBackupTable(name) {
  return typeof name === 'string' && BACKUP_RE.test(name);
}

/** Validates the name (any case) and returns it in lower case. That one value is used everywhere after this. */
export function normalizeBackupTable(name) {
  if (!isValidBackupTable(name)) throw new Error('backup table name is not in the expected form; refusing');
  return name.toLowerCase();
}

/** The rollback runs against staging only. Returns { ok, reason }; the reason never repeats the address. */
export function checkRollbackTarget(target, url) {
  if (target !== 'staging') return { ok: false, reason: 'this rollback runs against staging only; refusing' };
  return checkStagingTarget(target, url);
}

/** Compares observed guard values with the originals. Returns a list of problems (empty = match). */
export function checkGuardValues(observed, expected = ORIGINAL) {
  const problems = [];
  for (const k of ['wait', 'buy']) {
    if (!observed || observed[k] === undefined) { problems.push(`${k}: no value observed`); continue; }
    if (observed[k].count !== expected[k].count) problems.push(`${k}: count ${observed[k].count}, expected ${expected[k].count}`);
    if (observed[k].guard !== expected[k].guard) problems.push(`${k}: guard does not match`);
  }
  return problems;
}

/**
 * What the rollback should do, from the live guard values alone.
 * 'noop' = already at the originals (a second run); 'restore' = the fix is in place.
 */
export function decideRollbackAction(liveGuards) {
  const problems = checkGuardValues(liveGuards);
  return problems.length === 0 ? 'noop' : 'restore';
}

const sqlLit = (s) => `'${String(s).replace(/'/g, "''")}'`;

// Guard and count expressions over a table (public.reviews, or the backup table by name).
function guardExpr(source, verdict) {
  const sel = `from ${source} where source_retailer is null and verdict = '${verdict}' and position('Standard disclaimer:' in content) = 0`;
  return {
    count: `(select count(*) ${sel})`,
    guard: `(select md5(string_agg(id::text || ':' || md5(content), ',' order by id)) ${sel})`,
  };
}

/**
 * Builds the rollback SQL for one backup table. Throws if the backup name is not valid.
 * It is meant to be run by psql with -1 (one transaction) and ON_ERROR_STOP.
 */
export function buildRollbackSql(backupTable) {
  const name = normalizeBackupTable(backupTable);
  const bt = `boi_backups."${name}"`;
  const W = guardExpr('public.reviews', 'WAIT');
  const B = guardExpr('public.reviews', 'BUY NOW');
  const WB = guardExpr(bt, 'WAIT');
  const BB = guardExpr(bt, 'BUY NOW');
  const bodyWait = `replace(r.content, E'\\n\\n' || ${sqlLit(WAIT_BLOCK)}, '') = b.content`;
  const bodyBuy = `replace(r.content, E'\\n\\n' || ${sqlLit(BUY_BLOCK)}, '') = b.content`;
  return `-- Staging rollback of data fix 586 (generated; see scripts/ci/data-fix-rollback.mjs).
DO $rollback$
DECLARE
  n integer;
  already boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
                 WHERE ns.nspname = 'boi_backups' AND c.relname = ${sqlLit(name)}) THEN
    RAISE EXCEPTION 'backup table not found; nothing changed';
  END IF;

  -- 1. The backup must be the pre-fix state: the same counts and guards as the fix's before-assert.
  IF ${WB.count} <> ${ORIGINAL.wait.count} OR ${BB.count} <> ${ORIGINAL.buy.count}
     OR ${WB.guard} IS DISTINCT FROM '${ORIGINAL.wait.guard}' OR ${BB.guard} IS DISTINCT FROM '${ORIGINAL.buy.guard}' THEN
    RAISE EXCEPTION 'backup is not the pre-fix state; nothing changed';
  END IF;

  -- 2. Already at the originals: a second run changes nothing.
  already := (${W.count} = ${ORIGINAL.wait.count} AND ${W.guard} = '${ORIGINAL.wait.guard}'
          AND ${B.count} = ${ORIGINAL.buy.count} AND ${B.guard} = '${ORIGINAL.buy.guard}');
  IF already THEN
    RAISE NOTICE 'already restored: no review changed';
  ELSE
    -- 3. Restore from the backup, row by row, only where the live row is the backed-up row plus the block.
    UPDATE public.reviews r SET content = b.content
    FROM ${bt} b
    WHERE b.id = r.id AND b.source_retailer is null AND b.verdict = 'WAIT' AND position('Standard disclaimer:' in b.content) = 0
      AND ${bodyWait};
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> ${ORIGINAL.wait.count} THEN RAISE EXCEPTION 'WAIT restore changed % rows, expected ${ORIGINAL.wait.count}; rolled back', n; END IF;

    UPDATE public.reviews r SET content = b.content
    FROM ${bt} b
    WHERE b.id = r.id AND b.source_retailer is null AND b.verdict = 'BUY NOW' AND position('Standard disclaimer:' in b.content) = 0
      AND ${bodyBuy};
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> ${ORIGINAL.buy.count} THEN RAISE EXCEPTION 'BUY NOW restore changed % rows, expected ${ORIGINAL.buy.count}; rolled back', n; END IF;
  END IF;

  -- 4. Prove the restore: the live guards must now equal the originals.
  IF ${W.count} <> ${ORIGINAL.wait.count} OR ${W.guard} IS DISTINCT FROM '${ORIGINAL.wait.guard}'
     OR ${B.count} <> ${ORIGINAL.buy.count} OR ${B.guard} IS DISTINCT FROM '${ORIGINAL.buy.guard}' THEN
    RAISE EXCEPTION 'guard values after rollback do not match the originals; rolled back';
  END IF;

  -- 5. Remove the fix's ledger row so the fix can be applied again.
  DELETE FROM supabase_migrations.data_fix_log WHERE name = ${sqlLit(FIX_NAME)};
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'ledger rows removed: %', n;
END
$rollback$;
`;
}

// The table is looked up in the database's own catalogue (pg_class joined to pg_namespace), not in
// information_schema, which hides tables a role has no privilege on.
export function lookupBackupSql(backupTable) {
  const name = normalizeBackupTable(backupTable);
  return `select count(*) from pg_class c join pg_namespace ns on ns.oid = c.relnamespace where ns.nspname = 'boi_backups' and c.relname = ${sqlLit(name)};`;
}

// Names only, plus whether this role can use the schema. No table content is read.
export function diagnosticSql() {
  return `select 'table', c.relname from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'boi_backups' and left(c.relname, 17) = 'public__reviews__'
  union all
  select 'can_read', case when has_schema_privilege('boi_backups', 'USAGE') then 'yes' else 'no' end
  order by 1, 2;`;
}

export function parseCount(out) {
  return Number(String(out ?? '').trim().split('\n').pop());
}

export function parseDiagnostic(out) {
  const names = [];
  let canRead = null;
  for (const line of String(out ?? '').split('\n')) {
    const [kind, value] = line.split('|');
    // Only names with the reviews backup prefix are reported, even if the query returned more.
    if (kind === 'table' && value && value.trim().startsWith('public__reviews__')) names.push(value.trim());
    if (kind === 'can_read') canRead = value.trim() === 'yes';
  }
  return { names, canRead };
}

export function notFoundMessage(backupTable, diag) {
  const name = normalizeBackupTable(backupTable);
  const names = diag.names.length ? diag.names.join(', ') : 'none';
  return `backup table ${name} not found in boi_backups. Tables there starting with public__reviews__: ${names}. `
    + `Current role can read the boi_backups schema: ${diag.canRead === null ? 'unknown' : diag.canRead ? 'yes' : 'no'}. Nothing was changed.`;
}

/**
 * Checks that the backup table exists. `run(sql)` returns psql's output (injected, so both paths are testable).
 * Returns { found: true } or { found: false, message } where the message names tables and the role's read access only.
 */
export function checkBackupPresent(backupTable, run) {
  const name = normalizeBackupTable(backupTable);
  if (parseCount(run(lookupBackupSql(name))) === 1) return { found: true };
  const diag = parseDiagnostic(run(diagnosticSql()));
  return { found: false, message: notFoundMessage(name, diag) };
}

async function main() {
  const TARGET = process.env.TARGET, URL = process.env.DATABASE_URL, BT = process.env.BACKUP_TABLE ?? '';
  const guard = checkRollbackTarget(TARGET, URL);
  if (!guard.ok) throw new Error(guard.reason);
  console.log('staging target check passed');
  const redact = (s) => String(s ?? '').split(URL).join('[redacted]');
  const runQuery = (sql) => {
    const r = spawnSync('psql', [URL, '-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-f', '-'],
      { input: sql, encoding: 'utf8', env: { ...process.env, PGCONNECT_TIMEOUT: '15' } });
    if (r.status !== 0) throw new Error(`lookup failed: ${redact(r.stderr).trim().slice(0, 300)}`);
    return String(r.stdout ?? '').replace(/\r/g, '');
  };
  const present = checkBackupPresent(BT, runQuery);
  if (!present.found) throw new Error(present.message);
  const sql = buildRollbackSql(BT);
  const r = spawnSync('psql', [URL, '-X', '-q', '-1', '-v', 'ON_ERROR_STOP=1', '-f', '-'],
    { input: sql, encoding: 'utf8', env: { ...process.env, PGCONNECT_TIMEOUT: '15' } });
  if (r.status !== 0) throw new Error(`rollback failed and was rolled back: ${redact(r.stderr).trim().slice(0, 400)}`);
  for (const line of redact(r.stderr).split('\n').filter((l) => /NOTICE|ERROR/.test(l))) console.log(line.trim());
  console.log('rollback finished; the transaction was committed');
}

if (process.argv[1]?.endsWith('data-fix-rollback.mjs')) main().catch((e) => { console.error(`data-fix-rollback FAILED: ${e.message}`); process.exit(1); });
