// Regression: scripts/morning-brief.mjs used waitingCutoffIso, knownIssueRows and WAITING_DAYS without importing them
// (ReferenceError at line 140, failing every run from 10 Nov 2026). The script runs on load, so this checks its source:
// every helper it uses must be imported from the known-issues module, and that module must export it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as knownIssues from '../scripts/lib/brief-known-issues.mjs';

const root = join(__dirname, '..');
const src = readFileSync(join(root, 'scripts/morning-brief.mjs'), 'utf8');
const HELPERS = ['waitingCutoffIso', 'knownIssueRows', 'WAITING_DAYS'] as const;

describe('morning brief imports its known-issues helpers', () => {
  const importLine = src.match(/^import \{([^}]*)\} from '\.\/lib\/brief-known-issues\.mjs';$/m);

  it('imports from ./lib/brief-known-issues.mjs', () => {
    expect(importLine).not.toBeNull();
  });

  for (const name of HELPERS) {
    it(`imports ${name}, and the module exports it`, () => {
      const imported = (importLine?.[1] ?? '').split(',').map((s) => s.trim());
      expect(imported).toContain(name);
      expect(knownIssues).toHaveProperty(name);
    });
  }

  it('uses each helper only after the import (no bare use without it)', () => {
    for (const name of HELPERS) {
      const uses = src.split(new RegExp(`\\b${name}\\b`)).length - 1;
      expect(uses).toBeGreaterThan(1); // the import line plus at least one use
    }
  });
});
