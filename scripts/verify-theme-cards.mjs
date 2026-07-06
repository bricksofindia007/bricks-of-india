/**
 * verify-theme-cards.mjs
 *
 * Guard script, wired into `npm run build` (see package.json "prebuild").
 * Reads the slug list from src/lib/brand.ts's THEMES array and confirms
 * both public/theme-cards/<slug>.webp and <slug>.jpg exist on disk.
 *
 * Hard-fails (non-zero exit) if any are missing -- a future THEMES entry
 * added without a matching card must break the build loudly, not silently
 * fall through to the _default placeholder in production.
 *
 * brand.ts is TypeScript, and this is a plain Node ESM script (no ts-node
 * dependency) -- the slug list is parsed directly out of the source text
 * rather than importing the module.
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CARDS_DIR = join(ROOT, 'public', 'theme-cards');
const BRAND_TS = join(ROOT, 'src', 'lib', 'brand.ts');

const src = readFileSync(BRAND_TS, 'utf-8');
const slugs = [...src.matchAll(/slug:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);

if (slugs.length === 0) {
  console.error(`✗ verify-theme-cards: parsed zero slugs out of ${BRAND_TS} -- regex may be stale, check the THEMES array format.`);
  process.exit(1);
}

const missing = [];
for (const slug of slugs) {
  const webp = join(CARDS_DIR, `${slug}.webp`);
  const jpg = join(CARDS_DIR, `${slug}.jpg`);
  if (!existsSync(webp)) missing.push(`${slug}.webp`);
  if (!existsSync(jpg)) missing.push(`${slug}.jpg`);
}

if (missing.length > 0) {
  console.error(`\n✗ verify-theme-cards: ${missing.length} missing theme card file(s):\n`);
  for (const m of missing) console.error(`  - public/theme-cards/${m}`);
  console.error(`\nAdd the missing file(s) before building, or the site will silently fall back to _default for these themes.\n`);
  process.exit(1);
}

console.log(`✓ verify-theme-cards: all ${slugs.length} themes have both .webp and .jpg cards present.`);
