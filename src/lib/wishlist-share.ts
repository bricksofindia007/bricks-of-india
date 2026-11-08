// Guest wishlist share link (decision 21c). The set numbers travel in the address, so no account and no storage are needed.
// Pure: no browser, no network, no cookies. Unknown numbers are dropped when the page looks them up in the catalogue.

import { MY_SETS_LIMIT, isSetNumber } from '@/lib/my-collection';
import { slugify } from '@/lib/utils';

export const WISHLIST_PATH = '/wishlist';
const SEPARATOR = ',';

/** Pure: the cleaned list of set numbers: well-formed, one each, in order, capped at the existing 500-set limit. */
export function cleanSetNumbers(input: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of input) {
    if (!isSetNumber(v) || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= MY_SETS_LIMIT) break;
  }
  return out;
}

/** Pure: the path segment that carries the set numbers, e.g. "75192,10307". Empty when no valid number is given. */
export function wishlistSegment(setNumbers: readonly unknown[]): string {
  return cleanSetNumbers(setNumbers).join(SEPARATOR);
}

/** Pure: the set numbers in a path segment. Anything that is not a set number is dropped; the result is capped. */
export function parseWishlistSegment(segment: string): string[] {
  return cleanSetNumbers(String(segment ?? '').split(SEPARATOR).map((s) => s.trim()));
}

/** Pure: the shareable path for a guest wishlist, or null when no valid set number is given. */
export function wishlistSharePath(setNumbers: readonly unknown[]): string | null {
  const seg = wishlistSegment(setNumbers);
  return seg ? `${WISHLIST_PATH}/${seg}` : null;
}

/** Pure: the set page address, in the same format the set cards use (number, then the slugified name). */
export function setPagePath(setNumber: string, name: string): string {
  return `/sets/${setNumber}-${slugify(name)}`;
}
