/**
 * sync-cmf-figure-images-brickset.mjs
 *
 * Minifig HQ rebuild (2026-08-11) — for every row in cmf_figures, checks
 * Brickset's CDN for a higher-res image at the figure's own set number
 * (https://images.brickset.com/sets/images/{figure_number}.jpg) via a
 * HEAD request, same pattern as scripts/populate-article-images.mjs.
 * Brickset wins on a 200; Rebrickable's existing image_url (from
 * sync-cmf-figures.mjs) is left in place where Brickset has no image for
 * that exact figure number. Every row gets image_source set explicitly
 * either way, so this is auditable and safe to re-run.
 *
 * Run: node scripts/sync-cmf-figure-images-brickset.mjs
 * Requires: supabase/migrations/20260811000000_cmf_figures_image_source.sql
 */

import fs from 'fs';
import https from 'https';
import { createClient } from '@supabase/supabase-js';

// ── Load .env.local ──────────────────────────────────────────────────────
const envRaw = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = {};
for (const line of envRaw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq > 0) env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

function bricksetUrl(figureNumber) {
  return `https://images.brickset.com/sets/images/${figureNumber}.jpg`;
}

function headStatus(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD', timeout: 8000 }, (res) => resolve(res.statusCode));
    req.on('error', () => resolve(0));
    req.on('timeout', () => { req.destroy(); resolve(-1); });
    req.end();
  });
}

async function main() {
  const { data: rows, error } = await supabase
    .from('cmf_figures')
    .select('id, figure_number, name, image_url')
    .order('series_set_number', { ascending: true })
    .order('figure_index', { ascending: true });
  if (error) throw error;

  console.log(`━━ ${rows.length} figures — checking Brickset coverage ━━`);

  let bricksetHits = 0, rebrickableFallbacks = 0, failed = 0;

  for (const row of rows) {
    const url = bricksetUrl(row.figure_number);
    const status = await headStatus(url);
    const useBrickset = status === 200;

    const update = useBrickset
      ? { image_url: url, image_source: 'brickset' }
      : { image_source: 'rebrickable' }; // image_url untouched — keep Rebrickable's existing value

    const { error: updateError } = await supabase.from('cmf_figures').update(update).eq('id', row.id);
    if (updateError) {
      console.error(`✗ ${row.figure_number} (${row.name}): ${updateError.message}`);
      failed++;
    } else if (useBrickset) {
      bricksetHits++;
    } else {
      rebrickableFallbacks++;
      if (!row.image_url) console.warn(`  ⚠ ${row.figure_number} (${row.name}): no Brickset image AND no existing Rebrickable image_url`);
    }

    await new Promise((r) => setTimeout(r, 80)); // gentle rate limiting, matches populate-article-images.mjs
  }

  console.log(`\n━━ Done: ${bricksetHits} on Brickset, ${rebrickableFallbacks} fell back to Rebrickable, ${failed} write failures ━━`);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
