import { describe, it, expect } from 'vitest';
import { formatHardRuleFailures, ruleA3_bannedLlmTells } from '../src/lib/hard-rules';

describe('formatHardRuleFailures (round 11a: gate 7 logs what matched)', () => {
  it('includes the matched phrase for a failed rule', () => {
    const r = ruleA3_bannedLlmTells('At the time of writing, this set is in stock.');
    expect(formatHardRuleFailures([r])).toEqual(['gate7:A3_banned_llm_tells (banned phrase: "at the time of writing")']);
  });

  it('skips passing rules and falls back to the id when there is no reason', () => {
    expect(formatHardRuleFailures([{ id: 'A1', pass: true }, { id: 'A6_sign_off', pass: false }])).toEqual(['gate7:A6_sign_off']);
  });
});
