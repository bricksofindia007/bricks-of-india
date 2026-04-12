/**
 * populate-article-images.mjs
 *
 * Maps each news/blog article to a representative LEGO set number based on
 * keywords in the title, constructs a Brickset CDN URL, does a HEAD request
 * to confirm it returns 200, then writes hero_image to Supabase for all
 * rows where hero_image is currently null.
 *
 * Run: node scripts/populate-article-images.mjs
 */

import fs from 'fs';
import https from 'https';
import { createClient } from '@supabase/supabase-js';

// ── Load .env.local ──────────────────────────────────────────────────────────
const envRaw = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = {};
for (const line of envRaw.split('\n')) {
  const eq = line.indexOf('=');
  if (eq > 0) env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}

// Service role key required — anon key cannot UPDATE due to RLS
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// ── Per-title overrides (checked before keyword rules) ───────────────────────
// Exact title substring matches that need a specific set, different from what
// the keyword rules would produce. Lower-cased comparison.
const TITLE_OVERRIDES = {
  'technic vs lego® city':                    '42171',  // show Technic side (row 21)
  'technic vs lego':                          '42171',  // fallback match
  'gift ideas for kids':                      '11037',  // Classic Space, not Botanical (row 22)
  'new lego® sets available on toycra':       '10313',  // Wildflower Bouquet, not Dried Flower (row 9)
  'lego® botanical collection 2026':          '10329',  // Tiny Plants, not Dried Flower (row 13)
};

function applyOverride(title) {
  const lower = title.toLowerCase();
  for (const [fragment, set_num] of Object.entries(TITLE_OVERRIDES)) {
    if (lower.includes(fragment.toLowerCase())) return set_num;
  }
  return null;
}

// ── Keyword → set_num mapping ────────────────────────────────────────────────
// Rules are matched top-to-bottom; first match wins.
// set_num is the base number without the -1 suffix.
const RULES = [
  // Specific themes / sets mentioned in the title
  { keywords: ['minifigures series'],   set_num: '71045'  }, // CMF Series 25
  { keywords: ['lord of the rings'],    set_num: '10316'  }, // Return to Rivendell
  { keywords: ['f1 collection', 'formula 1', 'formula one', 'mclaren'], set_num: '76919' }, // McLaren F1
  { keywords: ['speed champions'],      set_num: '76919'  }, // McLaren F1
  { keywords: ['minecraft'],            set_num: '21248'  }, // The Pumpkin Farm
  { keywords: ['creator'],              set_num: '31150'  }, // Whale
  { keywords: ['city'],                 set_num: '60422'  }, // City Park
  { keywords: ['botanical'],            set_num: '10314'  }, // Dried Flower Centrepiece
  { keywords: ['icons'],                set_num: '10317'  }, // Land Rover Defender
  { keywords: ['harry potter'],         set_num: '76435'  }, // Hogwarts Express Collectors Edition
  { keywords: ['star wars'],            set_num: '75398'  }, // Tantive IV
  { keywords: ['technic'],              set_num: '42171'  }, // Mercedes AMG F1
  { keywords: ['ideas'],                set_num: '21348'  }, // Medieval Town Square
  { keywords: ['toycra'],               set_num: '10314'  }, // Dried Flower (botanical/lifestyle)
  { keywords: ['mybrickhouse'],         set_num: '10314'  }, // Dried Flower (lifestyle)
  { keywords: ['retiring'],             set_num: '10281'  }, // Bonsai Tree (popular retiring set)
  { keywords: ['price changes', 'prices are what'], set_num: '10317' }, // Land Rover (premium)
  { keywords: ['deals', 'cheapest', 'buy'],         set_num: '60422' }, // City Park (deal)

  // Blog-specific
  { keywords: ['under ₹2,000', 'under rs 2'],       set_num: '31150' }, // affordable Creator
  { keywords: ['under ₹5,000', 'under rs 5'],       set_num: '42161' }, // Technic Bugatti
  { keywords: ['for adults'],                        set_num: '10317' }, // Land Rover
  { keywords: ['for kids'],                          set_num: '60422' }, // City
  { keywords: ['gift ideas'],                        set_num: '10314' }, // Botanical
  { keywords: ['beginner'],                          set_num: '11037' }, // Classic Space
  { keywords: ['store your lego', 'storage'],        set_num: '11037' }, // Classic
  { keywords: ['investment'],                        set_num: '10316' }, // Rivendell
  { keywords: ['fake lego', 'knockoff'],             set_num: '60422' }, // City (common target)
  { keywords: ['worth the price'],                   set_num: '10317' }, // Land Rover
  { keywords: ['destroy your wallet'],               set_num: '10316' }, // Rivendell (expensive)
  { keywords: ['discontinued'],                      set_num: '10281' }, // Bonsai (discontinued)
  { keywords: ['3-in-1', '3 in 1'],                  set_num: '31150' }, // Creator 3-in-1
  { keywords: ['rewards'],                           set_num: '11037' }, // Classic
  { keywords: ['vs', 'technic vs'],                  set_num: '42171' }, // Technic
  { keywords: ['complete list', 'complete guide', 'every lego', 'new sets'], set_num: '60422' }, // City (general)
  { keywords: ['where to buy'],                      set_num: '10317' }, // Land Rover
  { keywords: ['how to find'],                       set_num: '10281' }, // Bonsai

  // Catch-all
  { keywords: [],                                    set_num: '60422' }, // City Park fallback
];

function mapTitleToSetNum(title) {
  const override = applyOverride(title);
  if (override) return override;
  const lower = title.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.length === 0) return rule.set_num; // catch-all
    if (rule.keywords.some(kw => lower.includes(kw))) return rule.set_num;
  }
  return '60422'; // should never reach here
}

function bricksetUrl(set_num) {
  return `https://images.brickset.com/sets/images/${set_num}-1.jpg`;
}

// HEAD request — returns HTTP status code
function headStatus(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => resolve(res.statusCode));
    req.on('error', () => resolve(0));
    req.end();
  });
}

const pad = (s, n) => String(s ?? '').slice(0, n).padEnd(n);

async function main() {
  const [{ data: news }, { data: blog }] = await Promise.all([
    supabase.from('news_articles').select('id, title, slug, hero_image').order('published_at', { ascending: false }),
    supabase.from('blog_posts').select('id, title, slug, hero_image').order('published_at', { ascending: false }),
  ]);

  const articles = [
    ...(news || []).map(r => ({ ...r, type: 'news' })),
    ...(blog || []).map(r => ({ ...r, type: 'blog' })),
  ];

  const rows = [];

  console.log('\nBuilding article → set_num mapping...\n');

  for (const article of articles) {
    const set_num = mapTitleToSetNum(article.title);
    const url = bricksetUrl(set_num);
    const status = await headStatus(url);
    rows.push({
      type: article.type,
      id: article.id,
      title: article.title,
      set_num,
      url,
      status,
      ok: status === 200,
    });
    await new Promise(r => setTimeout(r, 80)); // gentle rate limiting
  }

  // Print table
  console.log('═'.repeat(145));
  console.log(pad('TYPE', 6) + pad('SET', 9) + pad('HTTP', 6) + pad('TITLE', 70) + 'IMAGE URL');
  console.log('═'.repeat(145));

  for (const r of rows) {
    const status = r.ok ? ' 200' : (' ' + r.status);
    const flag = r.ok ? '' : ' ✗';
    console.log(pad(r.type, 6) + pad(r.set_num, 9) + pad(status + flag, 6) + pad(r.title, 70) + r.url);
  }

  console.log('═'.repeat(145));

  const ok = rows.filter(r => r.ok).length;
  const fail = rows.filter(r => !r.ok).length;
  console.log(`\n${ok} URLs confirmed 200 | ${fail} failed`);

  if (fail > 0) {
    console.log('\nFailed rows — skipping Supabase update for these:');
    rows.filter(r => !r.ok).forEach(r =>
      console.log('  [' + r.type + '] ' + r.set_num + '  ' + r.title)
    );
  }

  // ── Write to Supabase — only rows with confirmed 200 URLs ──────────────────
  const toWrite = rows.filter(r => r.ok);
  console.log('\nWriting ' + toWrite.length + ' hero_image values to Supabase...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const r of toWrite) {
    const table = r.type === 'news' ? 'news_articles' : 'blog_posts';
    const { error } = await supabase
      .from(table)
      .update({ hero_image: r.url })
      .eq('id', r.id);

    if (error) {
      console.error('  ERROR [' + r.type + '] ' + r.title.slice(0, 60) + ' — ' + error.message);
      errorCount++;
    } else {
      successCount++;
    }
  }

  console.log('─'.repeat(60));
  console.log('Updated:  ' + successCount + ' rows');
  console.log('Errors:   ' + errorCount + ' rows');
  console.log('Skipped:  ' + fail + ' rows (image URL not 200)');
  console.log('─'.repeat(60));
  console.log('');
}

main().catch(err => { console.error(err); process.exit(1); });
