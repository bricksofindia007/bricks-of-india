#!/usr/bin/env node
// Pre-window lint: every migration and every data-fix file in the repo goes through the same lint the
// runner applies at plan time, plus the stray-file check for data fixes. No database is needed.
//
//   node scripts/ci/prewindow-lint.mjs [root] [--from <version>]
//   root defaults to supabase/, the repo's own folder. --from skips migrations older than the version
//   (default 20261017000000, the first Bundle 1 migration): the older ones are already applied in
//   production, and the runner only lints files that are still pending.
//
// Prints one line per problem, then a count line. Exit 0 only when there are no problems.
// Failure behaviour (G14): any problem, or an unreadable folder, exits non-zero.
import fs from 'node:fs';
import path from 'node:path';
import { listRepo, lintFile, strayFixFiles } from './db-migrate.mjs';

const args = process.argv.slice(2);
const fromIdx = args.indexOf('--from');
const from = fromIdx >= 0 ? args[fromIdx + 1] : '20261017000000';
const positional = args.filter((a, i) => a !== '--from' && !(i > 0 && args[i - 1] === '--from'));
const root = positional[0] ?? 'supabase';
const migDir = path.join(root, 'migrations');
const fixDir = path.join(root, 'data-fixes');

const migrations = listRepo(migDir, 'migration').filter((n) => (n.match(/^(\d+)/)?.[1] ?? '0') >= from);
const fixes = listRepo(fixDir, 'fix');
const problems = [];

for (const name of migrations) {
  problems.push(...lintFile('migration', name, fs.readFileSync(path.join(migDir, name), 'utf8')));
}
for (const name of fixes) {
  problems.push(...lintFile('fix', name, fs.readFileSync(path.join(fixDir, name), 'utf8')));
}
if (fs.existsSync(fixDir)) {
  const all = fs.readdirSync(fixDir, { withFileTypes: true }).filter((e) => e.isFile() && e.name.endsWith('.sql')).map((e) => e.name);
  for (const stray of strayFixFiles(all)) problems.push(`${stray}: data-fix file name does not start with an issue number`);
}

for (const p of problems) console.log(`PROBLEM ${p}`);
console.log(`prewindow lint: ${migrations.length} migration file(s), ${fixes.length} data-fix file(s), ${problems.length} problem(s)`);
process.exit(problems.length ? 1 : 0);
