import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Automated comments on public issues and PRs say only what changed, in plain words.
const read = (f: string) => readFileSync(resolve(__dirname, '../.github/workflows', f), 'utf8');
const FORBIDDEN = ['lego_mrp_inr', 'netlify', 'CREDITS_USED', 'COMMIT_COUNT', 'TIER2_BUDGET', 'evidence-production', 'db-migrate evidence', 'RUN_URL)', 'github.run_id'];

describe('public comments carry no internal detail', () => {
  it('db-migrate comment is plain', () => {
    const t = read('db-migrate.yml');
    const line = t.split('\n').find(l => l.includes('> comment.md')) ?? '';
    expect(line).toBe('          echo "Database update applied." > comment.md');
    expect(line).not.toMatch(/evidence|run|table/);
  });

  it('catalogue-audit comment has no field name or run id', () => {
    const line = read('catalogue-audit.yml').split('\n').find(l => l.includes('Still failing as of')) ?? '';
    expect(line).not.toMatch(/lego_mrp_inr|github\.run_id|run log/);
  });

  it('credit-budget comments carry no counts, tool or config names', () => {
    const t = read('credit-budget-check.yml');
    const bodies = t.split('\n').filter(l => /COMMENT_BODY=/.test(l));
    expect(bodies.length).toBe(2);
    for (const b of bodies) for (const bad of FORBIDDEN) expect(b).not.toContain(bad);
  });

  it('credit-budget dedupe markers are still present', () => {
    const t = read('credit-budget-check.yml');
    expect(t).toContain('MARKER="EXCEEDED"');
    expect(t).toContain('MARKER="80% of Tier 2"');
    expect(t).toMatch(/contains\(\$c\)/);
    expect(t).toContain('\$CYCLE_START');
  });
});
