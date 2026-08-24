/**
 * CI guard: content_quality_issues.check_name ownership.
 *
 * BOI Fix Brief (2026-08-24), Phase 0.2 incident addendum, item 4.
 * See scripts/lib/content-quality-check-ownership.mjs for the full
 * incident this exists to prevent from recurring.
 *
 * Two things fail this check:
 *   1. A registered writer file (scripts/content-linter.mjs,
 *      scripts/visual-renderer.mjs, scripts/reviews-source-refresh.mjs)
 *      contains a check_name literal (flag(...) call, or a known dynamic
 *      source like checkReviewSourceGates) not declared as its own in
 *      CHECK_NAME_OWNERS. This is exactly the class of bug that caused
 *      the 2026-08-24 incident -- a script gains a new check_name
 *      without anyone updating the ownership manifest.
 *   2. A file that inserts into content_quality_issues exists on disk
 *      but has no entry in CHECK_NAME_OWNERS at all -- a brand new
 *      writer nobody registered.
 *
 * Usage: node scripts/lint-check-name-ownership.mjs
 * Exit 0 = clean, exit 1 = violation(s) found (printed to stderr).
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { CHECK_NAME_OWNERS, RETIRED_CHECK_NAMES } from './lib/content-quality-check-ownership.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = __dirname;

let failed = false;

function fail(msg) {
  console.error(`  FAIL: ${msg}`);
  failed = true;
}

// ── 1. Find every script that writes to content_quality_issues ──────────────
// Recursive (scripts/ has real writers one level down, e.g.
// scripts/radar/guide-staleness-guard.js) -- files are keyed by basename in
// CHECK_NAME_OWNERS, matching how every writer script refers to itself in
// its own comments/sourceLabel, not by full path.

const SKIP_DIRS = new Set(['node_modules', 'lib', 'video', 'test']);

function findScriptFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...findScriptFiles(join(dir, entry.name)));
    } else if (entry.isFile() && (entry.name.endsWith('.mjs') || entry.name.endsWith('.js'))) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

const candidatePaths = findScriptFiles(SCRIPTS_DIR)
  .filter(p => p !== join(SCRIPTS_DIR, 'lint-check-name-ownership.mjs'));

const writerPaths = {}; // basename -> full path
for (const p of candidatePaths) {
  const src = readFileSync(p, 'utf-8');
  if (/content_quality_issues['"]\)\s*\.\s*(insert|upsert)\(/.test(src) || /reconcileIssues\(/.test(src)) {
    writerPaths[p.split(/[\\/]/).pop()] = p;
  }
}
const writerFiles = Object.keys(writerPaths);

console.log(`Found ${writerFiles.length} script(s) writing to content_quality_issues: ${writerFiles.join(', ')}`);

const registeredFiles = Object.keys(CHECK_NAME_OWNERS);
for (const f of writerFiles) {
  if (!registeredFiles.includes(f)) {
    fail(`${f} writes to content_quality_issues but has no entry in CHECK_NAME_OWNERS (scripts/lib/content-quality-check-ownership.mjs). Register its check_name list there.`);
  }
}
for (const f of registeredFiles) {
  if (!writerFiles.includes(f)) {
    console.warn(`  NOTE: ${f} is registered in CHECK_NAME_OWNERS but no longer appears to write to content_quality_issues (renamed or removed?). Not a hard failure, but worth checking.`);
  }
}

// ── 2. Every check_name literal in a registered file must be declared ───────

// Each registered writer's own call shape for producing a check_name --
// not every script uses flag(art, 'name', ...); reviews-source-refresh.mjs
// uses flagIssue(slug, 'name', ...), guide-staleness-guard.js references a
// CHECK_NAME constant instead of a literal at the call site. Falls back to
// the flag(...) shape (the most common one) if a file isn't listed here.
const LITERAL_PATTERNS = {
  'reviews-source-refresh.mjs': [/flagIssue\([^,]+,\s*'([a-z_]+)'/g],
  'guide-staleness-guard.js':   [/CHECK_NAME\s*=\s*'([a-z_]+)'/g],
};
const DEFAULT_LITERAL_PATTERN = /flag\([a-zA-Z]+,\s*'([a-z_]+)'/g;

// checkReviewSourceGates (src/lib/review-source-quality.ts) returns dynamic
// checkName values content-linter.mjs re-flags -- these can't be found by
// scanning content-linter.mjs's own source, so they're checked separately.
const KNOWN_DYNAMIC_SOURCES = {
  'content-linter.mjs': {
    file: join(SCRIPTS_DIR, '../src/lib/review-source-quality.ts'),
    pattern: /checkName:\s*'([a-z_]+)'/g,
  },
};

for (const f of registeredFiles) {
  if (!writerFiles.includes(f)) continue; // already warned above
  const owned = new Set(CHECK_NAME_OWNERS[f]);
  const src = readFileSync(writerPaths[f], 'utf-8');

  const patterns = LITERAL_PATTERNS[f] ?? [DEFAULT_LITERAL_PATTERN];
  const literalNames = new Set();
  for (const pattern of patterns) {
    for (const m of src.matchAll(pattern)) literalNames.add(m[1]);
  }

  const dynamicSource = KNOWN_DYNAMIC_SOURCES[f];
  if (dynamicSource) {
    try {
      const dynSrc = readFileSync(dynamicSource.file, 'utf-8');
      for (const m of dynSrc.matchAll(dynamicSource.pattern)) literalNames.add(m[1]);
    } catch (e) {
      console.warn(`  NOTE: could not read known dynamic check_name source for ${f} (${dynamicSource.file}): ${e.message}`);
    }
  }

  for (const name of literalNames) {
    if (RETIRED_CHECK_NAMES.includes(name)) {
      fail(`${f} still produces retired check_name '${name}' (scripts/lib/content-quality-check-ownership.mjs marks it retired -- either un-retire it there or stop producing it).`);
      continue;
    }
    if (!owned.has(name)) {
      fail(`${f} produces check_name '${name}' but it is not declared in CHECK_NAME_OWNERS['${f}']. Add it, or this check_name will be invisible to ${f}'s own reconciliation and vulnerable to being wrongly auto-resolved by a different script's reconcile pass.`);
    }
  }

  // Also flag declared-but-unused names -- likely a retired check that
  // was never removed from the manifest, or a typo. Warning only (not a
  // hard failure): a name can legitimately go quiet for a while (e.g. a
  // check gated behind a condition rarely true) without being wrong.
  for (const name of owned) {
    if (!literalNames.has(name)) {
      console.warn(`  NOTE: ${f} declares '${name}' in CHECK_NAME_OWNERS but no matching flag(...) call was found in its source (checked literally -- a dynamically-constructed check_name won't be caught by this note).`);
    }
  }
}

console.log(failed ? '\ncontent_quality_issues ownership check: FAILED\n' : '\ncontent_quality_issues ownership check: clean ✓\n');
process.exit(failed ? 1 : 0);
