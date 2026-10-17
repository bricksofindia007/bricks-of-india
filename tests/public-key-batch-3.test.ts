// Negative tests for public-key batch 3: cmf tracker, minifig HQ, price drops, themes.
// These pages must read with the public key only. They must never reach the full key.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BATCH = [
  'src/app/lab/cmf-tracker/page.tsx',
  'src/app/minifig-hq/page.tsx',
  'src/app/lab/price-drops/page.tsx',
  'src/app/themes/[theme]/page.tsx',
];
const root = join(__dirname, '..');

// Code only: comments may mention the old client name without using it.
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('public-key batch 3: source checks', () => {
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
