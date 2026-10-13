import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// The secrets check must pass on the repository as it stands. It fails the
// code-audit job when a workflow uses a secret the manifest does not declare.
describe('secrets manifest audit', () => {
  it('passes on the repository', () => {
    const script = resolve(__dirname, '../scripts/audit-secrets-manifest.mjs');
    const out = execFileSync(process.execPath, [script], { encoding: 'utf8', cwd: resolve(__dirname, '..') });
    expect(out).toContain('Secrets manifest audit passed');
  });
});
