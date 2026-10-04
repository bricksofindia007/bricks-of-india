import { describe, it, expect } from 'vitest';
import { rejectedDraftsFilter, REJECTED_PREFIXES, KEEP_FROM } from '../scripts/lib/rejected-drafts.mjs';

function recorder() {
  const calls: [string, ...unknown[]][] = [];
  const q: any = new Proxy({}, { get: (_t, name: string) => (...args: unknown[]) => { calls.push([name, ...args]); return q; } });
  return { q, calls };
}

describe('#525 rejected drafts purge filter', () => {
  it('matches only gate/provider rejections written since the rule shipped, older than the cutoff', () => {
    const { q, calls } = recorder();
    rejectedDraftsFilter(q, '2026-11-03T00:00:00Z');
    expect(calls).toEqual([
      ['eq', 'status', 'rejected'],
      ['or', 'discard_reason.like.rejected_by_gates:*,discard_reason.like.both_providers_failed:*'],
      ['gte', 'updated_at', KEEP_FROM],
      ['lt', 'updated_at', '2026-11-03T00:00:00Z'],
    ]);
  });
  it('the generator writes the prefix the purge looks for', async () => {
    const src = (await import('node:fs')).readFileSync('scripts/generate-approved-drafts.ts', 'utf8');
    expect(src).toContain(`const REJECTED_BY_GATES = '${REJECTED_PREFIXES[0]} '`);
    expect(src).toContain('`both_providers_failed: ${reasonForLog}`');
    expect(src).not.toMatch(/from\('pending_drafts'\)\.delete\(\)/);
  });
});
