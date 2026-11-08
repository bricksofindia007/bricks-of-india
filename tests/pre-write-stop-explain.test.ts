/**
 * Plain-words hold email (order 0560, permanent fix 3a). explainHold only changes the words of
 * the email. These tests also check that every reason the hold code can produce gets a cause and an action.
 */
import { describe, it, expect } from 'vitest';
import { explainHold, planStoreWrite, feedStats } from '../scripts/lib/pre-write-stop.mjs';

const POLICY_FAIL = ['policy: robots/agents hash or status differs from the approved fingerprint (https://lego.in/agents.md status=200 sha256=9ade98c43cda)'];

describe('explainHold: cause and action in plain words', () => {
  it('a changed rules file says so, and says what to do', () => {
    const h = explainHold('mybrickhouse', POLICY_FAIL, 'lego.in');
    expect(h.cause).toMatch(/rules file changed/);
    expect(h.action).toMatch(/Read the store's new rules file/);
    expect(h.action).toMatch(/reviewed change to the stored approval/);
  });

  it('a far-too-small catalogue points at the approval inputs, with the approve key', () => {
    const h = explainHold('toycra', ['parsed 300 < 90% of approved 664'], 'toycra.com');
    expect(h.cause).toMatch(/far fewer products/);
    expect(h.action).toMatch(/approve_store=toycra\.com/);
    expect(h.action).toMatch(/approve_available=/);
  });

  it('a count mismatch on an approved run says to re-approve with the right number', () => {
    const h = explainHold('toycra', ["approval: this run's available 10 is not within 2% of approved 664"], 'toycra.com');
    expect(h.cause).toMatch(/approved count did not match/);
    expect(h.action).toMatch(/re-approve with the right number/);
  });

  it('an unreadable stored-rows read says to check the connection, and that nothing was written', () => {
    const h = explainHold('toycra', ['could not read stored rows: timeout'], 'toycra.com');
    expect(h.cause).toMatch(/could not be read/);
    expect(h.cause).toMatch(/Nothing was written/);
    expect(h.action).toMatch(/Check the database connection/);
  });

  it('a share or change-rate hold gets the generic cause and the approval action', () => {
    const h = explainHold('toycra', ['available share 40% moved > 25 points from the last approved 96%'], 'toycra.com');
    expect(h.cause).toMatch(/Too many prices or stock levels/);
    expect(h.action).toMatch(/approve one run/);
  });

  it('the subject names the store and says nothing was written', () => {
    const h = explainHold('mybrickhouse', POLICY_FAIL, 'lego.in');
    expect(h.subject).toBe('[BOI] Prices paused for mybrickhouse: nothing was written');
  });

  it('never names internal tools, hashes or file paths in the cause or the action', () => {
    for (const reasons of [POLICY_FAIL, ['parsed 1 < 90% of approved 873'], ['could not read stored rows: x']]) {
      const h = explainHold('mybrickhouse', reasons, 'lego.in');
      const words = `${h.cause} ${h.action}`;
      expect(words).not.toMatch(/sha256|hash|agents\.md|robots\.txt|scrape-now|pre-write/i);
    }
  });
});

describe('explainHold matches the reasons the hold code really produces', () => {
  it('a real policy failure from planStoreWrite is explained as a rules-file change', () => {
    const products = [{ variants: [{ available: true }] }];
    const plan = planStoreWrite({
      baseline: { approve_key: 'lego.in', approved_products: 1, approved_available: 1, policy: [] },
      stats: feedStats(products),
      rows: [],
      storedRows: [],
      policy: { ok: false, results: [{ url: 'https://lego.in/agents.md', status: 200, sha256: 'x', expected: 'y', match: false }] },
      approval: null,
    });
    expect(plan.held).toBe(true);
    const h = explainHold('mybrickhouse', plan.reasons, 'lego.in');
    expect(h.cause).toMatch(/rules file changed/);
  });

  it('a real catalogue-size failure is explained as a catalogue drop', () => {
    const plan = planStoreWrite({
      baseline: { approve_key: 'lego.in', approved_products: 873, approved_available: 842, policy: [] },
      stats: feedStats([{ variants: [{ available: true }] }]),
      rows: [],
      storedRows: [],
      policy: { ok: true, results: [] },
      approval: null,
    });
    expect(plan.held).toBe(true);
    expect(explainHold('mybrickhouse', plan.reasons, 'lego.in').cause).toMatch(/far fewer products/);
  });
});
