import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Static checks on the scrape job's failure alert. The alert must fire when the
// IndexNow step fails, and the email must name that step.
const workflow = readFileSync(resolve(__dirname, '../.github/workflows/scrape-prices.yml'), 'utf8');

function stepBlock(name: string): string {
  const start = workflow.indexOf(`- name: ${name}`);
  expect(start, `step "${name}" exists`).toBeGreaterThan(-1);
  const next = workflow.indexOf('\n      - name:', start + 1);
  return workflow.slice(start, next === -1 ? undefined : next);
}

describe('scrape-prices failure alert covers the IndexNow step', () => {
  it('the IndexNow step has an id the alert can read', () => {
    expect(stepBlock('Sync new/changed sets to IndexNow')).toMatch(/\n\s+id: indexnow\n/);
  });

  it('the alert fires when the IndexNow step fails', () => {
    const alert = stepBlock('Send failure alert');
    expect(alert).toMatch(/if: steps\.scrape\.outcome == 'failure' \|\| steps\.freshness\.outcome == 'failure' \|\| steps\.indexnow\.outcome == 'failure'/);
  });

  it('the alert email names the IndexNow step with its outcome', () => {
    const alert = stepBlock('Send failure alert');
    expect(alert).toContain('"Sync new/changed sets to IndexNow": "${{ steps.indexnow.outcome }}"');
  });

  it('the existing scrape and freshness conditions are unchanged', () => {
    const alert = stepBlock('Send failure alert');
    expect(alert).toContain('"Run Shopify scraper": "${{ steps.scrape.outcome }}"');
    expect(alert).toContain('"Check price freshness": "${{ steps.freshness.outcome }}"');
  });

  it('the final pass/fail step still makes the job fail on scrape or freshness failure', () => {
    const final = stepBlock('Fail job if scrape or freshness failed, or a store was held');
    expect(final).toContain('steps.scrape.outcome }}" = "failure"');
    expect(final).toContain('steps.freshness.outcome }}" = "failure"');
  });
});
