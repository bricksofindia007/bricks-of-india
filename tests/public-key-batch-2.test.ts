// Negative tests for public-key batch 2: compare, deals, budget calculator, retiring soon.
// These pages must read with the public key only. They must never reach the full key.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BATCH = [
  'src/app/compare/page.tsx',
  'src/app/deals/page.tsx',
  'src/app/lab/budget-calculator/page.tsx',
  'src/app/lab/retiring-soon/page.tsx',
];
const root = join(__dirname, '..');

// Code only: comments may mention the old client name without using it.
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('public-key batch 2: source checks', () => {
  for (const f of BATCH) {
    const src = codeOnly(readFileSync(join(root, f), 'utf8'));

    it(`${f} does not use the full-access client`, () => {
      expect(src).not.toMatch(/createServerClient/);
      expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    });

    it(`${f} reads through the public-key client`, () => {
      expect(src).toMatch(/createPublicClient\(/);
    });
  }
});
