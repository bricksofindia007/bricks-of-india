// After the price-read release, no code path reads the two price tables with the public key. The anonymous
// role is refused on both tables; a read through a public client would fail in production, and the
// server path (full-access client) is the only route to them.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(__dirname, '..');
const PRICE_TABLE_READ = /\.from\(\s*['"](store_prices|price_history)['"]\s*\)/;
// Names that hand out a public-key (anonymous) client.
const PUBLIC_CLIENT = /createPublicClient\(|import\s*\{[^}]*\b(supabase|supabaseRead)\b[^}]*\}\s*from\s*['"]@\/lib\/supabase['"]/;
const SERVER_CLIENT = /createServerClient\(/;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

describe('no public-key read of the price tables', () => {
  const files = sourceFiles(join(root, 'src'));

  it('scans the site source', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('no file reads store_prices or price_history through a public-key client', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      if (!PRICE_TABLE_READ.test(src)) continue;
      if (!PUBLIC_CLIENT.test(src)) continue;
      // A file that also builds the full-access client may use it for the price read; a file that does not is an offender.
      if (SERVER_CLIENT.test(src)) continue;
      offenders.push(relative(root, f));
    }
    expect(offenders).toEqual([]);
  });
});
