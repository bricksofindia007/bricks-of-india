/**
 * Syncs LEGO sets from Rebrickable API into Supabase.
 * Run: node scripts/sync-rebrickable.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Validate required env vars before doing anything
const REBRICKABLE_API_KEY = process.env.REBRICKABLE_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!REBRICKABLE_API_KEY) {
  console.error('ERROR: REBRICKABLE_API_KEY is not set in .env.local');
  process.exit(1);
}
if (!SUPABASE_URL) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL is not set in .env.local');
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error(
    'ERROR: SUPABASE_SERVICE_ROLE_KEY is not set in .env.local\n' +
    'Get it from: Supabase dashboard → Settings → API → service_role secret key',
  );
  process.exit(1);
}

// Service role key bypasses RLS — required for upserts
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const BASE_URL = 'https://rebrickable.com/api/v3/lego';

async function fetchSetsPage(page = 1, pageSize = 100) {
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
    throw new Error(`Rebrickable API error: HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchThemeName(themeId) {
  const res = await fetch(`${BASE_URL}/themes/${themeId}/`, {
    headers: { Authorization: `key ${REBRICKABLE_API_KEY}` },
  });
  if (!res.ok) return 'Unknown';
  const data = await res.json();
  return data.name;
}

// Cache theme names to avoid repeated API calls for the same theme
const themeCache = {};
async function getThemeName(themeId) {
  if (themeCache[themeId]) return themeCache[themeId];
  const name = await fetchThemeName(themeId);
  themeCache[themeId] = name;
  return name;
}

async function upsertSet(set, themeName) {
  const { error } = await supabase.from('sets').upsert(
    {
      // Strip the numeric suffix (e.g. -1, -2) from the Rebrickable set_num to get a clean set number
      set_number: set.set_num.replace(/-\d+$/, ''),
      name: set.name,
      theme: themeName,
      year: set.year,
      pieces: set.num_parts,
      image_url: set.set_img_url,
      rebrickable_id: set.set_num,   // Keep the full ID (e.g. "75192-1") for CDN image URLs
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'set_number' },
  );
  if (error) {
    console.error(`  ✗ Failed to upsert ${set.set_num}: ${error.message}`);
    return false;
  }
  return true;
}

async function run() {
  console.log('🧱 Syncing LEGO sets from Rebrickable...\n');
  let synced = 0;
  let failed = 0;
  let page = 1;

  while (page <= 10) { // Up to 1,000 sets
    console.log(`Fetching page ${page}...`);
    let data;
    try {
      data = await fetchSetsPage(page);
    } catch (err) {
      console.error(`Failed to fetch page ${page}: ${err.message}`);
      break;
    }

    if (!data?.results?.length) break;

    for (const set of data.results) {
      const themeName = await getThemeName(set.theme_id);
      const ok = await upsertSet(set, themeName);
      if (ok) synced++;
      else failed++;
    }

    if (!data.next) break;
    page++;

    // Rate limit — Rebrickable allows ~1 req/sec on the free tier
    await new Promise((r) => setTimeout(r, 1100));
  }

  console.log(`\n✅ Synced: ${synced} sets`);
  if (failed > 0) {
    console.error(`⚠️  Failed: ${failed} sets — check errors above`);
    if (synced === 0) {
      console.error('\nNo sets were synced at all. Likely cause: wrong SUPABASE_SERVICE_ROLE_KEY, or RLS is blocking writes.');
      process.exit(1);
    }
  }
}

run().catch((err) => {
  console.error('Sync script crashed:', err);
  process.exit(1);
});
