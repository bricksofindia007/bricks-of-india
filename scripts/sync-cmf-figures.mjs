/**
 * Sync CMF individual figures from Rebrickable → cmf_figures table.
 * Usage: node --env-file=.env.local scripts/sync-cmf-figures.mjs
 *
 * Requires cmf_figures table (migration 20260531000000_cmf_figures.sql).
 * Fetches 10 series (20–29), upserts on figure_number conflict.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

const sb     = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const RB_KEY = process.env.REBRICKABLE_API_KEY;
const UA     = 'BricksOfIndia-CMFSync/1.0 (+https://bricksofindia.com)';

const CMF_SERIES = [
  { base: '71027', name: 'Series 20 Minifigures' },
  { base: '71029', name: 'Series 21 Minifigures' },
  { base: '71032', name: 'Series 22 Minifigures' },
  { base: '71034', name: 'Series 23 Minifigures' },
  { base: '71037', name: 'Series 24 Minifigures' },
  { base: '71045', name: 'Series 25 Minifigures' },
  { base: '71047', name: 'Series 26 Minifigures' },
  { base: '71048', name: 'Series 27 Minifigures' },
  { base: '71051', name: 'Series 28 Minifigures' },
  { base: '71052', name: 'Series 29 Minifigures' },
];

const FIGURE_RE = base => new RegExp(`^${base}-\\d+$`);
const SKIP_RE   = /sealed|box|pack|complete|random/i;

async function fetchFigures(series) {
  const url = `https://rebrickable.com/api/v3/lego/sets/?search=${series.base}&page_size=50`;
  const res = await fetch(url, { headers: { Authorization: `key ${RB_KEY}`, 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  return (data.results ?? [])
    .filter(s => FIGURE_RE(series.base).test(s.set_num) && !SKIP_RE.test(s.name))
    .map(s => ({
      figure_number:      s.set_num,
      series_set_number:  series.base,
      name:               s.name,
      image_url:          s.set_img_url ?? null,
      series_name:        series.name,
      year:               s.year ?? null,
      figure_index:       parseInt(s.set_num.split('-')[1], 10),
      updated_at:         new Date().toISOString(),
    }))
    .sort((a, b) => a.figure_index - b.figure_index);
}

async function main() {
  console.log('━━ sync-cmf-figures ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  let total = 0, failed = 0;

  for (const series of CMF_SERIES) {
    try {
      const figures = await fetchFigures(series);
      const { error } = await sb.from('cmf_figures').upsert(figures, { onConflict: 'figure_number' });
      if (error) throw error;
      console.log(`✓ ${series.name}: ${figures.length} figures`);
      total += figures.length;
    } catch (e) {
      console.error(`✗ ${series.name}: ${e.message}`);
      failed++;
    }
    // Respect Rebrickable free-tier rate limit (1 req/s)
    await new Promise(r => setTimeout(r, 1100));
  }

  console.log(`\n━━ Done: ${total} figures upserted, ${failed} series failed ━━`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
