// Display name for each store slug, read from config/store-display-names.json (the Python side reads the same file).
// The stores table is the source of truth; a test checks this file against its seed.
import names from '../../config/store-display-names.json';

const DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(names).filter(([k]) => !k.startsWith('_')),
) as Record<string, string>;

/** The display name for a store slug. An unknown slug shows as itself, never a guessed name. */
export function storeDisplayName(slug: string): string {
  return DISPLAY[slug] ?? slug;
}

export const STORE_DISPLAY_NAMES: Readonly<Record<string, string>> = Object.freeze({ ...DISPLAY });
