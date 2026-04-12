// Server-only — never import this file in 'use client' components.
// The REBRICKABLE_API_KEY env var is not prefixed with NEXT_PUBLIC_ and must stay server-side.

const REBRICKABLE_BASE = 'https://rebrickable.com/api/v3/lego';

function getHeaders(): HeadersInit {
  const key = process.env.REBRICKABLE_API_KEY;
  if (!key) {
    throw new Error('REBRICKABLE_API_KEY environment variable is not set');
  }
  return { Authorization: `key ${key}` };
}

export interface RebrickableSet {
  set_num: string;
  name: string;
  year: number;
  theme_id: number;
  num_parts: number;
  set_img_url: string;
  set_url: string;
  last_modified_dt: string;
}

export interface RebrickableTheme {
  id: number;
  parent_id: number | null;
  name: string;
}

// ─── Single-set lookup ───────────────────────────────────────────────────────

export async function getSet(setNumber: string): Promise<RebrickableSet | null> {
  try {
    const res = await fetch(`${REBRICKABLE_BASE}/sets/${setNumber}/`, {
      headers: getHeaders(),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    console.error('Rebrickable getSet error:', err);
    return null;
  }
}

// ─── Search ──────────────────────────────────────────────────────────────────

export async function searchSets(
  query: string,
  page = 1,
  pageSize = 24,
): Promise<{ count: number; results: RebrickableSet[] }> {
  try {
    const params = new URLSearchParams({
      search: query,
      page: String(page),
      page_size: String(pageSize),
      ordering: '-year',
    });
    const res = await fetch(`${REBRICKABLE_BASE}/sets/?${params}`, {
      headers: getHeaders(),
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.error(`Rebrickable searchSets HTTP ${res.status} for query "${query}"`);
      return { count: 0, results: [] };
    }
    return res.json();
  } catch (err) {
    console.error('Rebrickable searchSets error:', err);
    return { count: 0, results: [] };
  }
}

// ─── Single-page theme fetch (kept for backwards compat) ─────────────────────

export async function getSetsByTheme(
  themeId: number,
  page = 1,
  pageSize = 24,
): Promise<{ count: number; results: RebrickableSet[] }> {
  try {
    const params = new URLSearchParams({
      theme_id: String(themeId),
      page: String(page),
      page_size: String(pageSize),
      ordering: '-year',
    });
    const res = await fetch(`${REBRICKABLE_BASE}/sets/?${params}`, {
      headers: getHeaders(),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { count: 0, results: [] };
    return res.json();
  } catch (err) {
    console.error('Rebrickable getSetsByTheme error:', err);
    return { count: 0, results: [] };
  }
}

// ─── Paginated full theme fetch ───────────────────────────────────────────────

/**
 * Fetches ALL sets for a theme by following the `next` pagination cursor.
 * Stops after MAX_PAGES pages to avoid runaway API consumption.
 * Results are cached for 24 hours via Next.js fetch cache.
 */
const MAX_PAGES = 15; // 15 × 100 = 1 500 sets max per theme

export async function getAllSetsForTheme(themeId: number): Promise<RebrickableSet[]> {
  const allSets: RebrickableSet[] = [];
  let nextUrl: string | null =
    `${REBRICKABLE_BASE}/sets/?theme_id=${themeId}&page_size=100&ordering=-year`;
  let pages = 0;

  while (nextUrl && pages < MAX_PAGES) {
    try {
      const fetchUrl = nextUrl;
      const res: Response = await fetch(fetchUrl, {
        headers: getHeaders(),
        next: { revalidate: 86400 }, // cache 24 h — re-fetched only on daily build
      });
      if (!res.ok) break;
      const data = await res.json();
      allSets.push(...(data.results ?? []));
      nextUrl = data.next ?? null;
      pages++;
    } catch (err) {
      console.error(`Rebrickable getAllSetsForTheme error (theme ${themeId}):`, err);
      break;
    }
  }

  return allSets;
}

/**
 * Returns the IDs of all direct child themes for a given parent theme ID.
 */
export async function getChildThemeIds(parentId: number): Promise<number[]> {
  try {
    const res = await fetch(
      `${REBRICKABLE_BASE}/themes/?parent_id=${parentId}&page_size=100`,
      { headers: getHeaders(), next: { revalidate: 86400 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results as RebrickableTheme[]).map((t) => t.id);
  } catch (err) {
    console.error(`Rebrickable getChildThemeIds error (parent ${parentId}):`, err);
    return [];
  }
}

/**
 * Fetches all sets for a theme AND all of its child sub-themes.
 * Deduplicates by set_num.
 */
export async function getAllSetsForThemeIncludingChildren(
  parentId: number,
): Promise<RebrickableSet[]> {
  const childIds = await getChildThemeIds(parentId);
  const allIds = [parentId, ...childIds];

  const results = await Promise.all(allIds.map((id) => getAllSetsForTheme(id)));

  const seen = new Set<string>();
  return results.flat().filter((set) => {
    if (seen.has(set.set_num)) return false;
    seen.add(set.set_num);
    return true;
  });
}

// ─── Other utilities ─────────────────────────────────────────────────────────

export async function getThemes(): Promise<RebrickableTheme[]> {
  try {
    const res = await fetch(`${REBRICKABLE_BASE}/themes/?page_size=1000`, {
      headers: getHeaders(),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch (err) {
    console.error('Rebrickable getThemes error:', err);
    return [];
  }
}

export async function getSetMinifigs(setNumber: string) {
  try {
    const res = await fetch(`${REBRICKABLE_BASE}/sets/${setNumber}/minifigs/`, {
      headers: getHeaders(),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch (err) {
    console.error('Rebrickable getSetMinifigs error:', err);
    return [];
  }
}

// ─── Theme ID map (all 25 themes) ────────────────────────────────────────────
//
// Maps each brand.ts theme slug to one or more Rebrickable theme IDs.
// Multiple IDs cover the main theme + key sub-themes that Rebrickable
// separates (e.g. Creator 3-in-1 vs Creator Expert).
// If a theme ID turns out to be wrong, getAllSetsForTheme returns [] and
// the page falls back to the Supabase query gracefully.

export const THEME_IDS: Record<string, number[]> = {
  'technic':         [1],
  'city':            [52, 67],
  'star-wars':       [158],
  'harry-potter':    [246],
  'speed-champions': [684],
  'creator':         [22, 626],
  'icons':           [721],        // was 493 (400 error) — correct ID confirmed via API
  'botanical':       [737],
  'minecraft':       [577],
  'friends':         [216],
  'ninjago':         [435],
  'marvel':          [671],
  'dc':              [695],        // was 49 (400 error) — DC Super Heroes top-level
  'ideas':           [598],
  'architecture':    [252],
  'disney':          [494],
  'brickheadz':      [765],
  'jurassic-world':  [602],        // was 307 (returned 1996 sets) — Jurassic World top-level
  'super-mario':     [690],        // was 624 (400 error) — correct ID confirmed via API
  'duplo':           [504],        // was 5 (400 error) — Duplo top-level
  'art':             [784],
  'dots':            [688],        // was 756 (returned 1971 sets) — DOTS correct ID
  'dreamzzz':        [749],        // was 808 (400 error) — correct ID confirmed via API
  'classic':         [186],
  'seasonal':        [738],        // was 248 (400 error) — Seasonal with Christmas sets
};

// ─── Image URL helper ─────────────────────────────────────────────────────────

/**
 * Returns the correct CDN image URL for a set.
 * Prefer image_url from DB → rebrickable_id CDN → best-guess fallback.
 */
export function setImageUrl(
  setNumber: string,
  rebrickableId: string | null | undefined,
  imageUrl?: string | null,
): string {
  if (imageUrl) return imageUrl;
  const id = rebrickableId ?? `${setNumber}-1`;
  return `https://cdn.rebrickable.com/media/sets/${id}.jpg`;
}
