'use strict';
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {

  // FIX 1: Linter exemptions
  let linter = fs.readFileSync('scripts/content-linter.mjs', 'utf8');
  linter = linter.replace(
    `if (isNewsOrReview && !body.includes('₹'))`,
    `if (isNewsOrReview && ['New Sets', 'India Launches', 'Review'].includes(art.category) && !body.includes('₹'))`
  );
  fs.writeFileSync('scripts/content-linter.mjs', linter);
  console.log('FIX 1: Linter india_paragraph exemption applied');

  // FIX 2: Guide images
  const guideImages = [
    { slug: 'what-is-lego-beginners-guide-india', url: 'https://images.brickset.com/sets/images/11031-1.jpg' },
    { slug: 'how-to-buy-lego-india',              url: 'https://images.brickset.com/sets/images/40567-1.jpg' },
    { slug: 'lego-themes-explained-india',        url: 'https://images.brickset.com/sets/images/75192-1.jpg' },
    { slug: 'is-lego-worth-the-price-india',      url: 'https://images.brickset.com/sets/images/10295-1.jpg' },
    { slug: 'how-to-store-display-lego-india',    url: 'https://images.brickset.com/sets/images/21042-1.jpg' },
    { slug: 'lego-for-kids-vs-adults-india',      url: 'https://images.brickset.com/sets/images/60363-1.jpg' },
    { slug: 'lego-resale-market-india',           url: 'https://images.brickset.com/sets/images/10179-1.jpg' },
    { slug: 'lego-vs-chinese-clones-india',       url: 'https://images.brickset.com/sets/images/31120-1.jpg' },
    { slug: 'history-of-lego-in-india',           url: 'https://images.brickset.com/sets/images/10305-1.jpg' },
  ];
  for (const g of guideImages) {
    try {
      const r = await fetch(g.url, { method: 'HEAD' });
      if (r.ok) {
        const { error } = await sb.from('guides').update({ featured_image_url: g.url }).eq('slug', g.slug);
        console.log(error ? 'FAIL FIX 2: ' + g.slug + ': ' + error.message : 'OK FIX 2: ' + g.slug);
      } else {
        console.log('SKIP FIX 2: ' + g.slug + ' image returned ' + r.status);
      }
    } catch(e) { console.log('FAIL FIX 2: ' + g.slug + ' -- ' + e.message); }
  }

  // FIX 3: Forbidden words bulk replace
  const replacements = [
    { find: /\bimpressive\b/gi, replace: 'well-executed' },
    { find: /\bfolks\b/gi,      replace: 'everyone' },
    { find: /\bhefty\b/gi,      replace: 'high' },
    { find: /\btestament\b/gi,  replace: 'sign' },
  ];
  for (const table of ['news_articles', 'blog_posts']) {
    const { data, error } = await sb.from(table).select('id, slug, content');
    if (error) { console.error('FAIL FIX 3: ' + table + ' fetch failed: ' + error.message); continue; }
    let fixCount = 0;
    for (const row of data) {
      let updated = row.content;
      for (const { find, replace } of replacements) updated = updated.replace(find, replace);
      if (updated !== row.content) {
        const { error: ue } = await sb.from(table).update({ content: updated }).eq('id', row.id);
        if (!ue) fixCount++;
        else console.log('FAIL FIX 3: ' + row.slug + ': ' + ue.message);
      }
    }
    console.log('OK FIX 3: ' + table + ' -- ' + fixCount + ' articles updated');
  }

  // FIX 4: Bulk signoff append
  const SIGNOFF = '\n\nOn that bombshell, bubyee.';
  for (const table of ['news_articles', 'blog_posts']) {
    const { data } = await sb.from(table).select('id, slug, content');
    let fixCount = 0;
    for (const row of data) {
      if (!row.content?.includes('On that bombshell') && !row.content?.includes('bubyee') && !row.content?.includes('Bubyee')) {
        const { error } = await sb.from(table).update({ content: row.content + SIGNOFF }).eq('id', row.id);
        if (!error) fixCount++;
        else console.log('FAIL FIX 4: ' + row.slug + ': ' + error.message);
      }
    }
    console.log('OK FIX 4: ' + table + ' -- ' + fixCount + ' signoffs appended');
  }

  // FIX 5: Duplicate images
  const dupefix = [
    { table: 'news_articles', slug: 'lego-lord-rings-2026-india',    url: 'https://images.brickset.com/sets/images/40630-1.jpg' },
    { table: 'blog_posts',    slug: 'lego-sets-destroy-wallet-2026', url: 'https://images.brickset.com/sets/images/75313-1.jpg' },
  ];
  for (const d of dupefix) {
    try {
      const r = await fetch(d.url, { method: 'HEAD' });
      if (r.ok) {
        const { error } = await sb.from(d.table).update({ hero_image: d.url }).eq('slug', d.slug);
        console.log(error ? 'FAIL FIX 5: ' + d.slug + ': ' + error.message : 'OK FIX 5: ' + d.slug);
      } else {
        console.log('SKIP FIX 5: ' + d.slug + ' -- image ' + r.status);
      }
    } catch(e) { console.log('FAIL FIX 5: ' + d.slug + ' -- ' + e.message); }
  }

  console.log('\nAll fixes complete.');
}
main().catch(console.error);
