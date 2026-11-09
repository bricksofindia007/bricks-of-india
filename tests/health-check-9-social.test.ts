// Check 9 (cron freshness) judges the weekly social workflow against the same 192-hour limit that Checks 6 and 6c use
// for their attempt age. The workflow runs Mondays 12:00 IST, so 26 hours would alert on every week.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const src = readFileSync(join(root, 'scripts/health-check.mjs'), 'utf8');
const cron = readFileSync(join(root, '.github/workflows/social-automation.yml'), 'utf8');

const entry = (file: string) => {
  const line = src.split('\n').find((l) => l.includes(`file: '${file}'`));
  if (!line) throw new Error(`no Check 9 entry for ${file}`);
  return Number(line.match(/maxAgeHours: (\d+)/)?.[1]);
};

describe('Check 9 social limit', () => {
  it('the workflow still runs once a week, on Monday', () => {
    expect(cron).toMatch(/cron: '30 6 \* \* 1'/);
  });
  it('the social-automation entry uses the same 192-hour limit as Checks 6 and 6c', () => {
    expect(entry('social-automation.yml')).toBe(7 * 24 + 24);
    expect(src).toMatch(/const SOCIAL_ATTEMPT_MAX_HOURS = 7 \* 24 \+ 24;/);
  });
  it('the other Check 9 entries are unchanged', () => {
    expect(entry('radar.yml')).toBe(26);
    expect(entry('scrape-prices.yml')).toBe(26);
    expect(entry('generate-drafts.yml')).toBe(26);
    expect(entry('ig-token-refresh.yml')).toBe(432);
    expect(entry('cleanup-published-assets.yml')).toBe(194);
  });
});
