// No page or metadata text may state a price-update frequency of six hours. The site says "prices checked daily".
// Code comments are not public text, so they are skipped. Scope: the app, components and lib sources, the public text
// files, and the two content scripts that hold copy.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const root = join(__dirname, '..');
const SOURCE_DIRS = ['src/app', 'src/components', 'src/lib'];
const PUBLIC_TEXT = ['public/llms.txt', 'public/robots.txt'];
const COPY_SCRIPTS = ['scripts/seed-content.js', 'scripts/insert-opinion-01-03.js'];

// A price-update claim: the frequency phrase on a line that is about prices or updates.
const FREQUENCY = /every\s+(6|six)\s+hours?|\b6-hourly\b|\b6\s+hours?\b/i;
const ABOUT_PRICES = /price|prices|updat|refresh|checked/i;

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '__tests__') continue;
      out.push(...files(p));
    } else if (['.ts', '.tsx', '.js', '.mjs'].includes(extname(p)) && !/\.test\./.test(name)) {
      out.push(p);
    }
  }
  return out;
}

// Lines that are code comments (// or /* ... */ blocks and their * lines) are not public text.
function publicText(src: string): string[] {
  const lines: string[] = [];
  let inBlock = false;
  for (const raw of src.split('\n')) {
    const t = raw.trim();
    if (inBlock) {
      if (t.includes('*/')) inBlock = false;
      continue;
    }
    if (t.startsWith('/*')) {
      if (!t.includes('*/')) inBlock = true;
      continue;
    }
    if (t.startsWith('//')) continue;
    lines.push(raw);
  }
  return lines;
}

function claims(file: string): string[] {
  const src = readFileSync(join(root, file), 'utf8');
  return publicText(src)
    .filter((line) => FREQUENCY.test(line) && ABOUT_PRICES.test(line))
    .map((line) => line.trim());
}

describe('no page or metadata text states a six-hour price update', () => {
  const sourceFiles = SOURCE_DIRS.flatMap((d) => files(join(root, d)));
  const scoped = [
    ...sourceFiles.map((f) => relative(root, f).replace(/\\/g, '/')),
    ...PUBLIC_TEXT.filter((f) => existsSync(join(root, f))),
    ...COPY_SCRIPTS,
  ];

  it('the scope is not empty', () => {
    expect(sourceFiles.length).toBeGreaterThan(50);
  });

  for (const file of scoped) {
    it(`${file}`, () => {
      expect(claims(file)).toEqual([]);
    });
  }
});
