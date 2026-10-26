// The db-migrate workflow has a target input. Its default keeps today's behaviour (both jobs run). With staging, the
// production job is skipped. The staging job is unchanged.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const wf = readFileSync(join(root, '.github/workflows/db-migrate.yml'), 'utf8');

const jobBlock = (name: string) => {
  const start = wf.indexOf(`\n  ${name}:\n`);
  const next = wf.indexOf('\n  ', start + 1);
  const after = wf.slice(start + 1).search(/\n  [a-z-]+:\n/);
  return start < 0 ? '' : wf.slice(start, after < 0 ? undefined : start + 1 + after);
};

describe('db-migrate target input', () => {
  it('the target input has two choices, both (the default) and staging', () => {
    expect(wf).toMatch(/\n      target:\n        description: '[^\n]*'\n        type: choice\n        options: \[both, staging\]\n        default: both\n/);
  });
  it('the production job is skipped when the target is staging, and runs as before otherwise', () => {
    expect(jobBlock('production')).toMatch(/if: github\.ref == 'refs\/heads\/main' && inputs\.target != 'staging'/);
  });
  it('the staging job has no target condition and is unchanged', () => {
    const staging = jobBlock('staging');
    expect(staging).toMatch(/if: github\.ref == 'refs\/heads\/main'\n/);
    expect(staging).not.toMatch(/inputs\.target/);
    expect(staging).toMatch(/environment: staging-migrations/);
  });
  it('the other inputs keep their defaults', () => {
    expect(wf).toMatch(/mode:[\s\S]*?default: plan/);
    expect(wf).toMatch(/scope:[\s\S]*?default: all/);
    expect(wf).toMatch(/fixes:[\s\S]*?default: ''/);
  });
  it('the production job still needs staging', () => {
    expect(jobBlock('production')).toMatch(/needs: staging/);
  });
});
