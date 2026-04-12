/**
 * fetch-theme-images.mjs
 *
 * For each theme, calls the Rebrickable API with its theme_id,
 * grabs the most-recent set's real CDN URL and set_num,
 * and prints a verification table.
 *
 * READ-ONLY — does not modify any files.
 * Run: node scripts/fetch-theme-images.mjs
 */

import fs from 'fs';
import https from 'https';

// ── Load .env.local manually (dotenv reads .env, not .env.local) ────────────
const envRaw = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = {};
for (const line of envRaw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
}
const API_KEY = env.REBRICKABLE_API_KEY;
if (!API_KEY) { console.error('REBRICKABLE_API_KEY not found in .env.local'); process.exit(1); }

// ── Theme definitions (slug → first theme_id used for the lookup) ───────────
const THEMES = [
  { slug: 'technic',         name: 'Technic',         themeIds: [1] },
  { slug: 'city',            name: 'City',            themeIds: [52, 67] },
  { slug: 'star-wars',       name: 'Star Wars',       themeIds: [158] },
  { slug: 'harry-potter',    name: 'Harry Potter',    themeIds: [246] },
  { slug: 'speed-champions', name: 'Speed Champions', themeIds: [684] },
  { slug: 'creator',         name: 'Creator',         themeIds: [22, 626] },
  { slug: 'icons',           name: 'Icons',           themeIds: [493] },
  { slug: 'botanical',       name: 'Botanical',       themeIds: [737] },
  { slug: 'minecraft',       name: 'Minecraft',       themeIds: [577] },
  { slug: 'friends',         name: 'Friends',         themeIds: [216] },
  { slug: 'ninjago',         name: 'Ninjago',         themeIds: [435] },
  { slug: 'marvel',          name: 'Marvel',          themeIds: [671] },
  { slug: 'dc',              name: 'DC',              themeIds: [49] },
  { slug: 'ideas',           name: 'Ideas',           themeIds: [598] },
  { slug: 'architecture',    name: 'Architecture',    themeIds: [252] },
  { slug: 'disney',          name: 'Disney',          themeIds: [494] },
  { slug: 'brickheadz',      name: 'BrickHeadz',      themeIds: [765] },
  { slug: 'jurassic-world',  name: 'Jurassic World',  themeIds: [307] },
  { slug: 'super-mario',     name: 'Super Mario',     themeIds: [624] },
  { slug: 'duplo',           name: 'Duplo',           themeIds: [5] },
  { slug: 'art',             name: 'Art',             themeIds: [784] },
  { slug: 'dots',            name: 'Dots',            themeIds: [756] },
  { slug: 'dreamzzz',        name: 'Dreamzzz',        themeIds: [808] },
  { slug: 'classic',         name: 'Classic',         themeIds: [186] },
  { slug: 'seasonal',        name: 'Seasonal',        themeIds: [248] },
];

// ── Simple fetch wrapper (no node-fetch dependency) ─────────────────────────
function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Authorization: `key ${API_KEY}` } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        } else {
          resolve(JSON.parse(body));
        }
      });
    });
    req.on('error', reject);
  });
}

// ── For a theme, try each themeId until we get a set with set_img_url ───────
async function fetchBestSet(theme) {
  for (const id of theme.themeIds) {
    try {
      const url = `https://rebrickable.com/api/v3/lego/sets/?theme_id=${id}&page_size=5&ordering=-year`;
      const data = await get(url);
      const results = data.results ?? [];
      // Prefer a set that has an image
      const withImage = results.find((s) => s.set_img_url);
      if (withImage) {
        return { themeId: id, set_num: withImage.set_num, set_img_url: withImage.set_img_url, name: withImage.name, year: withImage.year };
      }
      // Fall back to first result even if no image
      if (results.length > 0) {
        const s = results[0];
        return { themeId: id, set_num: s.set_num, set_img_url: s.set_img_url ?? null, name: s.name, year: s.year };
      }
    } catch (err) {
      console.error(`  [${theme.slug}] theme_id=${id} error: ${err.message}`);
    }
  }
  return null;
}

// ── Pad string to fixed width ────────────────────────────────────────────────
const pad = (s, n) => String(s ?? '').slice(0, n).padEnd(n);

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nFetching representative set for each theme from Rebrickable API...\n');

  const rows = [];

  for (const theme of THEMES) {
    process.stdout.write(`  Fetching ${theme.name}...`);
    const result = await fetchBestSet(theme);
    if (result) {
      const bricksetUrl = `https://images.brickset.com/sets/images/${result.set_num.replace(/-\d+$/, '')}-1.jpg`;
      rows.push({
        slug: theme.slug,
        name: theme.name,
        themeId: result.themeId,
        set_num: result.set_num,
        setName: result.name,
        year: result.year,
        rebrickable_img: result.set_img_url ?? 'NULL',
        brickset_fallback: bricksetUrl,
      });
      process.stdout.write(` ${result.set_num} (${result.year})\n`);
    } else {
      rows.push({
        slug: theme.slug,
        name: theme.name,
        themeId: '?',
        set_num: 'NONE',
        setName: '—',
        year: '—',
        rebrickable_img: 'NO RESULT',
        brickset_fallback: '—',
      });
      process.stdout.write(` NO RESULT\n`);
    }
    // Be polite — 200 ms between requests
    await new Promise((r) => setTimeout(r, 200));
  }

  // ── Print table ────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(120));
  console.log(
    pad('SLUG', 18) +
    pad('ID', 6) +
    pad('SET NUM', 14) +
    pad('YEAR', 6) +
    pad('REBRICKABLE IMAGE URL', 60) +
    'BRICKSET FALLBACK'
  );
  console.log('─'.repeat(120));

  for (const r of rows) {
    console.log(
      pad(r.slug, 18) +
      pad(r.themeId, 6) +
      pad(r.set_num, 14) +
      pad(r.year, 6) +
      pad(r.rebrickable_img, 60) +
      r.brickset_fallback
    );
  }

  console.log('─'.repeat(120));
  console.log(`\n${rows.length} themes processed. No files were modified.\n`);

  // ── Also print copy-paste-ready brand.ts image lines ───────────────────────
  console.log('── BRAND.TS IMAGE LINES (for reference, not applied yet) ──────────────────────\n');
  for (const r of rows) {
    const imgUrl = r.rebrickable_img !== 'NULL' && r.rebrickable_img !== 'NO RESULT'
      ? r.rebrickable_img
      : r.brickset_fallback;
    console.log(`  { slug: "${r.slug}", image: "${imgUrl}" },`);
  }
  console.log('');
}

main().catch((err) => { console.error(err); process.exit(1); });
