#!/usr/bin/env node
// Audit: which scripts reach the Supabase client module (src/lib/supabase.ts) through imports, and which workflows run them.
// A script that reaches the client module needs NEXT_PUBLIC_SUPABASE_ANON_KEY in its environment, because the client
// module builds an anon client at load time (createClient with an empty key throws).
// Read-only. Prints file paths and workflow names only.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET = path.join(ROOT, 'src/lib/supabase.ts');
const SKIP_DIRS = new Set(['node_modules', '.next', '.open-next', '.git']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js|cjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Pure. Import specifiers in a source text. */
export function importsOf(src) {
  const specs = [];
  const re = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src))) specs.push(m[1] ?? m[2] ?? m[3]);
  return specs;
}

/** Pure. Resolves an import specifier from a file to a file path inside the repo (or null when it is external). */
export function resolveSpec(fromFile, spec, files) {
  let base;
  if (spec.startsWith('@/')) base = path.join(ROOT, 'src', spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null;
  for (const cand of [base, base + '.ts', base + '.tsx', base + '.mjs', base + '.js', path.join(base, 'index.ts')]) {
    if (files.has(cand)) return cand;
  }
  return null;
}

function main() {
  const files = walk(ROOT);
  const set = new Set(files);
  const graph = new Map();
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const deps = importsOf(src).map((s) => resolveSpec(f, s, set)).filter(Boolean);
    graph.set(f, deps);
  }
  // Reverse closure: every file that reaches TARGET.
  const reaches = new Set([TARGET]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [f, deps] of graph) {
      if (!reaches.has(f) && deps.some((d) => reaches.has(d))) { reaches.add(f); changed = true; }
    }
  }
  const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
  const scripts = [...reaches].filter((f) => rel(f).startsWith('scripts/') && !rel(f).startsWith('scripts/ci/audit-'));
  console.log('scripts that reach the Supabase client module:');
  for (const s of scripts.map(rel).sort()) console.log('  ' + s);
  return scripts.map(rel);
}

if (process.argv[1] && process.argv[1].endsWith('audit-supabase-importers.mjs')) main();
export { main };
