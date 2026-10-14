#!/usr/bin/env node
// FP2.3 step 6 (P5 Step 4c): migration parity between the repo and production's
// supabase_migrations.schema_migrations, read through the ci_readonly role (#197).
//
// The repo's migration set is the top-level supabase/migrations/*.sql files (the
// _archive/ and _history/ subfolders are records, never applied). Rules:
//   * a version in production with no repo file                  -> FAIL (applied outside the repo, G7)
//   * a repo file not in production:
//       - added by the PR under test (--pr-added)                -> PENDING (reported, not a failure)
//       - otherwise (e.g. merged to main but never applied)      -> FAIL
// Failure behaviour (G14): if production can't be read, the job fails; it never
// reports parity it didn't check.
//
//   node scripts/ci/migration-parity.mjs --prod prod_versions.txt [--dir supabase/migrations] [--pr-added "a.sql b.sql"]
import fs from 'node:fs';
import path from 'node:path';

export function versionOf(file) {
  const m = /^(\d{14})_.+\.sql$/.exec(path.basename(file));
  return m ? m[1] : null;
}

export function repoVersions(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => versionOf(e.name))
    .filter(Boolean);
}

export function compareParity(repo, prod, prAdded = []) {
  const r = new Set(repo), p = new Set(prod), added = new Set(prAdded);
  const prodOnly = [...p].filter((v) => !r.has(v)).sort();
  const repoOnly = [...r].filter((v) => !p.has(v)).sort();
  const pending = repoOnly.filter((v) => added.has(v));
  const unapplied = repoOnly.filter((v) => !added.has(v));
  return { ok: prodOnly.length === 0 && unapplied.length === 0, prodOnly, pending, unapplied, repoCount: r.size, prodCount: p.size };
}

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : dflt;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('migration-parity.mjs')) {
  const prodFile = arg('--prod');
  const dir = arg('--dir', 'supabase/migrations');
  const prAdded = (arg('--pr-added', '') || '').split(/\s+/).map(versionOf).filter(Boolean);
  if (!prodFile || !fs.existsSync(prodFile)) { console.error('FAIL: no production version list (--prod) -- parity NOT checked'); process.exit(2); }
  const prod = fs.readFileSync(prodFile, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (prod.length === 0 || prod.some((v) => !/^\d{14}$/.test(v))) { console.error('FAIL: production version list empty or malformed -- parity NOT checked'); process.exit(2); }
  const res = compareParity(repoVersions(dir), prod, prAdded);
  console.log(`repo: ${res.repoCount} migration file(s) in ${dir}; production: ${res.prodCount} schema_migrations row(s)`);
  for (const v of res.prodOnly) console.log(`FAIL production-only: ${v} is applied in production with no repo file (G7)`);
  for (const v of res.unapplied) console.log(`FAIL repo-only: ${v} has a repo file but is not applied in production`);
  for (const v of res.pending) console.log(`PENDING: ${v} is added by this PR and not yet applied (apply staging first, then production, before merge)`);
  console.log(res.ok ? 'PASS: repo and production migration history match' : 'FAIL: migration drift');
  process.exit(res.ok ? 0 : 1);
}
