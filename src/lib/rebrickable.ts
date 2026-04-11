const REBRICKABLE_BASE = 'https://rebrickable.com/api/v3/lego';
const API_KEY = process.env.REBRICKABLE_API_KEY;

function headers() {
  return { Authorization: `key ${API_KEY}` };
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
      headers: headers(),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function searchSets(query: string, page = 1, pageSize = 24): Promise<{
  count: number;
  results: RebrickableSet[];
}> {
  try {
    const params = new URLSearchParams({
      search: query,
      page: String(page),
      page_size: String(pageSize),
      ordering: '-year',
    });
    const res = await fetch(`${REBRICKABLE_BASE}/sets/?${params}`, {
      headers: headers(),
      next: { revalidate: 300 },
    });
    if (!res.ok) return { count: 0, results: [] };
    return res.json();
  } catch {
    return { count: 0, results: [] };
  }
}

export async function getSetsByTheme(themeId: number, page = 1, pageSize = 24): Promise<{
  count: number;
  results: RebrickableSet[];
}> {
  try {
    const params = new URLSearchParams({
      theme_id: String(themeId),
      page: String(page),
      page_size: String(pageSize),
      ordering: '-year',
    });
    const res = await fetch(`${REBRICKABLE_BASE}/sets/?${params}`, {
      headers: headers(),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { count: 0, results: [] };
    return res.json();
  } catch {
    return { count: 0, results: [] };
  }
}

export async function getThemes(): Promise<RebrickableTheme[]> {
  try {
    const res = await fetch(`${REBRICKABLE_BASE}/themes/?page_size=1000`, {
      headers: headers(),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

export async function getSetMinifigs(setNumber: string) {
  try {
    const res = await fetch(`${REBRICKABLE_BASE}/sets/${setNumber}/minifigs/`, {
      headers: headers(),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

// Theme name to Rebrickable theme ID mapping (approximate)
export const THEME_IDS: Record<string, number[]> = {
  'technic': [1],
  'city': [52, 67],
  'star-wars': [158],
  'harry-potter': [246],
  'speed-champions': [684],
  'creator': [22, 626],
  'icons': [493],
  'botanical': [737],
  'minecraft': [577],
  'friends': [493],
};

export function setImageUrl(setNumber: string, imageUrl?: string | null): string {
  if (imageUrl) return imageUrl;
  return `https://cdn.rebrickable.com/media/sets/${setNumber}.jpg`;
}
