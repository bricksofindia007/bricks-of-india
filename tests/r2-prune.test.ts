import { describe, it, expect } from 'vitest';
import { planRules } from '../scripts/ci/r2-prune-builds.mjs';

describe('R2 prune (P8 item 6)', () => {
  const existing = [
    { id: 'Default Multipart Abort Rule', enabled: true },
    { id: 'incremental-cache-30d', enabled: true, conditions: { prefix: 'incremental-cache/' } },
    { id: 'prune-OLDER', enabled: true },
  ];
  it('keeps current + previous, prunes the rest, keeps unmanaged rules (30-day backstop stays)', () => {
    const p = planRules(existing, ['CUR', 'PREV', 'OLD1', 'OLD2'], 'CUR', 'PREV');
    expect(p.kept.sort()).toEqual(['CUR', 'PREV']);
    expect(p.pruned.sort()).toEqual(['OLD1', 'OLD2']);
    expect(p.rules.map((r: any) => r.id)).toEqual(['Default Multipart Abort Rule', 'incremental-cache-30d', 'prune-OLD1', 'prune-OLD2']);
    const r = p.rules.find((x: any) => x.id === 'prune-OLD1');
    expect(r.conditions.prefix).toBe('incremental-cache/OLD1/');
    expect(r.deleteObjectsTransition.condition).toEqual({ type: 'Age', maxAge: 86400 });
  });
  it('never prunes the current build, even when it has no objects yet', () => {
    const p = planRules(existing, ['PREV', 'OLD1'], 'CUR', 'PREV');
    expect(p.pruned).toEqual(['OLD1']);
  });
});
