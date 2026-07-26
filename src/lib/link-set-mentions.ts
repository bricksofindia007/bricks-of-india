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
import { slugify } from './utils';

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
    const setSlug = `${num}-${slugify(name)}`;

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

  return { content, linked, skipped };
}
