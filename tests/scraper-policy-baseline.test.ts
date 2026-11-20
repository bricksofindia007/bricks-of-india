import { describe, it, expect } from 'vitest';
import { expectedPolicy, checkPolicy, sha256 } from '../scripts/lib/scraper-contract.mjs';

// Order 0890 item 10: the policy check must compare against the APPROVED baseline, not a stale stores row.
const robotsBody = 'User-agent: *\nAllow: /\n';
const agentsBody = 'Bot policy: see the contact page.\n';

const baselines = {
  toycra: {
    policy: [
      { url: 'https://toycra.example/robots.txt', sha256: sha256(robotsBody) },
      { url: 'https://toycra.example/agents.md', sha256: sha256(agentsBody) },
    ],
  },
};

const get = async (url: string) => {
  const body = url.endsWith('/robots.txt') ? robotsBody : agentsBody;
  return { ok: true, text: async () => body };
};

describe('policy check uses the approved baseline (item 10)', () => {
  it('takes the hashes from the approved baseline, not from the stores row', () => {
    const stale = { robots_sha256: 'stale-row-hash', agents_sha256: null };
    const e = expectedPolicy('toycra', stale, baselines);
    expect(e.robots_sha256).toBe(sha256(robotsBody));
    expect(e.agents_sha256).toBe(sha256(agentsBody));
  });

  it('a live policy equal to the approved baseline is not reported as changed, even when the stores row is stale', async () => {
    const expected = expectedPolicy('toycra', { robots_sha256: 'stale-row-hash', agents_sha256: null }, baselines);
    const r = await checkPolicy('toycra.example', expected, get);
    expect(r.ok).toBe(true);
    expect(r.changed).toEqual([]);
  });

  it('a real change to the live file is still reported', async () => {
    const expected = expectedPolicy('toycra', {}, baselines);
    const changedGet = async () => ({ ok: true, text: async () => 'a different file\n' });
    const r = await checkPolicy('toycra.example', expected, changedGet);
    expect(r.ok).toBe(false);
    expect(r.changed).toEqual(expect.arrayContaining(['robots_sha256', 'agents_sha256']));
  });

  it('a store with no baseline entry falls back to the stores row (unchanged behaviour)', () => {
    const row = { robots_sha256: 'row-r', agents_sha256: 'row-a' };
    expect(expectedPolicy('some-other-store', row, baselines)).toEqual({ robots_sha256: 'row-r', agents_sha256: 'row-a' });
    expect(expectedPolicy('some-other-store', null, baselines)).toEqual({ robots_sha256: null, agents_sha256: null });
  });
});
