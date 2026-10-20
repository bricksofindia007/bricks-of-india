import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHECKER = join(process.cwd(), 'scripts', 'ci', 'npm-audit-check.mjs');
const ROOT = 'GHSA-vfj7-8cjw-p6xm'; // accepted in .github/npm-audit-accepted.json (build-time, docs/security/npm-audit-exception-2026-10-20.md)

const advisory = (id: string, pkg: string, severity: string) => ({
  source: 1, name: pkg, dependency: pkg, title: `${pkg} advisory`, url: `https://github.com/advisories/${id}`,
  severity, range: '<=99.0.0',
});

function run(vulns: Record<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), 'npm-audit-'));
  const file = join(dir, 'audit.json');
  writeFileSync(file, JSON.stringify({ vulnerabilities: vulns, metadata: {} }));
  return spawnSync(process.execPath, [CHECKER], {
    encoding: 'utf8',
    env: { ...process.env, NPM_AUDIT_JSON_FILE: file },
  });
}

describe('npm audit check (accepted-list wiring)', () => {
  it('passes when the only high advisory is the accepted build-time one', () => {
    const r = run({
      braces: { severity: 'high', via: [advisory(ROOT, 'braces', 'high')] },
      micromatch: { severity: 'high', via: ['braces'] },
      tailwindcss: { severity: 'high', via: ['micromatch'] },
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('all accepted');
  });

  it('FAILS when a NEW high advisory appears alongside the accepted one', () => {
    const FAKE = 'GHSA-test-fake-0000-0001';
    const r = run({
      braces: { severity: 'high', via: [advisory(ROOT, 'braces', 'high')] },
      'fake-new-dep': { severity: 'high', via: [advisory(FAKE, 'fake-new-dep', 'high')] },
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(new RegExp(`NEW\\s+high\\s+${FAKE}`));
    expect(r.stderr).toContain('1 new high/critical npm advisory(ies) not in the accepted list');
  });

  it('FAILS on a NEW critical advisory', () => {
    const FAKE = 'GHSA-test-fake-0000-0002';
    const r = run({ 'fake-critical': { severity: 'critical', via: [advisory(FAKE, 'fake-critical', 'critical')] } });
    expect(r.status).toBe(1);
  });

  it('ignores moderate advisories (high/critical only)', () => {
    const r = run({ 'fake-moderate': { severity: 'moderate', via: [advisory('GHSA-test-fake-0000-0003', 'fake-moderate', 'moderate')] } });
    expect(r.status).toBe(0);
  });
});
