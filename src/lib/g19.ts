// G19 (CLAUDE.md, 1 Oct 2026): nothing public may reveal how Bricks of India works.
// One term list (config/g19-terms.json) shared by the CI public-text check, this
// lint gate helper, and the Python video/caption gates.
import config from '../../config/g19-terms.json';

export type G19Hit = { category: string; term: string; sentence: string };

const TERMS: [string, RegExp][] = Object.entries(config.terms as Record<string, string[]>)
  .flatMap(([cat, pats]) => pats.map((p): [string, RegExp] => [cat, new RegExp(p, 'i')]));
const ALLOW: RegExp[] = (config.allow as string[]).map((p) => new RegExp(p, 'gi'));

/** Sentences of `text` that contain a G19 term (allowed phrases removed first). */
export function g19Hits(text: string): G19Hit[] {
  const hits: G19Hit[] = [];
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  for (const raw of sentences) {
    const s = ALLOW.reduce((acc, re) => acc.replace(re, ' '), raw);
    for (const [category, re] of TERMS) {
      const m = re.exec(s);
      if (m) { hits.push({ category, term: m[0], sentence: raw.slice(0, 200) }); break; }
    }
  }
  return hits;
}

/** The rule text every content-generation prompt carries. */
export const G19_PROMPT_RULE =
  'NEVER describe how Bricks of India works. Do not mention scraping, scrapers, bots, feeds, APIs, Shopify, ' +
  'how often prices update (no "every 6 hours", "daily", "real-time"), automation, AI or language models, ' +
  'model or provider names, pipelines, quality gates, pricing formulas, MRP anchor rules or which store sets the MRP, ' +
  'rate limits, infrastructure, or internal tools. Say what the reader gets ("Toycra has it at ₹X"), never how we get it.';
