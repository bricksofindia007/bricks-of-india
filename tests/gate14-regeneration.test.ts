import { describe, it, expect, vi, beforeEach } from 'vitest';

// #398 1b: Gate 14 joins the shared Gates 11-13 regeneration. Providers and the
// DB-backed lint are faked; gate14Check and the retry logic are real.
const calls: string[] = [];
let replies: string[] = [];
vi.mock('../src/lib/providers', () => {
  class Fake { name = 'gemini'; async call({ userPrompt }: { userPrompt: string }) { calls.push(userPrompt); return { text: replies.shift()! }; } }
  return { GeminiProvider: Fake, GroqProvider: Fake, CerebrasProvider: Fake };
});
vi.mock('../src/lib/lint', () => {
  const ok = { pass: true, severity: 'ok' };
  return { lintDraft: async () => ({ overallPass: true, warnings: [], gates: { wordCount: ok, indiaParagraph: ok, verdict: ok, factuality: ok, sourceFidelity: ok, openerUniqueness: ok, duplicateContent: ok, citationIdentity: ok, openerPattern: ok, affiliateDisclosure: ok } }) };
});

const { generateWithFailover } = await import('../src/lib/generate-with-failover');
const draft = (pieces: string) => `--- BOI_DRAFT_START ---\nFORMAT: review\nTITLE: Lion Knights' Castle review\nVERDICT: WAIT\nBODY:\nThis castle has ${pieces} pieces and it is big.\n\nVerdict: WAIT\n--- BOI_DRAFT_END ---`;
const facts = { setNumber: '10305', name: "Lion Knights' Castle", pieces: 4514, minifigs: 22, year: 2022, prices: [], mrp: [], verdict: null };
const input = (enforce: boolean) => ({ format: 'review', sourceTitle: 't', sourceUrl: 'https://x/y', sourceExcerpt: null, indiaPriceContext: 'P', gate14: { facts, enforce } });

describe('Gate 14 in the shared regeneration (#398 1b)', () => {
  beforeEach(() => { calls.length = 0; });

  it('shadow: findings reported, no regeneration, lint untouched', async () => {
    replies = [draft('6,000')];
    const o = await generateWithFailover(input(false) as any, {} as any, 'k', undefined, undefined);
    expect(calls.length).toBe(1);
    expect(o.gate14).toMatchObject({ enforce: false });
    expect(o.gate14!.findings.map((x) => x.rule)).toEqual(['pieces']);
    expect(o.lintResult!.overallPass).toBe(true);
  });

  it('enforce: one regeneration with Gate 14 feedback; a corrected draft passes', async () => {
    replies = [draft('6,000'), draft('4,514')];
    const o = await generateWithFailover(input(true) as any, {} as any, 'k', undefined, undefined);
    expect(calls.length).toBe(2);
    expect(calls[1]).toContain('REVISION REQUIRED: Gate 14 (fact check) failed');
    expect(calls[1]).toContain('catalogue 4514');
    expect(o.gate14!.findings).toEqual([]);
    expect(o.lintResult!.overallPass).toBe(true);
    expect(o.body).toContain('4,514 pieces');
  });

  it('enforce: still wrong after the one regeneration -> lint fails by name (reject path)', async () => {
    replies = [draft('6,000'), draft('7,000')];
    const o = await generateWithFailover(input(true) as any, {} as any, 'k', undefined, undefined);
    expect(calls.length).toBe(2);
    expect(o.lintResult!.overallPass).toBe(false);
    expect(o.lintResult!.gates.gate14).toMatchObject({ pass: false, severity: 'fail' });
    expect(o.lintResult!.gates.gate14!.reason).toContain('[pieces]');
  });

  it('news runs Gate 14 too since round 11 (4 Oct 2026)', async () => {
    replies = [draft('6,000').replace('FORMAT: review', 'FORMAT: news'), draft('7,000').replace('FORMAT: review', 'FORMAT: news')];
    const o = await generateWithFailover({ ...input(true), format: 'news' } as any, {} as any, 'k', undefined, undefined);
    expect(calls.length).toBe(2);
    expect(o.gate14!.findings.map((x) => x.rule)).toContain('pieces');
  });

  it('opinion and guide formats never run Gate 14', async () => {
    replies = [draft('6,000').replace('FORMAT: review', 'FORMAT: opinion')];
    const o = await generateWithFailover({ ...input(true), format: 'opinion' } as any, {} as any, 'k', undefined, undefined);
    expect(calls.length).toBe(1);
    expect(o.gate14!.findings).toEqual([]);
  });
});
