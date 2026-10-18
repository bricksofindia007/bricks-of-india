// Audit: no Bundle 2 code path reads store_prices or price_history with the browser (anon) key.
// Migration 20261017270000 revokes anon SELECT on both tables, so a browser-key read would fail after it applies.
// Checks: (1) no client component touches the price tables; (2) the only anon-key client outside src/lib/supabase.ts
// never reads them; (3) every direct price-table read in src runs on the server client (service key, server-only)
// or on a client handed in by a server caller.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = join(__dirname, '..');
const PRICE_TABLES = 'store_prices|price_history';
const DIRECT_READ = new RegExp(`\\.from\\(\\s*['"](${PRICE_TABLES})['"]\\s*\\)`, 'g');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?|mjs)$/.test(name)) out.push(full);
  }
  return out;
}
const rel = (full: string) => relative(root, full).split(sep).join('/');
/** Source with // and block-comment lines removed, so a comment that names a table is not a read. */
const code = (src: string) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

const srcFiles = walk(join(root, 'src'));
const directReads = srcFiles
  .map((f) => ({ file: rel(f), src: code(readFileSync(f, 'utf8')) }))
  .filter((f) => new RegExp(DIRECT_READ.source).test(f.src));

// Files that take their client from the caller (lib helpers). Each caller is a server route or a server script.
const CALLER_CLIENT = new Set(['src/lib/gate14-facts.ts', 'src/lib/generate-body.ts', 'src/lib/publish-draft.ts']);

describe('no browser-key read of the price tables', () => {
  it('no client component touches store_prices or price_history', () => {
    const offenders = directReads.filter((f) => /^['"]use client['"]/m.test(readFileSync(join(root, f.file), 'utf8')));
    expect(offenders.map((f) => f.file)).toEqual([]);
  });

  it('the only anon-key client outside src/lib/supabase.ts is the sets search route, and it never reads a price table', () => {
    const anonBuilders = srcFiles
      .filter((f) => rel(f) !== 'src/lib/supabase.ts')
      .filter((f) => /createClient\(/.test(readFileSync(f, 'utf8')) && /SUPABASE_ANON_KEY/.test(readFileSync(f, 'utf8')))
      .map(rel);
    expect(anonBuilders).toEqual(['src/app/api/sets/search/route.ts']);
    const searchRoute = readFileSync(join(root, 'src/app/api/sets/search/route.ts'), 'utf8');
    expect(new RegExp(DIRECT_READ.source).test(searchRoute)).toBe(false);
  });

  it('pages and components never import the anon client to read a price table', () => {
    const anonImporters = directReads.filter((f) => /import\s*\{[^}]*\b(supabase|supabaseRead|createPublicClient)\b[^}]*\}\s*from\s*['"]@\/lib\/supabase['"]/.test(f.src));
    expect(anonImporters.map((f) => f.file)).toEqual([]);
  });

  it('every direct price-table read in src is on the server client or a caller-provided client', () => {
    const bad = directReads
      .filter((f) => !CALLER_CLIENT.has(f.file))
      .filter((f) => !/createServerClient\(/.test(f.src))
      .map((f) => f.file);
    expect(bad).toEqual([]);
  });

  it('the server client refuses to fall back to the anon key', () => {
    const lib = readFileSync(join(root, 'src/lib/supabase.ts'), 'utf8');
    expect(lib).toContain("refusing to fall back to anon key");
  });
});
