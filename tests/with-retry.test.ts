import { describe, it, expect } from 'vitest';
import { withRetry } from '../scripts/ci/with-retry';

// Order 1430 item 2: the review schema check's paged read failed once with a server error and stopped the check.
describe('withRetry (review schema check read)', () => {
  it('returns the first result when the read succeeds', async () => {
    let calls = 0;
    const result = await withRetry(async () => { calls++; return { data: [1], error: null }; }, { sleep: async () => {} });
    expect(result).toEqual({ data: [1], error: null });
    expect(calls).toBe(1);
  });

  it('passes a read that fails once and then succeeds', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      return calls === 1 ? { data: null, error: { message: 'Internal server error.' } } : { data: [2], error: null };
    }, { sleep: async () => {} });
    expect(result.error).toBeNull();
    expect(result.data).toEqual([2]);
    expect(calls).toBe(2);
  });

  it('still fails when every attempt fails, with the last error, after three attempts', async () => {
    let calls = 0;
    const waits: number[] = [];
    const result = await withRetry(async () => { calls++; return { data: null, error: { message: `fail ${calls}` } }; }, {
      delayMs: 100,
      sleep: async (ms) => { waits.push(ms); },
    });
    expect(calls).toBe(3);
    expect(result.error).toEqual({ message: 'fail 3' });
    expect(waits).toEqual([100, 200]);
  });

  it('the schema check reads its sets pages through the retry', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'check-review-schema-integrity.ts'), 'utf8');
    expect(src).toMatch(/await withRetry\(\(\) => sb\s*\n?\s*\.from\('sets'\)/);
  });
});
