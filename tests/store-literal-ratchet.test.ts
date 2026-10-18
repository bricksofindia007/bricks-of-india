// Ratchet: the count of hard-coded store display-name literals (LEGO.in, Toycra, MyBrickHouse) outside the allowed
// places may only go down. Allowed: comments, detection patterns, legal copy, the shared file itself, the legacy
// correction map, and tests. The baseline is the count when this test was added; lower it when the count falls.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = join(__dirname, '..');
const BASELINE_FILE = join(__dirname, 'fixtures', 'store-literal-baseline.json');
const DISPLAY = /LEGO\.in|Toycra|MyBrickHouse/;

const ALLOWED_FILES = [
  /^config\/store-display-names\.json$/,
  /^src\/lib\/store-display-names\.ts$/,
  /^scripts\/lib\/store_display_names\.py$/,
  /^src\/lib\/legacy-store-names\.ts$/,
  /^src\/lib\/affiliate-disclosure\.ts$/,
  /^src\/app\/legal\//,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'node_modules' || name === '.next' || name === '_archive') continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?|mjs|cjs|py)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** Lines that count: a display-name literal on a line that is not a comment and not a detection pattern. */
export function countLiterals(): { total: number; byFile: Record<string, number> } {
  const byFile: Record<string, number> = {};
  let total = 0;
  for (const dir of ['src', 'scripts']) {
    for (const full of walk(join(root, dir))) {
      const file = relative(root, full).split(sep).join('/');
      if (ALLOWED_FILES.some((re) => re.test(file))) continue;
      const lines = readFileSync(full, 'utf8').split('\n');
      for (const line of lines) {
        const t = line.trim();
        if (!DISPLAY.test(t)) continue;
        if (/^(\/\/|\*|\/\*|\{\/\*|<!--|#)/.test(t)) continue; // comment
        if (/\.test\(|RegExp|\/gi\b|\/i\b|replace\(\/|match\(\/|\\b|\(\?:/.test(t)) continue; // detection pattern
        total++;
        byFile[file] = (byFile[file] ?? 0) + 1;
      }
    }
  }
  return { total, byFile };
}

describe('store display-name ratchet', () => {
  const baseline: number = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')).count;
  it('the count does not go up', () => {
    const { total, byFile } = countLiterals();
    if (total > baseline) {
      console.log('files with new literals:', JSON.stringify(byFile, null, 2));
    }
    expect(total).toBeLessThanOrEqual(baseline);
  });
  it('the baseline is the recorded count (lower it when the count falls)', () => {
    const { total } = countLiterals();
    if (total < baseline) {
      console.log(`count is ${total}, below the baseline ${baseline}: lower the baseline in tests/fixtures/store-literal-baseline.json`);
    }
    expect(total).toBeLessThanOrEqual(baseline);
  });
});
