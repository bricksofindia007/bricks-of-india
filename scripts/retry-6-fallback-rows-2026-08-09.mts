/**
 * One-off follow-up to §7 of the Nav & Content Overhaul (2026-08-09):
 * re-runs the ACTUAL pipeline function (resolveYouTubeHeroImage, imported
 * directly from src/lib/publish-draft.ts, not reimplemented here) against
 * the 6 News rows published 2026-08-08 ~09:11 UTC that got the fallback
 * asset before matchLocalSetByTitle() (tier 3) existed. Applies a real
 * resolved image where one is found; repoints everything else from the
 * retired community-spotlight-fallback.png to the renamed
 * lego-news-fallback.png.
 *
 * Usage:
 *   npx tsx scripts/retry-6-fallback-rows-2026-08-09.mts          # dry run
 *   npx tsx scripts/retry-6-fallback-rows-2026-08-09.mts --apply  # write to DB
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveYouTubeHeroImage } from '../src/lib/publish-draft';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const raw = readFileSync(join(__dirname, '../.env.local'), 'utf-8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
} catch { /* ok if .env.local missing on CI, real env vars used instead */ }

const APPLY = process.argv.includes('--apply');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const OLD_FALLBACK = '/community-spotlight-fallback.png';
const NEW_FALLBACK = '/lego-news-fallback.png';

const TARGET_IDS = [
  '9abcb53d-5efc-4ff9-8099-1a141289da08', // Bio-Cup: Blue Morpho Butterfly
  '3a07e90f-2fca-4f37-872e-ec35a429a865', // LEGO Castle's Kraken Knights
  '897378d9-3b58-469c-b65d-d8f1d30db570', // LEGO X-Files Sets Land, But MOC Community Already Building More
  '82e5c6d4-a281-45f7-aac2-7de11747526d', // LEGO Lord of the Rings Mumakil MOC
  '421ba600-1a65-4a47-98a0-53e7594884d8', // LEGO Flamingo Builds Feature Dragon Jaw Piece
  'db1b7376-65e6-4e15-9a3d-24d7d4d9c360', // LEGO Build-a-Minifigure September 2026 Halloween Characters
];

(async () => {
  const { data: rows, error } = await sb
    .from('news_articles')
    .select('id, slug, title, content, hero_image')
    .in('id', TARGET_IDS);
  if (error) throw error;

  console.log(`━━ Retry ${rows?.length ?? 0} rows${APPLY ? '' : ' [DRY-RUN]'} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  for (const row of rows ?? []) {
    console.log(`\n--- ${row.slug}`);
    console.log(`title: ${row.title}`);
    console.log(`before: ${row.hero_image}`);

    const resolved = await resolveYouTubeHeroImage(row.title, row.content, sb);
    const finalImage = resolved ?? NEW_FALLBACK;

    console.log(`after:  ${finalImage}${resolved ? '  [REAL IMAGE RESOLVED]' : '  [no local/Rebrickable match -- renamed fallback]'}`);

    if (APPLY) {
      const { error: updErr } = await sb.from('news_articles').update({ hero_image: finalImage }).eq('id', row.id);
      if (updErr) { console.error('UPDATE FAILED:', updErr.message); continue; }
      console.log('APPLIED.');
    }
  }

  console.log(`\n(sanity check, not part of the retry logic) OLD_FALLBACK constant referenced: ${OLD_FALLBACK}`);
})().catch(err => { console.error('FATAL:', err); process.exit(1); });
