// Static-route check (G1): public routes never read cookies, headers or draft mode; the real tree passes.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
// @ts-ignore plain script module
import { findPerVisitorReads } from '../scripts/ci/static-route-check.mjs';

const root = join(__dirname, '..');

describe('static-route check: the rule', () => {
  it('a public page that reads cookies is a violation', () => {
    const v = findPerVisitorReads([{ path: 'src/app/sets/[slug]/page.tsx', source: "import { cookies } from 'next/headers';\nexport default async function P() { const c = cookies(); }" }]);
    expect(v).toEqual([{ path: 'src/app/sets/[slug]/page.tsx', read: 'cookies()' }]);
  });

  it('a public page that reads request headers is a violation', () => {
    const v = findPerVisitorReads([{ path: 'src/app/news/page.tsx', source: 'const h = headers();' }]);
    expect(v).toEqual([{ path: 'src/app/news/page.tsx', read: 'headers()' }]);
  });

  it('a mention in a comment is not a read', () => {
    const v = findPerVisitorReads([{ path: 'src/app/news/page.tsx', source: '// we do not call cookies() here\nexport const x = 1;' }]);
    expect(v).toEqual([]);
  });

  it('admin, api, account and auth routes are exempt', () => {
    const src = 'const c = cookies();';
    for (const path of ['src/app/admin/pending/page.tsx', 'src/app/api/img/route.ts', 'src/app/account/page.tsx', 'src/app/auth/page.tsx']) {
      expect(findPerVisitorReads([{ path, source: src }])).toEqual([]);
    }
  });

  it('a helper module (not a route file) is not checked as a route', () => {
    expect(findPerVisitorReads([{ path: 'src/app/lib/helper.ts', source: 'cookies();' }])).toEqual([]);
  });
});

describe('static-route check: the real site tree', () => {
  it('no public route reads a per-visitor value', () => {
    const files: { path: string; source: string }[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(tsx?|jsx?)$/.test(name)) files.push({ path: relative(root, full), source: readFileSync(full, 'utf8') });
      }
    };
    walk(join(root, 'src', 'app'));
    expect(findPerVisitorReads(files)).toEqual([]);
  });
});
