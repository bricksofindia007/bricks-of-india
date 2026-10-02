#!/usr/bin/env node
// P6 Step 1 (#403): the ONLY path for schema migrations and approved data fixes.
// Run by .github/workflows/db-migrate.yml, once per target (staging, then production).
//
//   TARGET=staging|production MODE=plan|apply [SCOPE=all|migrations] DATABASE_URL=... node scripts/ci/db-migrate.mjs
//   SCOPE=migrations (P12): apply pending migrations only and leave data fixes pending, e.g. to land a
//   grant the staging seed needs before any fix can rehearse on seeded staging.
//
// Pending work = repo files the target hasn't recorded:
//   * migrations  supabase/migrations/<14-digit version>_<name>.sql  vs supabase_migrations.schema_migrations
//   * data fixes  supabase/data-fixes/<issue>-<name>.sql             vs supabase_migrations.data_fix_log
// Every pending file needs a header (leading `-- boi:<key> <value>` lines):
//   -- boi:issue 246                                    evidence goes to this issue (required)
//   -- boi:backup-tables public.reviews, public.sets    copied into boi_backups before anything runs
//   data fixes also need BOTH count assertions (a single-value SELECT and the exact expected number):
//   -- boi:expect-before select count(*) from public.reviews where slug in ('a','b') = 2
//   -- boi:expect-after  select count(*) from public.reviews where content like '%Corrected%' and slug in ('a','b') = 2
// Files must not contain their own BEGIN/COMMIT: the job wraps each file in ONE transaction
// (for data fixes: before-assert, file, after-assert, ledger row) and stops at the first failure,
// so nothing after a failed file runs.
// Failure behaviour (G14): any error, lint failure or assertion mismatch fails the job with the
// transaction rolled back; parity is checked after applying and must pass.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { compareParity, versionOf } from './migration-parity.mjs';

export const MIGRATIONS_DIR = 'supabase/migrations';
export const FIXES_DIR = 'supabase/data-fixes';
export const BACKUP_RETENTION_DAYS = 30;

export function parseHeader(sql) {
  /** @type {{ issue: number | null, backupTables: string[], expectBefore: { sql: string, count: number } | null, expectAfter: { sql: string, count: number } | null }} */
  const h = { issue: null, backupTables: [], expectBefore: null, expectAfter: null };
  for (const line of sql.split(/\r?\n/)) {
    if (!line.startsWith('--')) { if (line.trim() === '') continue; break; }
    const m = /^--\s*boi:([a-z-]+)\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const [, k, v] = m;
    if (k === 'issue') h.issue = /^\d+$/.test(v) ? Number(v) : NaN;
    else if (k === 'backup-tables') h.backupTables = v.split(',').map((t) => t.trim()).filter(Boolean);
    else if (k === 'expect-before' || k === 'expect-after') {
      const e = /^(.*\S)\s*=\s*(\d+)$/.exec(v);
      const val = e ? { sql: e[1], count: Number(e[2]) } : { error: `unparseable ${k}: ${v}` };
      if (k === 'expect-before') h.expectBefore = val; else h.expectAfter = val;
    }
  }
  return h;
}

const TX_RE = /^\s*(BEGIN|COMMIT|ROLLBACK|END|START\s+TRANSACTION)\s*;/im;
const TABLE_RE = /^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/;

// Removes every dollar-quoted body ($$...$$, $fn$...$fn$) so plpgsql BEGIN/END inside
// functions and DO blocks isn't mistaken for a top-level transaction statement.
export function stripDollarQuoted(sql) {
  return sql.replace(/\$([A-Za-z_]\w*)?\$[\s\S]*?\$\1\$/g, '');
}

/** Lint one pending file; returns a list of problems (empty = ok). */
export function lintFile(kind, name, sql) {
  const h = parseHeader(sql);
  const errs = [];
  if (!Number.isInteger(h.issue)) errs.push(`${name}: missing or invalid "-- boi:issue <number>" header`);
  if (TX_RE.test(stripDollarQuoted(sql))) errs.push(`${name}: contains its own BEGIN/COMMIT/ROLLBACK -- the job wraps each file in one transaction`);
  for (const t of h.backupTables) if (!TABLE_RE.test(t)) errs.push(`${name}: backup table "${t}" must be schema.table (lowercase)`);
  if (kind === 'fix') {
    const m = /^(\d+)-[a-z0-9-]+\.sql$/.exec(name);
    if (!m) errs.push(`${name}: data-fix files are named <issue>-<name>.sql`);
    else if (Number(m[1]) !== h.issue) errs.push(`${name}: file prefix ${m[1]} differs from boi:issue ${h.issue}`);
    for (const [k, e] of [['expect-before', h.expectBefore], ['expect-after', h.expectAfter]]) {
      if (!e) errs.push(`${name}: data fixes need "-- boi:${k} <select returning one number> = <n>"`);
      else if (e.error) errs.push(`${name}: ${e.error}`);
      else if (e.sql.includes('$q$')) errs.push(`${name}: ${k} SQL may not contain $q$`);
    }
    if (h.backupTables.length === 0) errs.push(`${name}: data fixes must name the tables they change in "-- boi:backup-tables"`);
  }
  return errs;
}

export function listRepo(dir, kind) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .filter((n) => (kind === 'migration' ? versionOf(n) : /^\d+-/.test(n)))
    .sort();
}

/** Pure planner. appliedVersions/appliedFixes come from the target database. */
export function plan({ migrations, fixes, appliedVersions, appliedFixes }) {
  const repoVersions = migrations.map(versionOf);
  const parity = compareParity(repoVersions, appliedVersions);
  return {
    targetOnly: parity.prodOnly,                                   // applied on target, no repo file -> refuse
    pendingMigrations: migrations.filter((f) => !appliedVersions.includes(versionOf(f))),
    pendingFixes: fixes.filter((f) => !appliedFixes.includes(f)),
  };
}

/** P12: .sql files in the fixes dir that listRepo would skip (no <issue>- prefix). Never silent: lint fails on them. */
export function strayFixFiles(names) {
  return names.filter((n) => n.endsWith('.sql') && !/^\d+-/.test(n));
}

export function backupName(table, stamp) {
  return `${table.replace('.', '__')}__${stamp}`;
}

// ── runtime (not unit-tested; exercised by the workflow on staging first) ──
function psql(url, args, input) {
  const r = spawnSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', ...args], { input, encoding: 'utf8', env: { ...process.env, PGCONNECT_TIMEOUT: '15' } });
  // CRLF-safe: psql on Windows ends lines with \r, which would make every version mismatch.
  return { ok: r.status === 0, out: (r.stdout ?? '').replace(/\r/g, '').trim(), err: (r.stderr ?? '').replace(/\r/g, '').trim() };
}
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function main() {
  const TARGET = process.env.TARGET, MODE = process.env.MODE ?? 'plan', URL = process.env.DATABASE_URL;
  const SCOPE = process.env.SCOPE || 'all';
  if (!['all', 'migrations'].includes(SCOPE)) throw new Error('SCOPE must be all or migrations');
  const OUT = process.env.OUT_DIR ?? 'db-migrate-out', RUN_URL = process.env.RUN_URL ?? '';
  if (!['staging', 'production'].includes(TARGET)) throw new Error('TARGET must be staging or production');
  if (!URL) throw new Error(`DATABASE_URL not set -- the ${TARGET} environment secret MIGRATE_DB_URL is missing`);
  fs.mkdirSync(OUT, { recursive: true });
  const log = [];
  const say = (s) => { console.log(s); log.push(s); };

  // q: statements that change something (never retried). r: read-only queries, retried once on a
  // dropped connection (the pooler occasionally closes a session: "SSL SYSCALL error: EOF").
  const q = (sql) => { const res = psql(URL, ['-At', '-c', sql]); if (!res.ok) throw new Error(res.err); return res.out; };
  const r = (sql) => {
    let res = psql(URL, ['-At', '-c', sql]);
    if (!res.ok && /SSL SYSCALL|server closed the connection|could not connect|timeout expired/i.test(res.err)) res = psql(URL, ['-At', '-c', sql]);
    if (!res.ok) throw new Error(res.err); return res.out;
  };
  const hasLedger = r("select to_regclass('supabase_migrations.data_fix_log') is not null") === 't';
  const appliedVersions = r('select version from supabase_migrations.schema_migrations order by 1').split('\n').filter(Boolean);
  const appliedFixes = hasLedger ? r('select name from supabase_migrations.data_fix_log order by 1').split('\n').filter(Boolean) : [];
  const migrations = listRepo(MIGRATIONS_DIR, 'migration');
  const fixes = listRepo(FIXES_DIR, 'fix');
  const p = plan({ migrations, fixes, appliedVersions, appliedFixes });
  const heldFixes = SCOPE === 'migrations' ? p.pendingFixes : [];
  if (SCOPE === 'migrations') p.pendingFixes = [];

  say(`## db-migrate: ${TARGET} (${MODE}${SCOPE === 'migrations' ? ', migrations only' : ''})`);
  say(`repo migrations ${migrations.length}, applied on ${TARGET} ${appliedVersions.length}; repo data fixes ${fixes.length}, applied ${appliedFixes.length}`);
  if (p.targetOnly.length) throw new Error(`${TARGET} has versions with no repo file (${p.targetOnly.join(', ')}) -- refusing to apply anything (G7)`);
  const items = [...p.pendingMigrations.map((f) => ({ kind: 'migration', name: f, file: path.join(MIGRATIONS_DIR, f) })),
                 ...p.pendingFixes.map((f) => ({ kind: 'fix', name: f, file: path.join(FIXES_DIR, f) }))];
  const problems = strayFixFiles(fs.existsSync(FIXES_DIR) ? fs.readdirSync(FIXES_DIR) : [])
    .map((n) => `${n}: data-fix files are named <issue>-<name>.sql -- this one would never be applied`);
  for (const it of items) { it.sql = fs.readFileSync(it.file, 'utf8'); it.header = parseHeader(it.sql); problems.push(...lintFile(it.kind, it.name, it.sql)); }
  say(`pending: ${items.length ? items.map((i) => `${i.kind} ${i.name}`).join('; ') : 'nothing'}`);
  if (heldFixes.length) say(`held (scope=migrations): ${heldFixes.map((f) => `fix ${f}`).join('; ')}`);
  if (problems.length) throw new Error(`lint:\n- ${problems.join('\n- ')}`);
  if (p.pendingFixes.length && !hasLedger && !p.pendingMigrations.some((f) => f.includes('data_fix_ledger'))) throw new Error('data-fix ledger (supabase_migrations.data_fix_log) missing and not pending');
  const evidence = { target: TARGET, mode: MODE, applied: [], backups: [], issues: [...new Set(items.map((i) => i.header.issue))] };

  if (MODE === 'apply' && items.length) {
    // 1. in-database backups (never artifacts: the repo is public)
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const tables = [...new Set(['supabase_migrations.schema_migrations', ...(hasLedger ? ['supabase_migrations.data_fix_log'] : []), ...items.flatMap((i) => i.header.backupTables)])];
    const hasManifest = r("select to_regclass('boi_backups.manifest') is not null") === 't';
    for (const t of tables) {
      if (r(`select to_regclass(${lit(t)}) is not null`) !== 't') { say(`backup skipped: ${t} does not exist yet`); continue; }
      const bt = backupName(t, stamp);
      const reason = items.filter((i) => i.header.backupTables.includes(t)).map((i) => i.name).join(', ') || 'job metadata';
      const sql = `create schema if not exists boi_backups; create table boi_backups.${bt} as select * from ${t};` +
        (hasManifest ? ` insert into boi_backups.manifest(backup_table, source_table, row_count, target, reason, run_url) select ${lit(bt)}, ${lit(t)}, count(*), ${lit(TARGET)}, ${lit(reason)}, ${lit(RUN_URL)} from boi_backups.${bt};` : '') +
        ` select count(*) from boi_backups.${bt};`;
      const n = q(sql).split('\n').pop();
      evidence.backups.push({ table: t, backup: `boi_backups.${bt}`, rows: Number(n) });
      say(`backup: ${t} -> boi_backups.${bt} (${n} rows)`);
    }
    // 2. apply, one transaction per file, stop at the first failure
    for (const it of items) {
      const abs = path.resolve(it.file).replace(/\\/g, '/');
      let wrapper;
      if (it.kind === 'migration') {
        const v = versionOf(it.name), name = it.name.replace(/^\d{14}_/, '').replace(/\.sql$/, '');
        wrapper = `BEGIN;\n\\i ${abs}\nINSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES (${lit(v)}, ${lit(name)}, '{}');\nCOMMIT;\n`;
      } else {
        const { expectBefore: b, expectAfter: a } = it.header;
        const assert = (e, when) => `DO $a$ DECLARE n bigint; BEGIN EXECUTE $q$${e.sql}$q$ INTO n; IF n IS DISTINCT FROM ${e.count} THEN RAISE EXCEPTION '${when}-count assertion failed: got %, expected ${e.count} -- rolling back', n; END IF; RAISE NOTICE '${when}-count ok: %', n; END $a$;`;
        const sha = crypto.createHash('sha256').update(it.sql).digest('hex');
        wrapper = `BEGIN;\n${assert(b, 'before')}\n\\i ${abs}\n${assert(a, 'after')}\nINSERT INTO supabase_migrations.data_fix_log(name, issue, sha256, before_count, after_count, run_url) VALUES (${lit(it.name)}, ${it.header.issue}, ${lit(sha)}, ${b.count}, ${a.count}, ${lit(RUN_URL)});\nCOMMIT;\n`;
      }
      const r = psql(URL, ['-f', '-'], wrapper);
      const notices = (r.err.match(/NOTICE:.*$/gm) ?? []).map((s) => s.replace(/^.*NOTICE:\s*/, ''));
      if (!r.ok) {
        say(`FAILED ${it.kind} ${it.name} (rolled back): ${r.err.split('\n').filter((l) => /ERROR|DETAIL|HINT/.test(l)).join(' | ').slice(0, 600)}`);
        evidence.failed = it.name;
        break;
      }
      evidence.applied.push({ kind: it.kind, name: it.name, issue: it.header.issue, notices });
      say(`applied ${it.kind} ${it.name}${notices.length ? ` -- ${notices.join('; ')}` : ''}`);
    }
    // Backups taken before the manifest existed (the run that creates it) are registered now,
    // so the 30-day prune can find them.
    if (!hasManifest && r("select to_regclass('boi_backups.manifest') is not null") === 't') {
      for (const b of evidence.backups) q(`insert into boi_backups.manifest(backup_table, source_table, row_count, target, reason, run_url) values (${lit(b.backup.replace('boi_backups.', ''))}, ${lit(b.table)}, ${b.rows}, ${lit(TARGET)}, 'job metadata', ${lit(RUN_URL)}) on conflict do nothing`);
    }
    // 3. prune old backups (manifest-listed only)
    if (r("select to_regclass('boi_backups.manifest') is not null") === 't') {
      const old = r(`select backup_table from boi_backups.manifest where created_at < now() - interval '${BACKUP_RETENTION_DAYS} days'`).split('\n').filter(Boolean);
      for (const bt of old) q(`drop table if exists boi_backups.${bt}; delete from boi_backups.manifest where backup_table = ${lit(bt)};`);
      if (old.length) say(`pruned ${old.length} backup table(s) older than ${BACKUP_RETENTION_DAYS} days`);
    }
  }

  // 4. parity after (G7): repo migrations == target history
  const after = r('select version from supabase_migrations.schema_migrations order by 1').split('\n').filter(Boolean);
  const par = compareParity(migrations.map(versionOf), after);
  evidence.parity = par;
  const parityOk = MODE === 'plan' ? par.prodOnly.length === 0 : par.ok;
  say(parityOk ? `parity: PASS (repo ${par.repoCount} = ${TARGET} ${par.prodCount}${MODE === 'plan' && par.unapplied.length ? `; ${par.unapplied.length} pending` : ''})`
               : `parity: FAIL (target-only ${par.prodOnly.join(',') || '-'}; unapplied ${par.unapplied.join(',') || '-'})`);
  fs.writeFileSync(path.join(OUT, `evidence-${TARGET}.json`), JSON.stringify(evidence, null, 1));
  fs.writeFileSync(path.join(OUT, `evidence-${TARGET}.md`), log.join('\n') + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, log.join('\n\n') + '\n');
  if (evidence.failed || !parityOk) process.exit(1);
}

if (process.argv[1]?.endsWith('db-migrate.mjs')) main().catch((e) => { console.error(`db-migrate FAILED: ${e.message}`); process.exit(1); });
