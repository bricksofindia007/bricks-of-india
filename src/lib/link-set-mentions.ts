// GEO-05b: auto-link the first mention of each distinct set number in an
// article body to its current /sets/[slug] page.
//
// Conceptually "Gate 10" in the generation pipeline's numbering convention
// (see docs/BOI_MASTER_TRACKER.md HIGH-51), but it does not live inside
// LintResult.gates in lint.ts -- every other gate is a pure pass/fail
// validator over a fixed body; this one mutates the body (inserting
// markdown links) and can never fail a draft. Forcing a content
// transformation into a type built entirely around pass/fail booleans
// would be misleading to every future reader of that type, so it's its
// own function, called once from publish-draft.ts right before the body
// is written.
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractSetNumberCandidates } from './lint';
import { canonicalSetSlug, nameMatchesText } from './set-identity';

export type LinkedMention = { setNumber: string; setSlug: string };

export async function linkFirstSetMentions(
  body: string,
  supabase: SupabaseClient,
): Promise<{ content: string; linked: LinkedMention[]; skipped: string[] }> {
  const candidates = extractSetNumberCandidates(body);
  if (candidates.length === 0) return { content: body, linked: [], skipped: [] };

  const { data } = await supabase.from('sets').select('set_number, name').in('set_number', candidates);
  const nameByNumber = new Map((data ?? []).map((s: { set_number: string; name: string }) => [s.set_number, s.name]));

  let content = body;
  const linked: LinkedMention[] = [];
  const skipped: string[] = [];

  for (const num of candidates) {
    const name = nameByNumber.get(num);
    if (!name) {
      skipped.push(num);
      continue;
    }
    // 2026-09-26 (Donkey Kong incident): only link a number whose catalogue
    // name actually appears in this article. A model-written "(10332)" in an
    // article about the Donkey Kong Arcade was linked to Medieval Town
    // Square because this check didn't exist.
    if (!nameMatchesText(name, body)) {
      skipped.push(`${num} (catalogue name "${name}" not in article)`);
      continue;
    }
    const setSlug = canonicalSetSlug(num, name);

    // Same 4 mention patterns extractSetNumberCandidates() recognizes --
    // find the EARLIEST occurrence across all of them in the current
    // content, since "first mention" means first in reading order, not
    // first-pattern-checked order.
    const patterns = [
      new RegExp(`\\b(?:LEGO|set)\\s+(${num})\\b`, 'i'),
      new RegExp(`#(${num})\\b`),
      new RegExp(`\\((${num})\\)`),
      new RegExp(`\\b(${num})\\s+(?=[A-Z][a-z])`),
    ];
    let bestIndex = -1;
    let bestLength = 0;
    for (const re of patterns) {
      const m = re.exec(content);
      if (!m) continue;
      const numOffset = m[0].indexOf(m[1]);
      const absoluteStart = m.index + numOffset;
      if (bestIndex === -1 || absoluteStart < bestIndex) {
        bestIndex = absoluteStart;
        bestLength = m[1].length;
      }
    }
    if (bestIndex === -1) {
      // extractSetNumberCandidates found it but none of these 4 patterns
      // re-match against the current (possibly already-mutated) content --
      // shouldn't happen in practice, but skip rather than throw.
      skipped.push(num);
      continue;
    }

    content = content.slice(0, bestIndex) + `[${num}](/sets/${setSlug})` + content.slice(bestIndex + bestLength);
    linked.push({ setNumber: num, setSlug });
  }

  // Any /sets/NNNN-<slug> link already in the body (model-written, or from an
  // earlier catalogue name) is rewritten to the catalogue's canonical slug,
  // e.g. a stale /sets/42233-road-roller becomes /sets/42233-cement-truck.
  const linkNums = [...content.matchAll(/\/sets\/(\d{4,7})-[a-z0-9-]+/g)].map((m) => m[1]).filter((n) => !nameByNumber.has(n));
  if (linkNums.length) {
    const { data: more } = await supabase.from('sets').select('set_number, name').in('set_number', [...new Set(linkNums)]);
    for (const row of (more ?? []) as { set_number: string; name: string }[]) nameByNumber.set(row.set_number, row.name);
  }
  content = content.replace(/\/sets\/(\d{4,7})-[a-z0-9-]+/g, (whole, n: string) => {
    const name = nameByNumber.get(n);
    return name ? `/sets/${canonicalSetSlug(n, name)}` : whole;
  });
  return { content, linked, skipped };
}
