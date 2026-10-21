import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The social fallback posts publicly, so its switch must be off in the production config this change ships with.
const cfg = readFileSync(resolve(__dirname, '../workers/boi-scheduler/wrangler.jsonc'), 'utf8');

describe('boi-scheduler social fallback switch', () => {
  it('ships with SOCIAL_DISPATCH_ENABLED set to "false" in production', () => {
    expect(cfg).toMatch(/"SOCIAL_DISPATCH_ENABLED":\s*"false"/);
    expect(cfg).not.toMatch(/"SOCIAL_DISPATCH_ENABLED":\s*"true"/);
  });

  it('has the Monday social cron only as an addition to the daily scrape crons', () => {
    expect(cfg).toMatch(/"crons":\s*\["0 3 \* \* \*", "5 3 \* \* \*", "30 6 \* \* 1"\]/);
  });
});
