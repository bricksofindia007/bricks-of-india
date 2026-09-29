#!/usr/bin/env node
// P12 item 4b: `npm audit --audit-level=high`, minus the advisories accepted
// under plan X.4 (.github/npm-audit-accepted.json). Fails only on a NEW
// high/critical advisory, so the weekly code-audit stops going red on a
// known, accepted risk -- and still goes red the day a new one appears.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const accepted = JSON.parse(readFileSync(new URL('../../.github/npm-audit-accepted.json', import.meta.url), 'utf8')).accepted;
const r = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
let report;
try { report = JSON.parse(r.stdout); } catch { console.error('npm audit produced no JSON:', (r.stderr || '').slice(0, 500)); process.exit(1); }

const found = new Map(); // GHSA id -> { severity, title, packages }
for (const [pkg, v] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of v.via) {
    if (typeof via !== 'object' || !['high', 'critical'].includes(via.severity)) continue;
    const id = String(via.url ?? '').split('/').pop() || `${pkg}:${via.title}`;
    const e = found.get(id) ?? { severity: via.severity, title: via.title, packages: new Set() };
    e.packages.add(pkg);
    found.set(id, e);
  }
}

const fresh = [...found].filter(([id]) => !(id in accepted));
for (const [id, e] of found) console.log(`${id in accepted ? 'accepted' : 'NEW     '}  ${e.severity}  ${id}  ${e.title}  (${[...e.packages].join(', ')})`);
const stale = Object.keys(accepted).filter((id) => !found.has(id));
for (const id of stale) console.log(`note: accepted ${id} no longer reported -- remove it from .github/npm-audit-accepted.json`);
if (fresh.length) {
  console.error(`::error::${fresh.length} new high/critical npm advisory(ies) not in the accepted list`);
  process.exit(1);
}
console.log(`npm audit: ${found.size} high/critical advisory(ies), all accepted (X.4); no new ones.`);
