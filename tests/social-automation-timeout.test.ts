import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

// Order 0970: the social post job runs its package install and pipeline in one job. The 2 Nov run was cancelled at its
// 18-minute limit, so the post job's limit is 30 minutes. Every job still needs an explicit timeout (lint-workflows).
const doc = parseYaml(readFileSync(join(__dirname, '..', '.github/workflows/social-automation.yml'), 'utf8'));

describe('social automation timeouts (order 0970)', () => {
  it('the post job allows 30 minutes', () => {
    expect(doc.jobs.post['timeout-minutes']).toBe(30);
  });

  it('every job that runs steps has its own timeout, none left to the 6-hour default', () => {
    // A job that calls a reusable workflow (uses:) takes no timeout-minutes of its own; the called workflow sets its jobs.
    for (const [name, job] of Object.entries<Record<string, unknown>>(doc.jobs)) {
      if (job.uses) continue;
      expect(job['timeout-minutes'], name).toEqual(expect.any(Number));
    }
  });
});
