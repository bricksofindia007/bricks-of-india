// A1 (1 Oct 2026): set page slugs are `${set_number}-${slugify(name)}`, and some set numbers
// contain "-" themselves (71051-6, BONSAI-2, DOTS-HP, Pick-a-Brick-2026). Reading the set
// number as the slug's first "-" segment sent 8 of those pages to 404 and 4 to a different set.
import { slugify } from './utils';

/** Set-number candidates for a slug: its first 1..max "-" segments, longest first. */
export function setNumberCandidates(slug: string, max = 5): string[] {
  const parts = slug.split('-');
  const out: string[] = [];
  for (let n = Math.min(max, parts.length); n >= 1; n--) out.push(parts.slice(0, n).join('-'));
  return out;
}

/** True when `slug` is exactly this set's own slug (or the bare set number). */
export function slugMatchesSet(slug: string, set: { set_number: string; name: string }): boolean {
  if (slug === set.set_number) return true;
  return slug.toLowerCase() === `${set.set_number}-${slugify(set.name)}`.toLowerCase();
}

/**
 * Which known set a slug names: an exact slug match wins; otherwise the longest candidate
 * set number that exists. `known` is the catalogue rows for setNumberCandidates(slug).
 */
export function pickSetNumber(slug: string, known: { set_number: string; name: string }[]): string | null {
  const exact = known.find((s) => slugMatchesSet(slug, s));
  if (exact) return exact.set_number;
  const have = new Set(known.map((s) => s.set_number));
  return setNumberCandidates(slug).find((c) => have.has(c)) ?? null;
}
