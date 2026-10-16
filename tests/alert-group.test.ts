import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { heldNotice } from '../scripts/lib/alert-group.mjs';

const RUN = 'https://github.com/bricksofindia007/bricks-of-india/actions/runs/1';

describe('held notice', () => {
  const held = [
    { name: 'LEGO.in', id: 'mybrickhouse', domain: 'lego.in', path: '/products.json', reasons: ['policy: changed'] },
    { name: 'Toycra', id: 'toycra', domain: 'toycra.com', path: '/collections/lego/products.json', reasons: ['policy: changed'] },
  ];

  it('is one notice naming every held store', () => {
    const m = heldNotice(held, RUN);
    expect(m.subject).toBe('[BOI] Scrape held: LEGO.in, Toycra (nothing written)');
    expect(m.body).toContain('Held in this run: 2 store(s).');
    expect(m.body).toContain('Store: LEGO.in (mybrickhouse)');
    expect(m.body).toContain('Store: Toycra (toycra)');
  });

  it('says held, not failed', () => {
    const m = heldNotice(held, RUN);
    expect(m.subject.toLowerCase()).not.toContain('fail');
    expect(m.body.toLowerCase()).not.toContain('fail');
  });

  it('names the run and carries no token or key text', () => {
    const m = heldNotice(held, RUN);
    expect(m.body).toContain(RUN);
    expect(m.body.toLowerCase()).not.toMatch(/token|secret|key=|bearer/);
  });
});

describe('scrape workflow: held is a notice, not a failure', () => {
  const wf = readFileSync(resolve(__dirname, '../.github/workflows/scrape-prices.yml'), 'utf8');

  it('the final pass/fail step does not exit 1 for a held store', () => {
    const start = wf.indexOf('held this run');
    expect(start).toBeGreaterThan(-1);
    const block = wf.slice(wf.lastIndexOf('if [ -n "${{ steps.scrape.outputs.held_stores', start), start + 200);
    expect(block).not.toContain('exit 1');
  });

  it('a scrape or freshness failure still fails the job', () => {
    expect(wf).toContain('if [ "${{ steps.scrape.outcome }}" = "failure" ] || [ "${{ steps.freshness.outcome }}" = "failure" ]; then');
  });
});
