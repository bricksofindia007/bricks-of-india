// G19 (CLAUDE.md, 1 Oct 2026): the gate logic, on a synthetic term list (the real list is the
// G19_TERMS secret and never appears in the repo).
import { describe, it, expect, afterEach } from 'vitest';
import { g19Hits, g19PromptRule, resetG19ForTests, G19_PROMPT_FALLBACK } from '../src/lib/g19';

const set = (v: unknown) => { process.env.G19_TERMS = v === undefined ? '' : JSON.stringify(v); resetG19ForTests(); };
const ORIGINAL = process.env.G19_TERMS;
afterEach(() => { process.env.G19_TERMS = ORIGINAL; resetG19ForTests(); });

describe('G19 gate logic', () => {
  it('flags a sentence with a listed term and reports only category + index', () => {
    set({ terms: { a: ['\\bzorblax\\b'], b: ['quux\\s+frob'] }, allow: [] });
    expect(g19Hits('Fine sentence. We zorblax the data. Quux  frob here.')).toEqual([{ category: 'a', index: 1 }, { category: 'b', index: 2 }]);
  });
  it('allowed phrases are removed before matching', () => {
    set({ terms: { a: ['\\bzorblax\\b'] }, allow: ['zorblax belongs to us'] });
    expect(g19Hits('Zorblax belongs to us.')).toEqual([]);
  });
  it('returns null (callers fail closed) when the secret is missing or broken', () => {
    set(undefined);
    expect(g19Hits('anything')).toBeNull();
    process.env.G19_TERMS = '{not json'; resetG19ForTests();
    expect(g19Hits('anything')).toBeNull();
  });
  it('prompt rule comes from the secret, else a generic fallback', () => {
    set({ terms: { a: ['x'] }, allow: [], prompt_rule: 'RULE FROM SECRET' });
    expect(g19PromptRule()).toBe('RULE FROM SECRET');
    set(undefined);
    expect(g19PromptRule()).toBe(G19_PROMPT_FALLBACK);
  });
  it('a BOM in the secret is ignored', () => {
    process.env.G19_TERMS = '﻿' + JSON.stringify({ terms: { a: ['zorblax'] }, allow: [] }); resetG19ForTests();
    expect(g19Hits('zorblax')).toEqual([{ category: 'a', index: 0 }]);
  });
});
