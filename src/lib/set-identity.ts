// Set identity for generated content (2026-09-26, after the Donkey Kong
// article). A 4-7 digit number in text is NOT a set citation just because a
// catalogue row with that number exists:
//   - generate-approved-drafts' extractSetNumber() took the FIRST number in a
//     source title ("The Kong-o-Matic 2000" -> set 2000), priced the article
//     from set 2000's store row (then a mis-matched MyBrickHouse listing,
//     Rs.3,199), and the model wrote "Donkey Kong Arcade (2000)".
//   - Gate 10 (link-set-mentions.ts) then linked a model-written "(10332)"
//     to /sets/10332-medieval-town-square without checking the name.
// The fix everywhere: a number is accepted as a set only when the catalogue
// NAME for that number also appears in the text around it. Years and part
// numbers ("Cargo Wagon (1977)", "Bar 6L (7078)") are not exempted by a year
// range here -- if they are written like a set citation and collide with a
// catalogue number, they fail the name check and get flagged.
import type { SupabaseClient } from '@supabase/supabase-js';
import { slugify } from './utils';

const STOP = new Set([
  'lego', 'the', 'and', 'of', 'with', 'set', 'for', 'in', 'on', 'to', 'kit', 'pack',
  'edition', 'collection', 'mini', 'building', 'build', 'bricks', 'brick', 'box', 'toy', 'new',
]);

/** Significant lowercase tokens of a set name (>= 3 chars, not stopwords). */
export function nameTokens(name: string): string[] {
  return name.toLowerCase().replace(/[™®©]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
}

/**
 * True when at least half of the set name's significant tokens occur in `text`.
 * Names with no significant tokens ("AT-AT", "KIT") must appear whole, on word
 * boundaries.
 */
export function nameMatchesText(name: string, text: string): boolean {
  const tk = nameTokens(name);
  const low = text.toLowerCase();
  if (!tk.length) {
    const whole = name.toLowerCase().replace(/[™®©]/g, '').trim();
    if (!whole) return false;
    const esc = whole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9])`).test(low);
  }
  return tk.filter((w) => low.includes(w)).length / tk.length >= 0.5;
}

/** Canonical /sets/ slug for a catalogue row -- the same shape the set pages use. */
export function canonicalSetSlug(setNumber: string, name: string): string {
  return `${setNumber}-${slugify(name)}`;
}

const NUM_RE = /(?<!\d)(\d{4,7})(?!\d)/g;

async function catalogNames(sb: SupabaseClient, nums: string[]): Promise<Map<string, string>> {
  if (!nums.length) return new Map();
  const { data } = await sb.from('sets').select('set_number, name').in('set_number', [...new Set(nums)]);
  return new Map((data ?? []).map((s: { set_number: string; name: string }) => [s.set_number, s.name]));
}

export type ResolvedSourceSet = { setNumber: string; name: string; via: 'url' | 'title' | 'excerpt' };

/**
 * The set a source article is actually about, or null. Candidates are, in
 * order: a /sets/ or /products/ number in the URL, then every number in the
 * title, then every number in the excerpt. A candidate is accepted only if it
 * exists in the catalogue AND its catalogue name appears in the source's own
 * title + excerpt + URL words. Never "the first number".
 */
export async function resolveSourceSet(
  sb: SupabaseClient,
  sourceUrl: string,
  sourceTitle: string | null,
  sourceExcerpt?: string | null,
): Promise<ResolvedSourceSet | null> {
  const urlNum = sourceUrl.match(/\/(?:sets?|products?)\/(\d{4,7})(?:[-/]|$)/i)?.[1];
  const titleNums = [...(sourceTitle ?? '').matchAll(NUM_RE)].map((m) => m[1]);
  const excerptNums = [...(sourceExcerpt ?? '').matchAll(NUM_RE)].map((m) => m[1]);
  const ordered: { n: string; via: ResolvedSourceSet['via'] }[] = [
    ...(urlNum ? [{ n: urlNum, via: 'url' as const }] : []),
    ...titleNums.map((n) => ({ n, via: 'title' as const })),
    ...excerptNums.map((n) => ({ n, via: 'excerpt' as const })),
  ];
  if (!ordered.length) return null;
  const names = await catalogNames(sb, ordered.map((c) => c.n));
  const context = `${sourceTitle ?? ''} ${sourceExcerpt ?? ''} ${decodeURIComponent(sourceUrl).replace(/[-_/]+/g, ' ')}`;
  for (const c of ordered) {
    const name = names.get(c.n);
    if (name && nameMatchesText(name, context)) return { setNumber: c.n, name, via: c.via };
  }
  return null;
}

export type SetCitation = { setNumber: string; name: string; form: string };

// Forms that present a number AS a set citation.
const CITATION_RES: { re: RegExp; form: string }[] = [
  { re: /\((\d{4,7})\)/g, form: '(NNNN)' },
  { re: /\[(\d{4,7})\]\(\/sets\//g, form: 'link' },
  { re: /\b(?:LEGO|set)\s+(\d{4,7})\b/gi, form: 'LEGO NNNN' },
  { re: /#(\d{4,7})\b/g, form: '#NNNN' },
];

/**
 * Catalogue set numbers cited in `text` whose catalogue name does not appear
 * anywhere in `text` -- i.e. the citation points at a different set than the
 * one the article is about (or at a year / part number that collides with a
 * catalogue number). Numbers not in the catalogue are ignored here (nothing
 * links or prices them).
 */
export async function unverifiedSetCitations(sb: SupabaseClient, text: string): Promise<SetCitation[]> {
  const found = new Map<string, string>();
  for (const { re, form } of CITATION_RES) {
    for (const m of text.matchAll(re)) if (!found.has(m[1])) found.set(m[1], form);
  }
  if (!found.size) return [];
  const names = await catalogNames(sb, [...found.keys()]);
  const out: SetCitation[] = [];
  for (const [n, form] of found) {
    const name = names.get(n);
    if (name && !nameMatchesText(name, text)) out.push({ setNumber: n, name, form });
  }
  return out;
}

/** Feedback text for the one regeneration allowed when citations fail (same pattern as #194). */
export function citationFeedback(bad: SetCitation[]): string {
  const list = bad.map((b) => `${b.setNumber} (catalogue: "${b.name}")`).join('; ');
  return `Your draft cited set numbers that do not match the set being discussed: ${list}. ` +
    'Cite years and part numbers without parentheses, or name the set. Only write a set number next to the set it belongs to.';
}
