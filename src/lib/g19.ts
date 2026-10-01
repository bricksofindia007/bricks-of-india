// G19 (CLAUDE.md, 1 Oct 2026): nothing public may reveal how Bricks of India works.
// The term list is NOT in the repo (A3, 1 Oct 2026): it lives in the G19_TERMS secret
// (GitHub Actions; JSON {terms: {category: [regex]}, allow: [regex], prompt_rule}) and is
// read at run time. Hits never carry the matched term, so logs don't rebuild the list.

export type G19Hit = { category: string; index: number };
type Cfg = { terms: [string, RegExp][]; allow: RegExp[]; rule: string | null };

/** Prompt rule used when the secret isn't present (tests, local runs). */
export const G19_PROMPT_FALLBACK =
  'NEVER describe how Bricks of India works or is run. Say what the reader gets ("Toycra has it at ₹X"), never how we get it.';

let cached: Cfg | null | undefined;
function load(): Cfg | null {
  if (cached !== undefined) return cached;
  const raw = (process.env.G19_TERMS ?? '').replace(/^﻿/, '').trim();
  try {
    const c = raw ? JSON.parse(raw) : null;
    cached = c && c.terms ? {
      terms: Object.entries(c.terms as Record<string, string[]>).flatMap(([cat, ps]) => ps.map((p): [string, RegExp] => [cat, new RegExp(p, 'i')])),
      allow: ((c.allow ?? []) as string[]).map((p) => new RegExp(p, 'gi')),
      rule: typeof c.prompt_rule === 'string' ? c.prompt_rule : null,
    } : null;
  } catch { cached = null; }
  return cached;
}

/** Test hook: forget the cached list so a changed G19_TERMS is re-read. */
export function resetG19ForTests(): void { cached = undefined; }

export const g19Configured = (): boolean => load() !== null;

/** Sentences of `text` that describe how the site works, or null when the list isn't configured. */
export function g19Hits(text: string): G19Hit[] | null {
  const cfg = load();
  if (!cfg) return null;
  const hits: G19Hit[] = [];
  text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean).forEach((raw, index) => {
    const s = cfg.allow.reduce((acc, re) => acc.replace(re, ' '), raw);
    const t = cfg.terms.find(([, re]) => re.test(s));
    if (t) hits.push({ category: t[0], index });
  });
  return hits;
}

/** The rule text every content-generation prompt carries. */
export const g19PromptRule = (): string => load()?.rule ?? G19_PROMPT_FALLBACK;
