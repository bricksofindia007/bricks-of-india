/**
 * Sync ALL CMF individual figures from Rebrickable → cmf_figures table (Series 1–29).
 * Usage: node --env-file=.env.local scripts/sync-cmf-figures.mjs
 *
 * Requires cmf_figures table (migration 20260531000000_cmf_figures.sql).
 * Upserts on figure_number conflict — safe to re-run.
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
  { base: '8683',  name: 'Series 1 Minifigures',  year: 2010 },
  { base: '8684',  name: 'Series 2 Minifigures',  year: 2011 },
  { base: '8803',  name: 'Series 3 Minifigures',  year: 2011 },
  { base: '8804',  name: 'Series 4 Minifigures',  year: 2012 },
  { base: '8805',  name: 'Series 5 Minifigures',  year: 2012 },
  { base: '8827',  name: 'Series 6 Minifigures',  year: 2012 },
  { base: '8831',  name: 'Series 7 Minifigures',  year: 2013 },
  { base: '8833',  name: 'Series 8 Minifigures',  year: 2013 },
  { base: '71000', name: 'Series 9 Minifigures',  year: 2013 },
  { base: '71001', name: 'Series 10 Minifigures', year: 2013 },
  { base: '71002', name: 'Series 11 Minifigures', year: 2014 },
  { base: '71007', name: 'Series 12 Minifigures', year: 2014 },
  { base: '71008', name: 'Series 13 Minifigures', year: 2015 },
  { base: '71010', name: 'Series 14 Minifigures', year: 2015 },
  { base: '71011', name: 'Series 15 Minifigures', year: 2016 },
  { base: '71013', name: 'Series 16 Minifigures', year: 2016 },
  { base: '71018', name: 'Series 17 Minifigures', year: 2017 },
  { base: '71021', name: 'Series 18 Minifigures', year: 2018 },
  { base: '71025', name: 'Series 19 Minifigures', year: 2019 },
  { base: '71027', name: 'Series 20 Minifigures', year: 2020 },
  { base: '71029', name: 'Series 21 Minifigures', year: 2021 },
  { base: '71032', name: 'Series 22 Minifigures', year: 2022 },
  { base: '71034', name: 'Series 23 Minifigures', year: 2022 },
  { base: '71037', name: 'Series 24 Minifigures', year: 2023 },
  { base: '71045', name: 'Series 25 Minifigures', year: 2024 },
  { base: '71047', name: 'Series 26 Minifigures', year: 2024 },
  { base: '71048', name: 'Series 27 Minifigures', year: 2024 },
  { base: '71051', name: 'Series 28 Minifigures', year: 2026 },
  { base: '71052', name: 'Series 29 Minifigures', year: 2026 },
];

async function fetchFigures(series) {
  const url = `https://rebrickable.com/api/v3/lego/sets/?search=${series.base}&page_size=50`;
  const res = await fetch(url, { headers: { Authorization: `key ${RB_KEY}`, 'User-Agent': UA }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.results ?? [])
    .filter(s => new RegExp(`^${series.base}-\\d+$`).test(s.set_num) && !/sealed|box|pack|complete|random/i.test(s.name))
    .map(s => ({
      figure_number:     s.set_num,
      series_set_number: series.base,
      name:              s.name,
      image_url:         s.set_img_url ?? null,
      series_name:       series.name,
      year:              series.year,
      figure_index:      parseInt(s.set_num.split('-')[1], 10),
      updated_at:        new Date().toISOString(),
    }))
    .sort((a, b) => a.figure_index - b.figure_index);
}

async function main() {
  console.log('━━ sync-cmf-figures (Series 1–29) ━━━━━━━━━━━━━━━━━━━━━━━');
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
    await new Promise(r => setTimeout(r, 1100));
  }

  const { count } = await sb.from('cmf_figures').select('*', { count: 'exact', head: true });
  console.log(`\n━━ Done: ${total} synced, ${failed} failed — ${count} rows in cmf_figures ━━`);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
