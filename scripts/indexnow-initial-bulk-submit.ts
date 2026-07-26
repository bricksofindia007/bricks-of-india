/**
 * ONE-TIME bulk IndexNow submission for the GSC-01 Part A tiering change --
 * the initial "here's everything that's indexable" signal, since the
 * tier split itself changed which ~21K set URLs are meant to be indexed.
 * Not meant to be re-run regularly; scripts/indexnow-sync-sets.ts is the
 * ongoing incremental replacement.
 *
 * Run: npx tsx scripts/indexnow-initial-bulk-submit.ts
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '../src/lib/get-secret';
import { submitToIndexNow } from '../src/lib/indexnow';
import { slugify } from '../src/lib/utils';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = getSecret('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('::error::NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function main() {
  const PAGE = 1000;
  const sets: { set_number: string; name: string }[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb
      .from('sets')
      .select('set_number, name')
      .in('index_tier', ['tier1', 'tier2'])
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    sets.push(...data);
    if (data.length < PAGE) break;
  }

  console.log(`Submitting ${sets.length} Tier 1 + Tier 2 set URLs to IndexNow...`);
  const urls = sets.map((s) => `https://bricksofindia.com/sets/${s.set_number}-${slugify(s.name)}`);
  const results = await submitToIndexNow(urls);

  for (const r of results) {
    console.log(`  chunk of ${r.chunkSize}: HTTP ${r.status} (${r.ok ? 'ok' : 'NOT OK'})`);
  }

  const allOk = results.every((r) => r.ok);
  if (allOk) {
    const now = new Date().toISOString();
    const setNumbers = sets.map((s) => s.set_number);
    // Mark in batches -- .in() has its own practical size limits distinct
    // from IndexNow's 10,000-URL cap.
    const MARK_BATCH = 1000;
    for (let i = 0; i < setNumbers.length; i += MARK_BATCH) {
      const batch = setNumbers.slice(i, i + MARK_BATCH);
      const { error } = await sb.from('sets').update({ indexnow_submitted_at: now }).in('set_number', batch);
      if (error) throw error;
    }
    console.log(`Marked all ${setNumbers.length} sets as submitted at ${now}.`);
  } else {
    console.log('At least one chunk was not ok -- NOT marking sets as submitted.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
