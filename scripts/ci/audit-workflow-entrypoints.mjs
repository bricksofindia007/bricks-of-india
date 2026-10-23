#!/usr/bin/env node
// Audit: every JS/TS file a workflow runs (directly, or through a script it names), and whether that file reaches the
// Supabase client module (src/lib/supabase.ts). Prints the workflow, the file, and whether NEXT_PUBLIC_SUPABASE_ANON_KEY
// is set in that workflow's environment text. Read-only. Names only, no values.
import fs from 'node:fs';
import path from 'node:path';
import { main as reachMain } from './audit-supabase-importers.mjs';

const ROOT = process.cwd();
const wfDir = path.join(ROOT, '.github/workflows');
const reach = new Set(reachMain().map((p) => p.replace(/\\/g, '/')));   // scripts reaching the client module
const wfs = fs.readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f));
let issues = 0;
for (const wf of wfs) {
  const text = fs.readFileSync(path.join(wfDir, wf), 'utf8');
  const files = new Set();
  for (const m of text.matchAll(/((?:scripts|src|tools|workers|social-automation|config)\/[A-Za-z0-9_./\[\]-]+\.(?:ts|tsx|mjs|js|cjs))/g)) files.add(m[1]);
  if (!files.size) continue;
  const hasAnon = /NEXT_PUBLIC_SUPABASE_ANON_KEY/.test(text);
  for (const f of files) {
    if (!reach.has(f)) continue;
    console.log(`${hasAnon ? 'OK     ' : 'MISSING'} ${wf}: ${f} reaches the client module${hasAnon ? '' : ' and the workflow lacks NEXT_PUBLIC_SUPABASE_ANON_KEY'}`);
    if (!hasAnon) issues++;
  }
}
console.log(issues ? `${issues} workflow entry point(s) missing the anon key` : 'no workflow entry point is missing the anon key');
process.exitCode = issues ? 1 : 0;
