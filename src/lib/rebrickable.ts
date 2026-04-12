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

// Correct Rebrickable theme IDs — used by sync script and getSetsByTheme
export const THEME_IDS: Record<string, number[]> = {
  'technic':         [1],
  'city':            [52, 67],
  'star-wars':       [158],
  'harry-potter':    [246],
  'speed-champions': [684],
  'creator':         [22, 626],
  'icons':           [493],
  'botanical':       [737],
  'minecraft':       [577],
  'friends':         [216],   // Fixed: was 493 (same as Icons) — Friends theme ID is 216
};

/**
 * Returns the correct CDN image URL for a set.
 *
 * The DB stores set_number with the suffix stripped (e.g. "75192") but the CDN
 * path requires the full Rebrickable ID with suffix (e.g. "75192-1").
 * Always prefer image_url from the DB, then rebrickable_id, then a best-guess fallback.
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
