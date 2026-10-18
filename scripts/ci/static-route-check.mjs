// Static-route check (G1): public pages must not read cookies, request headers or draft mode, so the server
// render stays cacheable. Admin, API, account and sign-in routes are exempt: they are dynamic by design.
// Usage: node scripts/ci/static-route-check.mjs   (exit 1 when a public route reads a per-visitor value)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const EXEMPT = /^src\/app\/(admin|api|account|auth)(\/|$)/;
const ROUTE_FILE = /\/(page|layout|route|template|opengraph-image|twitter-image|sitemap|robots)\.(tsx?|jsx?)$/;
// Per-visitor reads that make a page dynamic (G1).
const FORBIDDEN = [
  { name: 'cookies()', re: /\bcookies\s*\(/ },
  { name: 'headers()', re: /\bheaders\s*\(\s*\)/ },
  { name: 'draftMode()', re: /\bdraftMode\s*\(/ },
];

/** files: [{ path, source }] with paths relative to the repo root. Returns the violations. */
export function findPerVisitorReads(files) {
  const out = [];
  for (const { path, source } of files) {
    const p = path.split(sep).join('/');
    if (!p.startsWith('src/app/') || EXEMPT.test(p) || !ROUTE_FILE.test(p)) continue;
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    for (const { name, re } of FORBIDDEN) {
      if (re.test(code)) out.push({ path: p, read: name });
    }
  }
  return out;
}

function walk(dir, root, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, root, out);
    else if (/\.(tsx?|jsx?)$/.test(name)) out.push({ path: relative(root, full), source: readFileSync(full, 'utf8') });
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop());
if (isMain) {
  const root = process.cwd();
  const violations = findPerVisitorReads(walk(join(root, 'src', 'app'), root));
  if (violations.length) {
    for (const v of violations) console.error(`static-route: ${v.path} reads ${v.read} (public routes must not)`);
    process.exit(1);
  }
  console.log('static-route check: no public route reads a per-visitor value');
}
