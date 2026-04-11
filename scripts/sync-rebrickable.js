/**
 * Syncs LEGO sets from Rebrickable API into Supabase
 * Run: node scripts/sync-rebrickable.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Service role key bypasses RLS — required for syncing
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const REBRICKABLE_API_KEY = process.env.REBRICKABLE_API_KEY;
const BASE_URL = 'https://rebrickable.com/api/v3/lego';

async function fetchSets(page = 1, pageSize = 100) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    ordering: '-year',
    min_year: '2020',
  });

  const res = await fetch(`${BASE_URL}/sets/?${params}`, {
    headers: { Authorization: `key ${REBRICKABLE_API_KEY}` },
  });

  if (!res.ok) {
    console.error(`Rebrickable API error: ${res.status}`);
    return null;
  }

  return res.json();
}

async function getThemeName(themeId) {
  const res = await fetch(`${BASE_URL}/themes/${themeId}/`, {
    headers: { Authorization: `key ${REBRICKABLE_API_KEY}` },
  });
  if (!res.ok) return 'Unknown';
  const data = await res.json();
  return data.name;
}

// Cache theme names
const themeCache = {};
async function getCachedThemeName(themeId) {
  if (themeCache[themeId]) return themeCache[themeId];
  const name = await getThemeName(themeId);
  themeCache[themeId] = name;
  return name;
}

async function upsertSet(set, themeName) {
  const { error } = await supabase.from('sets').upsert({
    set_number: set.set_num.replace('-1', ''),
    name: set.name,
    theme: themeName,
    year: set.year,
    pieces: set.num_parts,
    image_url: set.set_img_url,
    rebrickable_id: set.set_num,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'set_number' });

  if (error) console.error(`Error upserting ${set.set_num}:`, error.message);
}

async function run() {
  console.log('🧱 Syncing LEGO sets from Rebrickable...');
  let page = 1;
  let total = 0;

  while (page <= 10) { // Sync up to 1000 recent sets
    console.log(`Fetching page ${page}...`);
    const data = await fetchSets(page);
    if (!data || !data.results || data.results.length === 0) break;

    for (const set of data.results) {
      const themeName = await getCachedThemeName(set.theme_id);
      await upsertSet(set, themeName);
      total++;
    }

    if (!data.next) break;
    page++;

    // Rate limit — Rebrickable allows ~1 req/sec
    await new Promise((r) => setTimeout(r, 1100));
  }

  console.log(`✅ Synced ${total} sets to Supabase.`);
}

run().catch(console.error);
