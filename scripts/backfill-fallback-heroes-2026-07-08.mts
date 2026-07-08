/**
 * Re-runs the canonical Rebrickable hero-image resolution chain
 * (resolveYouTubeHeroImage, src/lib/publish-draft.ts) for every article
 * currently stuck on '/fallback-hero.png'. Covers news_articles AND
 * blog_posts -- the older one-off scripts (backfill-hero-images.mjs,
 * populate-article-images.mjs) only covered news_articles and carried a
 * narrower, now-superseded copy of this resolution logic (missing the
 * theme-keyword second-tier fallback that publish-draft.ts has). This
 * script imports the current canonical function directly instead of
 * re-forking it a third time.
 *
 * Usage:
 *   npx tsx scripts/backfill-fallback-heroes-2026-07-08.mts          # dry run
 *   npx tsx scripts/backfill-fallback-heroes-2026-07-08.mts --apply  # write to DB
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
    if (k && !process.env[k]) process.env[k] = v;
  }
} catch {}

const APPLY = process.argv.includes('--apply');
const HERO_FALLBACK = '/fallback-hero.png';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

console.log(`\n== backfill-fallback-heroes ${APPLY ? '[APPLY]' : '[DRY RUN]'} ==\n`);

let rescueCount = 0, keepCount = 0, updatedCount = 0;

for (const table of ['news_articles', 'blog_posts'] as const) {
  const { data: articles, error } = await sb
    .from(table)
    .select('id, slug, title, content')
    .eq('hero_image', HERO_FALLBACK);

  if (error) { console.error(`[${table}] query error:`, error.message); continue; }
  console.log(`[${table}] ${articles.length} articles on fallback\n`);

  for (const art of articles) {
    const resolved = await resolveYouTubeHeroImage(art.title, art.content);

    if (resolved) {
      rescueCount++;
      console.log(`RESCUE  [${table}] ${art.slug}\n  -> ${resolved.slice(0, 100)}`);
      if (APPLY) {
        const { error: upErr } = await sb.from(table).update({ hero_image: resolved }).eq('id', art.id);
        if (upErr) console.log(`  ERR: ${upErr.message}`);
        else { updatedCount++; console.log('  OK'); }
      }
    } else {
      keepCount++;
      console.log(`KEEP-FALLBACK  [${table}] ${art.slug} (legitimate -- no set found)`);
    }
  }
  console.log();
}

console.log('----------------------------------------------------------------');
console.log(`Rescuable: ${rescueCount}, Legitimate fallback: ${keepCount}${APPLY ? `, Updated: ${updatedCount}` : ''}`);
