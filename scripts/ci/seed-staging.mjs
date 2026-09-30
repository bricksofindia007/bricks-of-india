#!/usr/bin/env node
// P12 (#443, FP2.1): seed staging with production's public content so data fixes rehearse on real rows.
// Run by .github/workflows/seed-staging.yml (its own environment + approval), manually and after every
// staging rebuild, AFTER that workflow has applied staging's pending migrations (so both schemas match).
//
//   PROD_URL=<ci_readonly> STAGING_URL=<staging postgres> OUT_DIR=seed-out node scripts/ci/seed-staging.mjs
//
// * Production is read ONLY as ci_readonly (read-only role, SELECT on exactly these tables; migration
//   20260929200000). The script refuses any other production user.
// * Staging is written in ONE transaction: sets upserted (other tables reference it), then
//   news_articles / reviews / guides truncated and reloaded. Any error rolls everything back.
// * Every column is copied: the site selects * from all four tables. None holds an email, IP address
//   or user id (P12 check against the baseline); the job fails if production has a column staging lacks.
// * Evidence: per table, the production count, the staging count and an md5 fingerprint over the copied
//   columns on both sides (hashes only -- the repo and its artifacts are public). The transaction commits
//   only if they match.
// Failure behaviour (G14): nothing is written unless every table matches; the job fails loudly.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const PROD_REF = 'hqpaiarhmiocmjrzjhtw';
// mode 'replace' = truncate + reload; 'upsert' = insert-or-update by id (rows other tables reference).
// `skipInFingerprint`: columns a staging trigger rewrites on update (sets_updated_at), so they can't match.
export const TABLES = [
  { table: 'sets', mode: 'upsert', skipInFingerprint: ['updated_at'] },
  { table: 'news_articles', mode: 'replace', skipInFingerprint: [] },
  { table: 'reviews', mode: 'replace', skipInFingerprint: [] },
  { table: 'guides', mode: 'replace', skipInFingerprint: [] },
];

export function fingerprintSql(table, cols, where = '') {
  const row = cols.map((c) => `coalesce(${q(c)}::text, '<null>')`).join(` || '|' || `);
  return `select count(*) || ' ' || coalesce(md5(string_agg(md5(${row}), '' order by id::text)), '-') from public.${table} ${where}`;
}

// Only rows that differ are updated: an update fires sets' index-tier trigger once per row, and
// updated_at (rewritten by a trigger) is left out of the comparison.
export function upsertSql(table, cols, ignore = []) {
  const list = cols.map(q).join(', ');
  const upd = cols.filter((c) => c !== 'id');
  const set = upd.map((c) => `${q(c)} = excluded.${q(c)}`).join(', ');
  const cmp = upd.filter((c) => !ignore.includes(c));
  const where = `(${cmp.map((c) => `t.${q(c)}`).join(', ')}) is distinct from (${cmp.map((c) => `excluded.${q(c)}`).join(', ')})`;
  return `insert into public.${table} as t (${list}) select ${list} from seed_${table} on conflict (id) do update set ${set} where ${where};`;
}

// Replace tables load through a temp table so identity columns (guides.id is GENERATED ALWAYS) keep
// production's ids: OVERRIDING SYSTEM VALUE is a no-op on tables without one.
export function replaceSql(table, cols) {
  const list = cols.map(q).join(', ');
  return `insert into public.${table} (${list}) overriding system value select ${list} from seed_${table};`;
}

const q = (c) => `"${c.replace(/"/g, '""')}"`;

function psql(url, args, input) {
  const r = spawnSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', ...args], {
    input, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, PGCONNECT_TIMEOUT: '15' },
  });
  return { ok: r.status === 0, out: (r.stdout ?? '').replace(/\r/g, '').trim(), err: (r.stderr ?? '').replace(/\r/g, '').trim() };
}
// ci_readonly defaults to statement_timeout 10s; SET in the same session (the pooler may drop PGOPTIONS).
const TIMEOUT = ['-c', "set statement_timeout = '120s'"];
function one(url, sql) { const r = psql(url, ['-At', ...TIMEOUT, '-c', sql]); if (!r.ok) throw new Error(r.err); return r.out; }

function columns(url, table) {
  return one(url, `select column_name from information_schema.columns where table_schema = 'public' and table_name = '${table}' order by ordinal_position`)
    .split('\n').filter(Boolean);
}

async function main() {
  const PROD = process.env.PROD_URL, STG = process.env.STAGING_URL, OUT = process.env.OUT_DIR ?? 'seed-out';
  if (!PROD || !STG) throw new Error('PROD_URL and STAGING_URL are required');
  if (STG.includes(PROD_REF)) throw new Error('STAGING_URL points at the production project -- refusing');
  if (!PROD.includes(PROD_REF)) throw new Error('PROD_URL is not the production project -- refusing');
  fs.mkdirSync(OUT, { recursive: true });
  const log = [];
  const say = (s) => { console.log(s); log.push(s); };

  const prodUser = one(PROD, 'select current_user');
  if (prodUser !== 'ci_readonly') throw new Error(`production must be read as ci_readonly, got ${prodUser} -- refusing`);
  if (one(PROD, 'show transaction_read_only') !== 'on') throw new Error('production session is not read-only -- refusing');
  say('## seed-staging (P12, #443)');
  say(`production read as ${prodUser} (read-only); staging written in one transaction`);

  const plan = [];
  for (const t of TABLES) {
    const pc = columns(PROD, t.table), sc = columns(STG, t.table);
    const missing = pc.filter((c) => !sc.includes(c));
    if (missing.length) throw new Error(`${t.table}: staging lacks column(s) ${missing.join(', ')} -- run staging migrations first`);
    const file = path.resolve(OUT, `${t.table}.csv`);
    const x = psql(PROD, [...TIMEOUT, '-c', `\\copy (select ${pc.map(q).join(', ')} from public.${t.table} order by id) to '${file.replace(/\\/g, '/')}' with (format csv)`]);
    if (!x.ok) throw new Error(`${t.table}: export failed: ${x.err}`);
    const fpCols = pc.filter((c) => !t.skipInFingerprint.includes(c));
    const prodFp = one(PROD, fingerprintSql(t.table, fpCols));
    plan.push({ ...t, cols: pc, fpCols, file, prodFp });
    say(`export ${t.table}: ${prodFp.split(' ')[0]} rows, ${pc.length} columns`);
  }

  const res = psql(STG, ['-At', '-f', '-'], buildLoadSql(plan));
  if (!res.ok) throw new Error(`staging load rolled back: ${res.err}`);
  finish(plan, res, OUT, log, say);
}

/** One staging transaction. The final DO block compares fingerprints and raises (rolling back) on any mismatch. */
export function buildLoadSql(plan) {
  const lines = ['begin;'];
  for (const t of plan) {
    lines.push(`create temp table seed_${t.table} (like public.${t.table}) on commit drop;`);
    lines.push(`\\copy seed_${t.table} (${t.cols.map(q).join(', ')}) from '${t.file.replace(/\\/g, '/')}' with (format csv)`);
  }
  for (const t of plan.filter((p) => p.mode === 'upsert')) lines.push(upsertSql(t.table, t.cols, t.skipInFingerprint));
  const replace = plan.filter((p) => p.mode === 'replace');
  lines.push(`truncate ${replace.map((p) => `public.${p.table}`).join(', ')};`);
  for (const t of replace) lines.push(replaceSql(t.table, t.cols));
  lines.push(`select setval(pg_get_serial_sequence('public.guides', 'id'), coalesce(max(id), 1)) from public.guides;`);
  const checks = plan.map((t) => {
    const where = t.mode === 'upsert' ? `where id in (select id from seed_${t.table})` : '';
    return `  if (${fingerprintSql(t.table, t.fpCols, where)}) <> '${t.prodFp}' then raise exception 'seed mismatch on ${t.table}'; end if;`;
  });
  lines.push(`do $$ begin\n${checks.join('\n')}\nend $$;`);
  lines.push(...plan.map((t) => `select '${t.table}|' || (select count(*) from public.${t.table});`));
  lines.push('commit;');
  return lines.join('\n') + '\n';
}

function finish(plan, res, OUT, log, say) {
  const counts = Object.fromEntries(res.out.split('\n').filter((l) => l.includes('|')).map((l) => l.split('|')).map(([k, v]) => [k, Number(v)]));
  const evidence = { tables: plan.map((t) => ({ table: t.table, mode: t.mode, columns: t.cols.length, production_rows: Number(t.prodFp.split(' ')[0]), staging_rows_after: counts[t.table], fingerprint_match: true })) };
  for (const e of evidence.tables) say(`${e.table} (${e.mode}): production ${e.production_rows}, staging after ${e.staging_rows_after}, fingerprint match`);
  for (const t of plan) fs.rmSync(t.file, { force: true }); // never upload content: the repo is public
  fs.writeFileSync(path.join(OUT, 'evidence-seed.json'), JSON.stringify(evidence, null, 1));
  fs.writeFileSync(path.join(OUT, 'evidence-seed.md'), log.join('\n') + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, log.join('\n\n') + '\n');
}

if (process.argv[1]?.endsWith('seed-staging.mjs')) main().catch((e) => { console.error(`seed-staging FAILED: ${e.message}`); process.exit(1); });
