// Order 1953 decision 3: openings vary within a batch. The uniqueness threshold and the approved opener lines stay as they are.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSystemPrompt, BATCH_OPENING_SHAPES, VOICE_EXAMPLES } from '../src/lib/prompts/draft-prompt';
import { RECENT_OPENERS_WINDOW, reusedOpener, openingSentence } from '../src/lib/opener-pattern';

// Guide drafts go through the same generator as news and reviews. Providers and the DB-backed lint are faked here;
// the test reads the system prompt the generator actually sends.
const sent: string[] = [];
let reply = '';
vi.mock('../src/lib/providers', () => {
  class Fake { name = 'gemini'; async call({ systemPrompt }: { systemPrompt: string }) { sent.push(systemPrompt); return { text: reply }; } }
  return { GeminiProvider: Fake, GroqProvider: Fake, CerebrasProvider: Fake };
});
vi.mock('../src/lib/lint', () => {
  const ok = { pass: true, severity: 'ok' };
  return { lintDraft: async () => ({ overallPass: true, warnings: [], gates: { wordCount: ok, indiaParagraph: ok, verdict: ok, factuality: ok, sourceFidelity: ok, openerUniqueness: ok, duplicateContent: ok, citationIdentity: ok, openerPattern: ok, affiliateDisclosure: ok } }) };
});
const { generateWithFailover } = await import('../src/lib/generate-with-failover');
const guideReply = `--- BOI_DRAFT_START ---\nFORMAT: guide\nTITLE: Best LEGO sets for a budget in India\nBODY:\nA short guide body for the test. It says nothing about any set.\n--- BOI_DRAFT_END ---`;
const guideInput = { format: 'guide', sourceTitle: 'Budget LEGO guide', sourceUrl: 'https://example.test/guide', sourceExcerpt: null, indiaPriceContext: 'P' };

describe('buildSystemPrompt batch variety', () => {
  it('with no earlier openings the prompt is unchanged', () => {
    expect(buildSystemPrompt([])).toBe(buildSystemPrompt());
    expect(buildSystemPrompt(['   '])).toBe(buildSystemPrompt());
  });

  it('lists earlier openings and asks for a different one', () => {
    const p = buildSystemPrompt(['Your wallet is already nervous about this one.']);
    expect(p).toContain('BATCH VARIETY');
    expect(p).toContain('"Your wallet is already nervous about this one."');
    expect(p).toContain('Do not open with any of them');
    expect(p.startsWith(VOICE_EXAMPLES)).toBe(true);
  });

  it('gives consecutive drafts different hook shapes, rotated by position', () => {
    const shapes = [1, 2, 3, 4].map((n) => {
      const openers = Array.from({ length: n }, (_, i) => `Opening sentence number ${i} is here.`);
      const p = buildSystemPrompt(openers);
      return BATCH_OPENING_SHAPES.find((s) => p.includes(`open with ${s}`));
    });
    expect(shapes.every(Boolean)).toBe(true);
    expect(new Set(shapes).size).toBe(BATCH_OPENING_SHAPES.length);
  });

  it('keeps the wallet lines allowed in the opener', () => {
    const p = buildSystemPrompt(['A first opener.']);
    expect(p).toContain('wallet lines are still welcome');
  });
});

describe('guide drafts get the earlier openings of the same run', () => {
  beforeEach(() => { sent.length = 0; reply = guideReply; });

  it('a guide draft gets the earlier openings of the same run', async () => {
    const earlier = 'Your wallet already knows this one is a keeper. More text follows here.';
    await generateWithFailover(guideInput as any, {} as any, 'k', undefined, undefined, [earlier]);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent[0]).toContain('BATCH VARIETY');
    expect(sent[0]).toContain('"Your wallet already knows this one is a keeper."');
    expect(sent[0]).toContain('Do not open with any of them');
  });

  it('a guide draft with no earlier openings gets the unchanged prompt', async () => {
    await generateWithFailover(guideInput as any, {} as any, 'k', undefined, undefined, []);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent[0]).not.toContain('BATCH VARIETY');
    expect(sent[0]).toBe(buildSystemPrompt());
  });
});

describe('opener uniqueness is unchanged', () => {
  it('still compares against the last 10 published articles', () => {
    expect(RECENT_OPENERS_WINDOW).toBe(10);
  });

  it('still flags a reused opening sentence and ignores digits and case', () => {
    const recent = ['Price just dropped to 4999 for this set. Read on.'];
    expect(reusedOpener('PRICE just dropped to 1234 for this set. New text.', recent)).not.toBeNull();
    expect(reusedOpener('A completely different first line here. More.', recent)).toBeNull();
    expect(openingSentence('<!-- x -->Hello there, friend. Rest.')).toBe('Hello there, friend.');
  });
});
